use crate::{
    metrics::planar_confidence, FrameRange, Homography, PlanarTrackFrame, PlanarTrackOptions,
    PlanarTrackResult, Quad, TrackStatus, TrackingError, VideoInput,
};
use opencv::{
    calib3d,
    core::{self, DMatch, KeyPoint, Mat, Point2f, Vector},
    features2d::{self, DescriptorMatcherTraitConst, Feature2DTrait, ORB},
    imgproc,
    prelude::*,
    videoio,
};

fn gray(frame: &Mat) -> Result<Mat, TrackingError> {
    let mut out = Mat::default();
    imgproc::cvt_color(frame, &mut out, imgproc::COLOR_BGR2GRAY, 0)?;
    Ok(out)
}
fn inside(p: Point2f, q: &Quad) -> bool {
    let mut sign = 0i32;
    for i in 0..4 {
        let a = q[i];
        let b = q[(i + 1) % 4];
        let cross = (b[0] - a[0]) * (p.y as f64 - a[1]) - (b[1] - a[1]) * (p.x as f64 - a[0]);
        let s = if cross > 0.0 {
            1
        } else if cross < 0.0 {
            -1
        } else {
            0
        };
        if s != 0 {
            if sign == 0 {
                sign = s
            } else if sign != s {
                return false;
            }
        }
    }
    true
}
fn detect(
    gray: &Mat,
    quad: &Quad,
    max_features: i32,
) -> Result<(Vector<KeyPoint>, Mat), TrackingError> {
    let mut orb = ORB::create(
        max_features.max(32),
        1.2,
        8,
        31,
        0,
        2,
        features2d::ORB_ScoreType::HARRIS_SCORE,
        31,
        20,
    )?;
    let mut all = Vector::<KeyPoint>::new();
    let mut desc = Mat::default();
    orb.detect_and_compute_def(gray, &core::no_array(), &mut all, &mut desc)?;
    let mut kept = Vector::<KeyPoint>::new();
    for kp in all {
        if inside(kp.pt(), quad) {
            kept.push(kp)
        }
    }
    let mut kept_desc = Mat::default();
    orb.compute(gray, &mut kept, &mut kept_desc)?;
    Ok((kept, kept_desc))
}
fn matrix9(h: &Mat) -> Result<Homography, TrackingError> {
    if h.rows() != 3 || h.cols() != 3 {
        return Err(TrackingError::Solve("homography matrix invalid".into()));
    }
    let mut out = [0.0; 9];
    for r in 0..3 {
        for c in 0..3 {
            out[r * 3 + c] = *h.at_2d::<f64>(r as i32, c as i32)?;
        }
    }
    Ok(out)
}
fn project_quad(h: &Mat, q: &Quad) -> Result<Quad, TrackingError> {
    let src =
        Vector::<Point2f>::from_iter(q.iter().map(|p| Point2f::new(p[0] as f32, p[1] as f32)));
    let mut dst = Vector::<Point2f>::new();
    core::perspective_transform(&src, &mut dst, h)?;
    if dst.len() != 4 {
        return Err(TrackingError::Solve("corner projection failed".into()));
    }
    Ok([0usize, 1, 2, 3].map(|i| {
        let p = dst.get(i).unwrap();
        [p.x as f64, p.y as f64]
    }))
}
fn reprojection_error(
    src: &Vector<Point2f>,
    dst: &Vector<Point2f>,
    h: &Mat,
    mask: &Mat,
) -> Result<(f64, f64), TrackingError> {
    let mut projected = Vector::<Point2f>::new();
    core::perspective_transform(src, &mut projected, h)?;
    let mut sum = 0.0;
    let mut inliers = 0usize;
    let n = src.len().min(dst.len()).min(projected.len());
    for i in 0..n {
        let keep = if mask.empty() {
            true
        } else {
            *mask.at_2d::<u8>(i as i32, 0)? != 0
        };
        if keep {
            let a = projected.get(i)?;
            let b = dst.get(i)?;
            let dx = (a.x - b.x) as f64;
            let dy = (a.y - b.y) as f64;
            sum += (dx * dx + dy * dy).sqrt();
            inliers += 1;
        }
    }
    Ok((
        if inliers > 0 {
            sum / inliers as f64
        } else {
            f64::INFINITY
        },
        if n > 0 {
            inliers as f64 / n as f64
        } else {
            0.0
        },
    ))
}

pub fn solve_planar_track_impl(
    video: &VideoInput,
    quad: Quad,
    range: FrameRange,
    options: PlanarTrackOptions,
) -> Result<PlanarTrackResult, TrackingError> {
    if range.start < 0 || range.end < range.start {
        return Err(TrackingError::InvalidInput("invalid frame range".into()));
    }
    let mut cap = videoio::VideoCapture::from_file(&video.path, videoio::CAP_ANY)?;
    if !cap.is_opened()? {
        return Err(TrackingError::InvalidInput(format!(
            "cannot open {}",
            video.path
        )));
    }
    cap.set(videoio::CAP_PROP_POS_FRAMES, range.start as f64)?;
    let mut first = Mat::default();
    if !cap.read(&mut first)? || first.empty() {
        return Err(TrackingError::InvalidInput(
            "reference frame unavailable".into(),
        ));
    }
    let first_gray = gray(&first)?;
    let (ref_keys, ref_desc) = detect(&first_gray, &quad, options.max_features)?;
    if ref_keys.len() < 4 {
        return Err(TrackingError::Solve(
            "planar region has fewer than four ORB features".into(),
        ));
    }
    let mut matcher = features2d::BFMatcher::create(core::NORM_HAMMING, false)?;
    let identity: [f64; 9] = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
    let mut frames = vec![PlanarTrackFrame {
        frame: range.start,
        quad,
        homography: identity,
        status: TrackStatus::Tracked,
        reprojection_error: 0.0,
        inlier_ratio: 1.0,
        confidence: 1.0,
    }];
    for frame_no in (range.start + 1)..=range.end {
        let mut color = Mat::default();
        if !cap.read(&mut color)? || color.empty() {
            break;
        }
        let next_gray = gray(&color)?;
        let (mut keys, desc) = detect(&next_gray, &quad, options.max_features)?;
        let mut matches = Vector::<Vector<DMatch>>::new();
        matcher.knn_train_match_def(&ref_desc, &desc, &mut matches, 2)?;
        let mut src = Vector::<Point2f>::new();
        let mut dst = Vector::<Point2f>::new();
        for pair in matches {
            if pair.len() < 2 {
                continue;
            }
            let a = pair.get(0)?;
            let b = pair.get(1)?;
            if a.distance < 0.78 * b.distance {
                src.push(ref_keys.get(a.query_idx as usize)?.pt());
                dst.push(keys.get(a.train_idx as usize)?.pt());
            }
        }
        if src.len() < 4 {
            frames.push(PlanarTrackFrame {
                frame: frame_no,
                quad: frames.last().unwrap().quad,
                homography: frames.last().unwrap().homography,
                status: TrackStatus::Lost,
                reprojection_error: f64::INFINITY,
                inlier_ratio: 0.0,
                confidence: 0.0,
            });
            continue;
        }
        let mut mask = Mat::default();
        let h = calib3d::find_homography(
            &src,
            &dst,
            &mut mask,
            calib3d::RANSAC,
            options.ransac_threshold,
        )?;
        if h.empty() {
            frames.push(PlanarTrackFrame {
                frame: frame_no,
                quad: frames.last().unwrap().quad,
                homography: frames.last().unwrap().homography,
                status: TrackStatus::Lost,
                reprojection_error: f64::INFINITY,
                inlier_ratio: 0.0,
                confidence: 0.0,
            });
            continue;
        }
        let (reprojection_error, inlier_ratio) = reprojection_error(&src, &dst, &h, &mask)?;
        let confidence =
            planar_confidence(inlier_ratio, reprojection_error, options.ransac_threshold);
        let status =
            if confidence < options.min_confidence || inlier_ratio < options.min_inlier_ratio {
                TrackStatus::Occluded
            } else {
                TrackStatus::Tracked
            };
        frames.push(PlanarTrackFrame {
            frame: frame_no,
            quad: project_quad(&h, &quad)?,
            homography: matrix9(&h)?,
            status,
            reprojection_error,
            inlier_ratio,
            confidence,
        });
    }
    Ok(PlanarTrackResult {
        kind: "planar".into(),
        algorithm: "opencv-orb-ransac".into(),
        algorithm_version: "0.4".into(),
        reference_quad: quad,
        frames,
    })
}

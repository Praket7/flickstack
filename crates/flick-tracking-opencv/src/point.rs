use crate::{
    metrics::point_confidence, FrameRange, PointTrackFrame, PointTrackOptions, PointTrackResult,
    TrackStatus, TrackingError, Vec2, VideoInput,
};
use opencv::{
    core::{self, Mat, Point2f, Size, TermCriteria, TermCriteria_Type, Vector},
    features2d::{self, Feature2DTrait, ORB},
    imgproc,
    prelude::*,
    video, videoio,
};

fn gray(frame: &Mat) -> Result<Mat, TrackingError> {
    let mut out = Mat::default();
    imgproc::cvt_color(frame, &mut out, imgproc::COLOR_BGR2GRAY, 0)?;
    Ok(out)
}
fn open(
    video: &VideoInput,
    range: FrameRange,
) -> Result<(videoio::VideoCapture, Mat), TrackingError> {
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
    let mut frame = Mat::default();
    if !cap.read(&mut frame)? || frame.empty() {
        return Err(TrackingError::InvalidInput(
            "start frame unavailable".into(),
        ));
    }
    Ok((cap, gray(&frame)?))
}
fn distance(a: Point2f, b: Point2f) -> f64 {
    let dx = (a.x - b.x) as f64;
    let dy = (a.y - b.y) as f64;
    (dx * dx + dy * dy).sqrt()
}
fn redetect_near(
    gray: &Mat,
    near: Point2f,
    max_radius: f32,
) -> Result<Option<Point2f>, TrackingError> {
    let mut orb = ORB::create(
        300,
        1.2,
        4,
        19,
        0,
        2,
        features2d::ORB_ScoreType::HARRIS_SCORE,
        31,
        12,
    )?;
    let mut keys = Vector::new();
    orb.detect_def(gray, &mut keys)?;
    let mut best: Option<(f64, Point2f)> = None;
    for key in keys {
        let p = key.pt();
        let d = distance(p, near);
        if d <= max_radius as f64 && best.as_ref().map(|b| d < b.0).unwrap_or(true) {
            best = Some((d, p));
        }
    }
    Ok(best.map(|(_, p)| p))
}
fn lk(
    prev: &Mat,
    next: &Mat,
    point: Point2f,
    options: PointTrackOptions,
) -> Result<(Point2f, bool, f64), TrackingError> {
    let prev_pts: Vector<Point2f> = Vector::from_iter([point]);
    let mut next_pts = Vector::<Point2f>::new();
    let mut status = Vector::<u8>::new();
    let mut err = Vector::<f32>::new();
    let criteria = TermCriteria::new(
        (TermCriteria_Type::COUNT as i32) | (TermCriteria_Type::EPS as i32),
        30,
        0.01,
    )?;
    video::calc_optical_flow_pyr_lk(
        prev,
        next,
        &prev_pts,
        &mut next_pts,
        &mut status,
        &mut err,
        Size::new(options.window_size, options.window_size),
        options.pyramid_levels,
        criteria,
        0,
        1e-4,
    )?;
    let ok = status.get(0).unwrap_or(0) != 0;
    let p = next_pts.get(0).unwrap_or(point);
    let e = err.get(0).unwrap_or(f32::MAX) as f64;
    Ok((p, ok, e))
}

pub fn solve_point_track_impl(
    video: &VideoInput,
    seed: Vec2,
    range: FrameRange,
    options: PointTrackOptions,
) -> Result<PointTrackResult, TrackingError> {
    let (mut cap, mut previous) = open(video, range)?;
    let mut current = Point2f::new(seed[0] as f32, seed[1] as f32);
    let mut frames = vec![PointTrackFrame {
        frame: range.start,
        point: seed,
        status: TrackStatus::Tracked,
        forward_backward_error: 0.0,
        confidence: 1.0,
    }];
    for frame_no in (range.start + 1)..=range.end {
        let mut color = Mat::default();
        if !cap.read(&mut color)? || color.empty() {
            break;
        }
        let next = gray(&color)?;
        let (predicted, forward_ok, lk_error) = lk(&previous, &next, current, options)?;
        let (backward, back_ok, _) = lk(&next, &previous, predicted, options)?;
        let forward_backward_error = if forward_ok && back_ok {
            distance(backward, current)
        } else {
            f64::INFINITY
        };
        let mut candidate = predicted;
        let mut status = if forward_ok && back_ok {
            TrackStatus::Tracked
        } else {
            TrackStatus::Lost
        };
        let periodic =
            options.redetect_every > 0 && (frame_no - range.start) % options.redetect_every == 0;
        if periodic || !forward_ok || forward_backward_error > options.max_forward_backward_error {
            if let Some(redetected) =
                redetect_near(&next, predicted, (options.window_size * 3).max(24) as f32)?
            {
                candidate = redetected;
                status = TrackStatus::Redetected;
            }
        }
        let confidence = if matches!(status, TrackStatus::Lost) {
            0.0
        } else {
            point_confidence(
                forward_backward_error.min(options.max_forward_backward_error * 4.0),
                lk_error,
                options.max_forward_backward_error,
            )
        };
        if confidence < options.min_confidence && matches!(status, TrackStatus::Tracked) {
            status = TrackStatus::Occluded;
        }
        current = candidate;
        frames.push(PointTrackFrame {
            frame: frame_no,
            point: [current.x as f64, current.y as f64],
            status,
            forward_backward_error,
            confidence,
        });
        previous = next;
    }
    Ok(PointTrackResult {
        kind: "point".into(),
        algorithm: "opencv-pyr-lk".into(),
        algorithm_version: "0.4".into(),
        seed,
        frames,
    })
}

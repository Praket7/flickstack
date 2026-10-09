use flick_tracking_opencv::{
    backend_available,
    metrics::{planar_confidence, point_confidence},
    solve_point_track,
    stabilize::derive_stabilization,
    FrameRange, PlanarTrackFrame, PlanarTrackResult, PointTrackOptions, TrackStatus, VideoInput,
};
#[test]
fn confidence_metrics_are_bounded() {
    assert!(point_confidence(0.1, 0.2, 2.0) > 0.8);
    assert_eq!(point_confidence(5.0, 100.0, 2.0), 0.0);
    assert!(planar_confidence(0.95, 0.2, 3.0) > 0.8);
}
#[test]
fn stabilization_inverts_known_planar_translation() {
    let result = PlanarTrackResult {
        kind: "planar".into(),
        algorithm: "synthetic".into(),
        algorithm_version: "0.4".into(),
        reference_quad: [[0., 0.], [100., 0.], [100., 50.], [0., 50.]],
        frames: vec![
            PlanarTrackFrame {
                frame: 0,
                quad: [[0., 0.], [100., 0.], [100., 50.], [0., 50.]],
                homography: [1., 0., 0., 0., 1., 0., 0., 0., 1.],
                status: TrackStatus::Tracked,
                reprojection_error: 0.,
                inlier_ratio: 1.,
                confidence: 1.,
            },
            PlanarTrackFrame {
                frame: 1,
                quad: [[5., 2.], [105., 2.], [105., 52.], [5., 52.]],
                homography: [1., 0., 5., 0., 1., 2., 0., 0., 1.],
                status: TrackStatus::Tracked,
                reprojection_error: 0.1,
                inlier_ratio: 0.98,
                confidence: 0.99,
            },
        ],
    };
    let s = derive_stabilization(&result);
    assert_eq!(s[0].x, 0.);
    assert!((s[1].x + 5.).abs() < 1e-9);
    assert!((s[1].y + 2.).abs() < 1e-9);
}
#[cfg(not(feature = "opencv-backend"))]
#[test]
fn missing_opencv_is_explicit_not_a_crash() {
    assert!(!backend_available());
    let e = solve_point_track(
        &VideoInput {
            path: "missing.mp4".into(),
        },
        [0., 0.],
        FrameRange { start: 0, end: 1 },
        PointTrackOptions::default(),
    )
    .unwrap_err();
    assert!(e.to_string().contains("unavailable"));
}

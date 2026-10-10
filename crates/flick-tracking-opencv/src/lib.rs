use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod metrics;
#[cfg(feature = "opencv-backend")]
pub mod planar;
#[cfg(feature = "opencv-backend")]
pub mod point;
pub mod stabilize;

pub type Vec2 = [f64; 2];
pub type Quad = [Vec2; 4];
pub type Homography = [f64; 9];

#[derive(Debug, Error)]
pub enum TrackingError {
    #[error("native OpenCV tracking backend unavailable: {0}")]
    Unavailable(String),
    #[error("invalid tracking input: {0}")]
    InvalidInput(String),
    #[error("tracking solve failed: {0}")]
    Solve(String),
}
#[cfg(feature = "opencv-backend")]
impl From<opencv::Error> for TrackingError {
    fn from(value: opencv::Error) -> Self {
        Self::Solve(value.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoInput {
    pub path: String,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FrameRange {
    pub start: i32,
    pub end: i32,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum TrackStatus {
    Tracked,
    Redetected,
    Occluded,
    Lost,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PointTrackOptions {
    pub window_size: i32,
    pub pyramid_levels: i32,
    pub redetect_every: i32,
    pub max_forward_backward_error: f64,
    pub min_confidence: f64,
}
impl Default for PointTrackOptions {
    fn default() -> Self {
        Self {
            window_size: 21,
            pyramid_levels: 3,
            redetect_every: 5,
            max_forward_backward_error: 2.0,
            min_confidence: 0.25,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PointTrackFrame {
    pub frame: i32,
    pub point: Vec2,
    pub status: TrackStatus,
    pub forward_backward_error: f64,
    pub confidence: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PointTrackResult {
    pub kind: String,
    pub algorithm: String,
    pub algorithm_version: String,
    pub seed: Vec2,
    pub frames: Vec<PointTrackFrame>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanarTrackOptions {
    pub max_features: i32,
    pub ransac_threshold: f64,
    pub min_inlier_ratio: f64,
    pub min_confidence: f64,
}
impl Default for PlanarTrackOptions {
    fn default() -> Self {
        Self {
            max_features: 750,
            ransac_threshold: 3.0,
            min_inlier_ratio: 0.25,
            min_confidence: 0.2,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanarTrackFrame {
    pub frame: i32,
    pub quad: Quad,
    pub homography: Homography,
    pub status: TrackStatus,
    pub reprojection_error: f64,
    pub inlier_ratio: f64,
    pub confidence: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanarTrackResult {
    pub kind: String,
    pub algorithm: String,
    pub algorithm_version: String,
    pub reference_quad: Quad,
    pub frames: Vec<PlanarTrackFrame>,
}

pub fn backend_available() -> bool {
    cfg!(feature = "opencv-backend")
}

#[cfg(feature = "opencv-backend")]
pub fn solve_point_track(
    video: &VideoInput,
    seed: Vec2,
    range: FrameRange,
    options: PointTrackOptions,
) -> Result<PointTrackResult, TrackingError> {
    point::solve_point_track_impl(video, seed, range, options)
}
#[cfg(not(feature = "opencv-backend"))]
pub fn solve_point_track(
    _: &VideoInput,
    _: Vec2,
    _: FrameRange,
    _: PointTrackOptions,
) -> Result<PointTrackResult, TrackingError> {
    Err(TrackingError::Unavailable(
        "build without opencv-backend feature".into(),
    ))
}

#[cfg(feature = "opencv-backend")]
pub fn solve_planar_track(
    video: &VideoInput,
    quad: Quad,
    range: FrameRange,
    options: PlanarTrackOptions,
) -> Result<PlanarTrackResult, TrackingError> {
    planar::solve_planar_track_impl(video, quad, range, options)
}
#[cfg(not(feature = "opencv-backend"))]
pub fn solve_planar_track(
    _: &VideoInput,
    _: Quad,
    _: FrameRange,
    _: PlanarTrackOptions,
) -> Result<PlanarTrackResult, TrackingError> {
    Err(TrackingError::Unavailable(
        "build without opencv-backend feature".into(),
    ))
}

use crate::{PlanarTrackResult, Vec2};
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StabilizationFrame {
    pub frame: i32,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub scale: f64,
    pub confidence: f64,
}
fn center(q: &[[f64; 2]; 4]) -> Vec2 {
    [
        (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4.0,
        (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4.0,
    ]
}
fn edge(q: &[[f64; 2]; 4]) -> (f64, f64) {
    let dx = q[1][0] - q[0][0];
    let dy = q[1][1] - q[0][1];
    ((dx * dx + dy * dy).sqrt(), dy.atan2(dx).to_degrees())
}
pub fn derive_stabilization(result: &PlanarTrackResult) -> Vec<StabilizationFrame> {
    let c0 = center(&result.reference_quad);
    let (e0, a0) = edge(&result.reference_quad);
    result
        .frames
        .iter()
        .map(|f| {
            let c = center(&f.quad);
            let (e, a) = edge(&f.quad);
            StabilizationFrame {
                frame: f.frame,
                x: c0[0] - c[0],
                y: c0[1] - c[1],
                rotation: a0 - a,
                scale: if e > f64::EPSILON { e0 / e } else { 1.0 },
                confidence: f.confidence,
            }
        })
        .collect()
}

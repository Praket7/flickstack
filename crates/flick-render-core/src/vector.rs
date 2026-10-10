use crate::paint::Paint;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum PathCommand {
    MoveTo(f32, f32),
    LineTo(f32, f32),
    QuadTo(f32, f32, f32, f32),
    CubicTo(f32, f32, f32, f32, f32, f32),
    Close,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct VectorPath {
    pub commands: Vec<PathCommand>,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum LineCap {
    Butt,
    Round,
    Square,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum LineJoin {
    Miter,
    Round,
    Bevel,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct StrokeStyle {
    pub width: f32,
    pub cap: LineCap,
    pub join: LineJoin,
    pub miter_limit: f32,
    pub dash: Vec<f32>,
    pub dash_offset: f32,
}
impl Default for StrokeStyle {
    fn default() -> Self {
        Self {
            width: 1.0,
            cap: LineCap::Butt,
            join: LineJoin::Miter,
            miter_limit: 4.0,
            dash: vec![],
            dash_offset: 0.0,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct VectorPrimitive {
    pub path: VectorPath,
    pub fill: Option<Paint>,
    pub stroke: Option<(Paint, StrokeStyle)>,
    pub transform: [f32; 6],
    pub opacity: f32,
}

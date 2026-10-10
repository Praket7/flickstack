use crate::color::LinearRgba;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GradientStop {
    pub offset: f32,
    pub color: LinearRgba,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Paint {
    Solid(LinearRgba),
    LinearGradient {
        from: [f32; 2],
        to: [f32; 2],
        stops: Vec<GradientStop>,
    },
    RadialGradient {
        center: [f32; 2],
        radius: f32,
        stops: Vec<GradientStop>,
    },
}
fn mix(a: LinearRgba, b: LinearRgba, t: f32) -> LinearRgba {
    let t = t.clamp(0.0, 1.0);
    LinearRgba {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
        a: a.a + (b.a - a.a) * t,
    }
}
fn sample_stops(stops: &[GradientStop], t: f32) -> LinearRgba {
    if stops.is_empty() {
        return LinearRgba::TRANSPARENT;
    }
    let t = t.clamp(0.0, 1.0);
    if t <= stops[0].offset {
        return stops[0].color;
    }
    for pair in stops.windows(2) {
        if t <= pair[1].offset {
            let span = (pair[1].offset - pair[0].offset).max(1e-6);
            return mix(pair[0].color, pair[1].color, (t - pair[0].offset) / span);
        }
    }
    stops.last().unwrap().color
}
impl Paint {
    pub fn sample(&self, x: f32, y: f32) -> LinearRgba {
        match self {
            Self::Solid(c) => *c,
            Self::LinearGradient { from, to, stops } => {
                let vx = to[0] - from[0];
                let vy = to[1] - from[1];
                let d = vx * vx + vy * vy;
                let t = if d <= 1e-8 {
                    0.0
                } else {
                    ((x - from[0]) * vx + (y - from[1]) * vy) / d
                };
                sample_stops(stops, t)
            }
            Self::RadialGradient {
                center,
                radius,
                stops,
            } => sample_stops(
                stops,
                ((x - center[0]).powi(2) + (y - center[1]).powi(2)).sqrt()
                    / radius.max(1e-6),
            ),
        }
    }
}

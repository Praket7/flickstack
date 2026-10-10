use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Effect {
    GaussianBlur {
        radius: f32,
    },
    DirectionalBlur {
        distance: f32,
        angle_deg: f32,
    },
    DropShadow {
        radius: f32,
        distance: f32,
        angle_deg: f32,
        color: [f32; 4],
    },
    InnerShadow {
        radius: f32,
        distance: f32,
        color: [f32; 4],
    },
    Glow {
        radius: f32,
        intensity: f32,
        color: [f32; 4],
    },
    ColorMatrix {
        matrix: [f32; 20],
    },
    Sharpen {
        amount: f32,
    },
    Grain {
        amount: f32,
        seed: u64,
    },
    Vignette {
        amount: f32,
        softness: f32,
    },
    Displacement {
        amount: f32,
        seed: u64,
    },
    ChromaticSeparation {
        amount: f32,
    },
    LightSweep {
        angle_deg: f32,
        width: f32,
        intensity: f32,
    },
}
impl Effect {
    pub fn bounds_expansion(&self) -> f32 {
        match self {
            Self::GaussianBlur { radius } | Self::Glow { radius, .. } => radius * 2.,
            Self::DirectionalBlur { distance, .. } => distance * 2.,
            Self::DropShadow {
                radius, distance, ..
            } => radius * 2. + distance,
            Self::Displacement { amount, .. } => amount * 2.,
            Self::ChromaticSeparation { amount } => *amount,
            _ => 0.,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EffectBackend {
    Gpu,
    CpuReference,
}

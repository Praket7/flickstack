#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MatteMode {
    Alpha,
    AlphaInverted,
    Luma,
    LumaInverted,
}
pub fn apply_matte(alpha: f32, matte: f32, mode: MatteMode) -> f32 {
    let m = match mode {
        MatteMode::Alpha | MatteMode::Luma => matte,
        MatteMode::AlphaInverted | MatteMode::LumaInverted => 1. - matte,
    };
    alpha.clamp(0., 1.) * m.clamp(0., 1.)
}

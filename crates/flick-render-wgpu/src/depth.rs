#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DepthState {
    pub enabled: bool,
    pub clear: f32,
}
impl Default for DepthState {
    fn default() -> Self {
        Self {
            enabled: true,
            clear: 1.,
        }
    }
}

use flick_render_core::{EvaluatedScene, RenderError};
pub fn validate_scene(scene: &EvaluatedScene) -> Result<(), RenderError> {
    let pixels = (scene.width as u64) * (scene.height as u64);
    if pixels > 67_108_864 {
        return Err(RenderError::Budget);
    }
    if scene.layers.len() > 16_384 {
        return Err(RenderError::Budget);
    }
    Ok(())
}

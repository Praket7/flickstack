use flick_render_core::{EvaluatedScene,RenderError};
pub struct PassPlan{pub draw_count:usize,pub requires_offscreen:bool}
pub fn plan(scene:&EvaluatedScene)->Result<PassPlan,RenderError>{super::layers::validate_scene(scene)?;Ok(PassPlan{draw_count:scene.layers.len(),requires_offscreen:false})}

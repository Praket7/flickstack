use flick_render_core::{interpolate_shared,SharedState};
pub fn shared_element_state(source:SharedState,destination:SharedState,progress:f32)->SharedState{interpolate_shared(source,destination,progress)}

use flick_render_core::Mask;
pub fn mask_requires_offscreen(mask:&Mask)->bool{mask.feather>0.0||mask.invert}

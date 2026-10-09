use flick_render_core::{Effect, LinearRgba};
pub fn apply_pixel_local(effect: &Effect, p: LinearRgba, x: u32, y: u32) -> LinearRgba {
    match effect {
        Effect::ColorMatrix { matrix } => {
            let a = p.a;
            let un = |c: f32| if a > 1e-6 { c / a } else { 0. };
            let r = un(p.r);
            let g = un(p.g);
            let b = un(p.b);
            let o = [
                r * matrix[0] + g * matrix[1] + b * matrix[2] + a * matrix[3] + matrix[4],
                r * matrix[5] + g * matrix[6] + b * matrix[7] + a * matrix[8] + matrix[9],
                r * matrix[10] + g * matrix[11] + b * matrix[12] + a * matrix[13] + matrix[14],
                r * matrix[15] + g * matrix[16] + b * matrix[17] + a * matrix[18] + matrix[19],
            ];
            LinearRgba::new_straight(o[0], o[1], o[2], o[3])
        }
        Effect::Grain { amount, seed } => {
            let n =
                (((x as u64).wrapping_mul(73856093) ^ (y as u64).wrapping_mul(19349663) ^ *seed)
                    & 0xffff) as f32
                    / 65535.0
                    - 0.5;
            LinearRgba {
                r: (p.r + n * amount * p.a).max(0.),
                g: (p.g + n * amount * p.a).max(0.),
                b: (p.b + n * amount * p.a).max(0.),
                a: p.a,
            }
        }
        _ => p,
    }
}

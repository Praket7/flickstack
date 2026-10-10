use flick_render_core::Effect;
#[test]
fn spatial_effects_expand_bounds() {
    assert_eq!(
        Effect::Glow {
            radius: 20.,
            intensity: 1.,
            color: [1., 1., 1., 1.]
        }
        .bounds_expansion(),
        40.
    );
    assert_eq!(
        Effect::DropShadow {
            radius: 10.,
            distance: 15.,
            angle_deg: 45.,
            color: [0., 0., 0., 1.]
        }
        .bounds_expansion(),
        35.
    );
}

use flick_render_core::{build_text_instances, EvaluatedTextAnimator, LinearRgba};
use flick_text::{
    FontProvenance, Glyph, GlyphRun, TextBounds, TextDirection, TextLayout, TextLine,
};
fn layout() -> TextLayout {
    TextLayout {
        text: "fi é".into(),
        lines: vec![TextLine {
            index: 0,
            baseline: 20.,
            width: 60.,
            bounds: TextBounds {
                x: 0.,
                y: 0.,
                width: 60.,
                height: 24.,
            },
        }],
        runs: vec![GlyphRun {
            font_family: "Test".into(),
            font_index: 0,
            font_size: 20.,
            bidi_level: 0,
            glyphs: vec![
                Glyph {
                    id: 42,
                    cluster: 0,
                    x: 0.,
                    y: 20.,
                    advance: 20.,
                    x_offset: 0.,
                    y_offset: 0.,
                },
                Glyph {
                    id: 43,
                    cluster: 3,
                    x: 20.,
                    y: 20.,
                    advance: 20.,
                    x_offset: 0.,
                    y_offset: 0.,
                },
            ],
        }],
        bounds: TextBounds {
            x: 0.,
            y: 0.,
            width: 60.,
            height: 24.,
        },
        direction: TextDirection::Ltr,
        provenance: FontProvenance {
            requested_families: vec!["Test".into()],
            resolved_families: vec!["Test".into()],
            fallback_used: false,
        },
    }
}
#[test]
fn animator_weights_apply_to_shaped_clusters_without_splitting_glyphs() {
    let a = EvaluatedTextAnimator {
        cluster_weights: vec![1., 0., 0., 0.5],
        position: [10., 0., 0.],
        scale: [2., 2., 1.],
        rotation: [0., 0., 0.2],
        opacity: 0.5,
        blur: 4.,
        fill: Some(LinearRgba::new_straight(1., 0., 0., 1.)),
        stroke_width: 2.,
    };
    let out = build_text_instances(&layout(), &[a]);
    assert_eq!(out.len(), 2);
    assert_eq!(out[0].position[0], 10.);
    assert_eq!(out[0].scale[0], 2.);
    assert_eq!(out[1].position[0], 25.);
}

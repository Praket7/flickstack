use flick_render_core::{build_text_instances, EvaluatedTextAnimator, TextSelectorEval};
use flick_text::{
    FontProvenance, Glyph, GlyphRun, ResolvedFontFace, TextBounds, TextCluster, TextDirection,
    TextLayout, TextLine,
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
            font_identity: "font-face:0".into(),
            font_index: 0,
            font_size: 20.,
            font_bytes: vec![],
            rtl: false,
            normalized_variation_coords: vec![],
            clusters: vec![
                TextCluster {
                    start: 0,
                    end: 2,
                    advance: 20.,
                    line_index: 0,
                    rtl: false,
                    ligature_start: true,
                    ligature_continuation: false,
                    glyph_ids: vec![42],
                },
                TextCluster {
                    start: 3,
                    end: 6,
                    advance: 20.,
                    line_index: 0,
                    rtl: false,
                    ligature_start: false,
                    ligature_continuation: false,
                    glyph_ids: vec![43],
                },
            ],
            glyphs: vec![
                Glyph {
                    id: 42,
                    cluster_start: 0,
                    cluster_end: 2,
                    x: 0.,
                    y: 20.,
                    advance: 20.,
                    x_offset: 0.,
                    y_offset: 0.,
                },
                Glyph {
                    id: 43,
                    cluster_start: 3,
                    cluster_end: 6,
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
            resolved_faces: vec![ResolvedFontFace {
                identity: "font-face:0".into(),
                collection_index: 0,
            }],
            fallback_used: false,
        },
    }
}

#[test]
fn animator_selectors_apply_to_shaped_clusters_without_splitting_glyphs() {
    let animator = EvaluatedTextAnimator {
        selectors: vec![TextSelectorEval::IndexRange { start: 0, end: 1 }],
        position: [10., 0., 0.],
        scale: [2., 2., 1.],
        rotation: [0., 0., 0.2],
        opacity: 0.5,
        blur: 4.,
        tracking: 0.,
    };
    let out = build_text_instances(&layout(), &[animator]);
    assert_eq!(out.len(), 2);
    assert_eq!(out[0].position[0], 10.);
    assert_eq!(out[0].scale[0], 2.);
    assert_eq!((out[0].cluster_start, out[0].cluster_end), (0, 2));
    assert_eq!(out[1].position[0], 0.);
    assert_eq!(out[1].scale[0], 1.);
    assert_eq!((out[1].cluster_start, out[1].cluster_end), (3, 6));
}

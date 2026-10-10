use flick_render_core::{build_text_instances, EvaluatedTextAnimator, TextSelectorEval};
use flick_text::{
    FontProvenance, Glyph, GlyphRun, ResolvedFontFace, TextBounds, TextCluster, TextDirection,
    TextLayout, TextLine,
};
fn layout() -> TextLayout {
    TextLayout {
        text: "fi é 👨‍🚀".into(),
        lines: vec![TextLine {
            index: 0,
            baseline: 20.0,
            width: 100.0,
            bounds: TextBounds {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 24.0,
            },
        }],
        runs: vec![GlyphRun {
            font_identity: "f".into(),
            font_index: 0,
            font_size: 20.0,
            rtl: false,
            normalized_variation_coords: vec![],
            clusters: vec![
                TextCluster {
                    start: 0,
                    end: 2,
                    advance: 20.0,
                    line_index: 0,
                    rtl: false,
                    ligature_start: true,
                    ligature_continuation: false,
                    glyph_ids: vec![10],
                },
                TextCluster {
                    start: 3,
                    end: 6,
                    advance: 20.0,
                    line_index: 0,
                    rtl: false,
                    ligature_start: false,
                    ligature_continuation: false,
                    glyph_ids: vec![11],
                },
                TextCluster {
                    start: 7,
                    end: 18,
                    advance: 20.0,
                    line_index: 0,
                    rtl: false,
                    ligature_start: false,
                    ligature_continuation: false,
                    glyph_ids: vec![12],
                },
            ],
            glyphs: vec![
                Glyph {
                    id: 10,
                    cluster_start: 0,
                    cluster_end: 2,
                    x: 0.0,
                    y: 20.0,
                    advance: 20.0,
                    x_offset: 0.0,
                    y_offset: 0.0,
                },
                Glyph {
                    id: 11,
                    cluster_start: 3,
                    cluster_end: 6,
                    x: 20.0,
                    y: 20.0,
                    advance: 20.0,
                    x_offset: 0.0,
                    y_offset: 0.0,
                },
                Glyph {
                    id: 12,
                    cluster_start: 7,
                    cluster_end: 18,
                    x: 40.0,
                    y: 20.0,
                    advance: 20.0,
                    x_offset: 0.0,
                    y_offset: 0.0,
                },
            ],
        }],
        bounds: TextBounds {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 24.0,
        },
        direction: TextDirection::Ltr,
        provenance: FontProvenance {
            requested_families: vec!["x".into()],
            resolved_faces: vec![ResolvedFontFace {
                identity: "f".into(),
                collection_index: 0,
            }],
            fallback_used: false,
        },
    }
}
#[test]
fn ligature_combining_and_emoji_clusters_are_never_split() {
    let anim = EvaluatedTextAnimator {
        selectors: vec![TextSelectorEval::IndexRange { start: 1, end: 2 }],
        position: [10.0, 0.0, 0.0],
        ..Default::default()
    };
    let items = build_text_instances(&layout(), &[anim]);
    assert_eq!(items.len(), 3);
    assert_eq!(items[0].position[0], 0.0);
    assert_eq!(items[1].position[0], 10.0);
    assert_eq!(items[2].position[0], 0.0);
    assert_eq!((items[1].cluster_start, items[1].cluster_end), (3, 6));
}
#[test]
fn regex_and_seeded_selectors_are_deterministic() {
    let a = EvaluatedTextAnimator {
        selectors: vec![TextSelectorEval::Regex {
            pattern: "👨‍🚀".into(),
        }],
        opacity: 0.25,
        ..Default::default()
    };
    let x = build_text_instances(&layout(), &[a.clone()]);
    let y = build_text_instances(&layout(), &[a]);
    assert_eq!(x, y);
    assert_eq!(x[2].opacity, 0.25);
}

use flick_text::{TextAlign, TextEngine, TextLayoutRequest};

fn request(text: &str) -> TextLayoutRequest {
    TextLayoutRequest {
        text: text.into(),
        families: vec!["Arial".into(), "Noto Sans".into()],
        font_size: 40.0,
        line_height: 48.0,
        tracking: 0.0,
        max_width: Some(400.0),
        align: TextAlign::Left,
        weight: 400,
        variation_axes: vec![],
    }
}

#[test]
fn shapes_real_glyphs_clusters_and_wraps_with_metrics() {
    let mut engine = TextEngine::new();
    let layout = engine
        .layout(&request("AV office text that wraps across lines"))
        .unwrap();
    assert!(layout.bounds.width > 0.0 && layout.bounds.height >= 48.0);
    assert!(layout.lines.len() >= 2);
    assert!(layout
        .runs
        .iter()
        .flat_map(|r| &r.glyphs)
        .all(|g| g.advance.is_finite() && g.cluster_end >= g.cluster_start));
    assert!(layout
        .runs
        .iter()
        .flat_map(|r| &r.clusters)
        .all(|c| c.end >= c.start && !c.glyph_ids.is_empty()));
    assert!(!layout.provenance.resolved_faces.is_empty());
}

#[test]
fn invalid_metrics_and_pathological_text_are_rejected() {
    let mut engine = TextEngine::new();
    let mut invalid = request("text");
    invalid.font_size = f32::NAN;
    assert!(engine.layout(&invalid).is_err());
    let mut huge = request(&"x".repeat(100_001));
    huge.max_width = None;
    assert!(engine.layout(&huge).is_err());
}

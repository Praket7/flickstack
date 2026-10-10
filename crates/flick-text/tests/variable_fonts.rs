use flick_text::{TextAlign, TextEngine, TextLayoutRequest};
#[test]
fn accepts_variable_axis_request_and_exposes_normalized_coordinates() {
    let mut e = TextEngine::new();
    let r = TextLayoutRequest {
        text: "Variable".into(),
        families: vec!["Inter Variable".into(), "system-ui".into()],
        font_size: 48.0,
        line_height: 56.0,
        tracking: 0.0,
        max_width: None,
        align: TextAlign::Left,
        weight: 725,
        variation_axes: vec![("wght".into(), 725.0)],
    };
    let l = e.layout(&r).unwrap();
    assert!(l.bounds.width > 0.0);
    assert!(!l.provenance.requested_families.is_empty());
    assert!(l.runs.iter().all(|run| run.font_size > 0.0));
}

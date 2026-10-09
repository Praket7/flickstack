use flick_render_contract::{validate_program, RenderProgramV1};
#[test]
fn rejects_unknown_major_version() {
    let json=r#"{"version":2,"projectVersion":3,"projectId":"x","target":{"compositionId":"x"},"surface":{"width":1920,"height":1080,"fps":30.0,"durationFrames":1},"layers":[],"graph":{"compositionId":"x","nodes":[],"outputNodeId":"x"},"assets":[],"audioAnalyses":[],"transitions":[]}"#;
    let p:RenderProgramV1=serde_json::from_str(json).unwrap();
    assert!(validate_program(&p).is_err());
}

#[test]
fn native_cli_contract_keeps_ffmpeg_as_encoder_only() {
    let ff = include_str!("../src/ffmpeg.rs");
    assert!(ff.contains("rawvideo"));
    assert!(!ff.contains("filter_complex"));
    let render = include_str!("../src/render.rs");
    assert!(render.contains("MotionRuntime"));
    assert!(render.contains("GpuRenderer"));
}

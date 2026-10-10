use flick_preview::{FrameRange, PreviewFrame};

#[test]
fn dto_contract_is_frame_based_and_composable() {
    let frame = PreviewFrame {
        frame: 0,
        width: 2,
        height: 2,
        rgba: vec![0; 2 * 2 * 4],
    };
    assert_eq!(frame.rgba.len(), 16);
    assert_eq!((frame.width, frame.height), (2, 2));

    let range = FrameRange { start: 2, end: 4 };
    assert_eq!(range.end - range.start, 2);
}

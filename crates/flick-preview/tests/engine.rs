use flick_preview::{FrameRange, GraphSnapshot, NativeLayer};
#[test]
fn dto_contract_is_frame_based_and_composable(){
    let graph=GraphSnapshot{width:2,height:2,clear_rgba:[0,0,0,255],layers:vec![NativeLayer{rgba:[255,0,0,255],x:0,y:0,width:1,height:2,opacity:1.0}]};
    assert_eq!(graph.layers.len(),1);let range=FrameRange{start:2,end:4};assert_eq!(range.end-range.start,2);
}

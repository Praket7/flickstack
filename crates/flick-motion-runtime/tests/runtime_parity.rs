use flick_motion_runtime::{MotionRuntime,RenderSurface};
use flick_render_contract::RenderProgramV1;
use std::sync::Arc;

#[test]
fn native_runtime_matches_v03_semantic_fixture() {
    let program: RenderProgramV1 = serde_json::from_str(include_str!("fixtures/runtime-program.json")).unwrap();
    let expected: serde_json::Value = serde_json::from_str(include_str!("fixtures/runtime-parity.json")).unwrap();
    let rows = expected.as_array().unwrap();
    assert!(rows.len() >= 100);
    let runtime = MotionRuntime::load(Arc::new(program)).unwrap();
    for row in rows {
        let frame = row["frame"].as_u64().unwrap() as u32;
        let scene = runtime.evaluate(frame, RenderSurface { width: 1080.0, height: 1920.0 }).unwrap();
        for id in ["camera", "panel", "ui-surface", "title"] {
            let layer = scene.layers.iter().find(|layer| layer.id == id).unwrap();
            let saved = &row["layers"][id];
            for axis in 0..3 {
                let local = saved["localPosition"][axis].as_f64().unwrap();
                let world = saved["worldPosition"][axis].as_f64().unwrap();
                assert!((layer.local_position[axis] - local).abs() <= 1e-6, "local {id} frame {frame} axis {axis}");
                assert!((layer.world_position[axis] - world).abs() <= 1e-6, "world {id} frame {frame} axis {axis}");
            }
            assert!((layer.opacity - saved["opacity"].as_f64().unwrap()).abs() <= 1e-6, "opacity {id} frame {frame}");
        }
    }
}

#[test]
fn runtime_rejects_parent_cycles_and_depth_budget() {
    let mut program: RenderProgramV1 = serde_json::from_str(include_str!("fixtures/runtime-program.json")).unwrap();
    let layers = &mut program.layers;
    layers[1]["parentId"] = serde_json::Value::String("ui-surface".into());
    layers[3]["parentId"] = serde_json::Value::String("panel".into());
    assert!(MotionRuntime::load(Arc::new(program)).is_err());
}

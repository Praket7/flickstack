use flick_motion_runtime::{MotionRuntime, RenderSurface};
use flick_render_contract::RenderProgramV1;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedFrame {
    frame: u32,
    layers: std::collections::HashMap<String, ExpectedLayer>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedLayer {
    local_position: [f64; 3],
    world_position: [f64; 3],
    opacity: f64,
}
fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-4
}
#[test]
fn native_runtime_matches_v03_semantic_fixture() {
    let program: RenderProgramV1 =
        serde_json::from_str(include_str!("fixtures/runtime-program.json")).unwrap();
    let expected: Vec<ExpectedFrame> =
        serde_json::from_str(include_str!("fixtures/runtime-parity.json")).unwrap();
    let runtime = MotionRuntime::load(Arc::new(program)).unwrap();
    for e in expected {
        // The v0.3 TypeScript oracle generated this fixture with a constant
        // audio.energy value of 0.4. Keep that evaluation context explicit so
        // parity compares runtime semantics instead of silently changing the fixture.
        let scene = runtime
            .evaluate_with_audio(
                e.frame,
                RenderSurface {
                    width: 1080.,
                    height: 1920.,
                },
                Some([0.4, 0.0, 0.0, 0.0]),
            )
            .unwrap();
        for (id, x) in e.layers {
            let a = scene.layers.iter().find(|l| l.id == id).unwrap();
            for i in 0..3 {
                assert!(
                    close(a.local_position[i], x.local_position[i]),
                    "local {id} frame {}",
                    e.frame
                );
                assert!(
                    close(a.world_position[i], x.world_position[i]),
                    "world {id} frame {}",
                    e.frame
                );
            }
            assert!(
                close(a.opacity, x.opacity),
                "opacity {id} frame {}",
                e.frame
            );
        }
    }
}
#[test]
fn runtime_rejects_parent_cycles_and_depth_budget() {
    let mut program: RenderProgramV1 =
        serde_json::from_str(include_str!("fixtures/runtime-program.json")).unwrap();
    program.layers[0]["parentId"] = serde_json::json!(program.layers[1]["id"].as_str().unwrap());
    program.layers[1]["parentId"] = serde_json::json!(program.layers[0]["id"].as_str().unwrap());
    assert!(MotionRuntime::load(Arc::new(program)).is_err());
}

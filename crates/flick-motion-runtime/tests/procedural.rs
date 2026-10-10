use flick_motion_runtime::procedural::*;
#[test]
fn grid_is_centered_and_deterministic() {
    let d = ReplicatorDefinition {
        id: "g".into(),
        count: 4,
        distribution: ReplicatorDistribution::Grid {
            columns: 2,
            rows: Some(2),
            spacing: [100., 50.],
        },
        position_offset: None,
        rotation_offset: None,
        scale_offset: None,
        time_offset_frames: Some(2.),
        seed: 7,
    };
    let a = evaluate_replicator(&d).unwrap();
    assert_eq!(a.len(), 4);
    assert_eq!(a[0].position, [-50., -25., 0.]);
    assert_eq!(a[3].position, [50., 25., 0.]);
    assert_eq!(a[3].time_offset_frames, 6.);
    assert_eq!(a, evaluate_replicator(&d).unwrap());
}
#[test]
fn budgets_are_hard_errors() {
    let d = ReplicatorDefinition {
        id: "x".into(),
        count: MAX_PROCEDURAL_INSTANCES + 1,
        distribution: ReplicatorDistribution::Grid {
            columns: 1,
            rows: None,
            spacing: [1., 1.],
        },
        position_offset: None,
        rotation_offset: None,
        scale_offset: None,
        time_offset_frames: None,
        seed: 1,
    };
    assert!(evaluate_replicator(&d).is_err());
}

#[test]
fn circle_falloff_is_bounded() {
    let f = FalloffDefinition {
        id: "f".into(),
        kind: FalloffKind::Circle,
        center: Some([0., 0.]),
        size: None,
        radius: Some(100.),
        rotation: None,
        path: None,
        graph: Some(FalloffGraph::Linear),
        invert: None,
        combine: Some(FalloffCombine::Multiply),
        strength: Some(1.),
    };
    assert_eq!(evaluate_falloff(&f, [0., 0.]).unwrap(), 1.);
    assert_eq!(evaluate_falloff(&f, [100., 0.]).unwrap(), 0.);
}

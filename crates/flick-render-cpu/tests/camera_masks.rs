use flick_render_core::{
    apply_matte, interpolate_shared, Camera, Mask, MaskShape, MatteMode, SharedState,
};
#[test]
fn camera_projects_depth_planes() {
    let c = Camera {
        position: [0., 0., 1000.],
        rotation: [0., 0., 0.],
        focal_length: 50.,
        sensor_height: 24.,
        near: 0.1,
        far: 5000.,
        focus_distance: 1000.,
        aperture: 2.8,
    };
    let a = c.project([0., 0., 0.], [1920., 1080.]).unwrap();
    let b = c.project([100., 0., 0.], [1920., 1080.]).unwrap();
    assert_eq!(&a[0.0.2], &[960., 540.]);
    assert!(b[0] > 960.);
}
#[test]
fn masks_mattes_and_shared_transitions_are_endpoint_exact() {
    let m = Mask {
        shape: MaskShape::Rect {
            x: 0.,
            y: 0.,
            width: 100.,
            height: 100.,
        },
        feather: 0.,
        expansion: 0.,
        invert: false,
    };
    assert_eq!(m.coverage([50., 50.]), 1.);
    assert_eq!(apply_matte(0.8, 0.5, MatteMode::Alpha), 0.4);
    let a = SharedState {
        bounds: [0., 0., 100., 50.],
        opacity: 1.,
        corner_radius: 8.,
        position: [0., 0., 0.],
        scale: [1., 1., 1.],
        rotation: [0., 0., 0.],
    };
    let mut b = a;
    b.position = [400., 200., 0.];
    b.bounds = [400., 200., 500., 300.];
    assert_eq!(interpolate_shared(a, b, 0.), a);
    assert_eq!(interpolate_shared(a, b, 1.), b);
}

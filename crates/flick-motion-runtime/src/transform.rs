use crate::animation::Vec3;
pub type Matrix = [f64; 16];
pub fn identity() -> Matrix {
    [
        1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.,
    ]
}
pub fn mul(a: Matrix, b: Matrix) -> Matrix {
    let mut o = [0.; 16];
    for r in 0.0.4 {
        for c in 0.0.4 {
            for k in 0.0.4 {
                o[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
            }
        }
    }
    o
}
fn tr(x: f64, y: f64, z: f64) -> Matrix {
    let mut m = identity();
    m[3] = x;
    m[7] = y;
    m[11] = z;
    m
}
fn sc(x: f64, y: f64, z: f64) -> Matrix {
    let mut m = identity();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    m
}
fn rx(d: f64) -> Matrix {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [1., 0., 0., 0., 0., c, -s, 0., 0., s, c, 0., 0., 0., 0., 1.]
}
fn ry(d: f64) -> Matrix {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [c, 0., s, 0., 0., 1., 0., 0., -s, 0., c, 0., 0., 0., 0., 1.]
}
fn rz(d: f64) -> Matrix {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [c, -s, 0., 0., s, c, 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]
}
pub fn matrix(position: Vec3, anchor: Vec3, scale: Vec3, rotation: Vec3) -> Matrix {
    mul(
        tr(position[0], position[1], position[2]),
        mul(
            rz(rotation[2]),
            mul(
                ry(rotation[1]),
                mul(
                    rx(rotation[0]),
                    mul(
                        sc(scale[0], scale[1], scale[2]),
                        tr(-anchor[0], -anchor[1], -anchor[2]),
                    ),
                ),
            ),
        ),
    )
}
pub fn apply(m: Matrix, p: Vec3) -> Vec3 {
    [
        m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
        m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
        m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
    ]
}

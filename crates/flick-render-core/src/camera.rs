use crate::RenderError;
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub position: [f32; 3],
    pub rotation: [f32; 3],
    pub focal_length: f32,
    pub sensor_height: f32,
    pub near: f32,
    pub far: f32,
    pub focus_distance: f32,
    pub aperture: f32,
}
fn rx(v: [f32; 3], d: f32) -> [f32; 3] {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]
}
fn ry(v: [f32; 3], d: f32) -> [f32; 3] {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}
fn rz(v: [f32; 3], d: f32) -> [f32; 3] {
    let r = d.to_radians();
    let (c, s) = (r.cos(), r.sin());
    [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]
}
impl Camera {
    pub fn project(&self, p: [f32; 3], surface: [f32; 2]) -> Result<[f32; 3], RenderError> {
        let mut v = [
            p[0] - self.position[0],
            p[1] - self.position[1],
            p[2] - self.position[2],
        ];
        v = rz(v, -self.rotation[2]);
        v = ry(v, -self.rotation[1]);
        v = rx(v, -self.rotation[0]);
        let depth = -v[2];
        if depth <= self.near || depth >= self.far {
            return Err(RenderError::Invalid(
                "point outside camera clip range".into(),
            ));
        }
        let fp = self.focal_length * surface[1] / self.sensor_height.max(1e-6);
        Ok([
            surface[0] / 2. + v[0] * fp / depth,
            surface[1] / 2. - v[1] * fp / depth,
            depth,
        ])
    }
}

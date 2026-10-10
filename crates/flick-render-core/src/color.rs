use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct LinearRgba {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl LinearRgba {
    pub const TRANSPARENT: Self = Self {
        r: 0.0,
        g: 0.0,
        b: 0.0,
        a: 0.0,
    };
    pub const fn premultiplied(r: f32, g: f32, b: f32, a: f32) -> Self {
        Self { r, g, b, a }
    }
    pub fn from_unpremultiplied(r: f32, g: f32, b: f32, a: f32) -> Self {
        let a = a.clamp(0.0, 1.0);
        Self {
            r: r * a,
            g: g * a,
            b: b * a,
            a,
        }
    }
    pub fn unpremultiplied(self) -> [f32; 4] {
        if self.a <= 1e-8 {
            [0.0, 0.0, 0.0, 0.0]
        } else {
            [self.r / self.a, self.g / self.a, self.b / self.a, self.a]
        }
    }
    pub fn source_over(self, dst: Self) -> Self {
        let k = 1.0 - self.a;
        Self {
            r: self.r + dst.r * k,
            g: self.g + dst.g * k,
            b: self.b + dst.b * k,
            a: self.a + dst.a * k,
        }
    }
    pub fn scale_alpha(self, alpha: f32) -> Self {
        let k = alpha.clamp(0.0, 1.0);
        Self {
            r: self.r * k,
            g: self.g * k,
            b: self.b * k,
            a: self.a * k,
        }
    }
    pub fn luminance(self) -> f32 {
        let u = self.unpremultiplied();
        0.2126 * u[0] + 0.7152 * u[1] + 0.0722 * u[2]
    }
}

pub fn srgb_to_linear(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}
pub fn linear_to_srgb(v: f32) -> f32 {
    let v = v.max(0.0);
    if v <= 0.0031308 {
        12.92 * v
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    }
}
pub fn from_srgb8(r: u8, g: u8, b: u8, a: u8) -> LinearRgba {
    let af = a as f32 / 255.0;
    LinearRgba::from_unpremultiplied(
        srgb_to_linear(r as f32 / 255.0),
        srgb_to_linear(g as f32 / 255.0),
        srgb_to_linear(b as f32 / 255.0),
        af,
    )
}
pub fn to_srgb8(c: LinearRgba) -> [u8; 4] {
    let u = c.unpremultiplied();
    [
        (linear_to_srgb(u[0]).clamp(0.0, 1.0) * 255.0 + 0.5) as u8,
        (linear_to_srgb(u[1]).clamp(0.0, 1.0) * 255.0 + 0.5) as u8,
        (linear_to_srgb(u[2]).clamp(0.0, 1.0) * 255.0 + 0.5) as u8,
        (u[3].clamp(0.0, 1.0) * 255.0 + 0.5) as u8,
    ]
}

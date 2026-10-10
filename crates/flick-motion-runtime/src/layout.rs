use crate::animation::Vec3;
use serde_json::Value;

#[derive(Debug, Clone, Copy)]
pub struct Surface {
    pub width: f64,
    pub height: f64,
}
pub fn aspect(s: Surface) -> &'static str {
    let r = s.width / s.height;
    if (r - 1.0).abs() <= 0.03 {
        "square"
    } else if (r - 0.8).abs() <= 0.035 {
        "four-five"
    } else if r >= 1.2 {
        "landscape"
    } else if r <= 0.75 {
        "portrait"
    } else {
        "custom"
    }
}
pub fn layout_offset(layer: &Value, variants: Option<&Vec<Value>>, surface: Surface) -> [f64; 2] {
    let id = layer.get("id").and_then(Value::as_str).unwrap_or("");
    let Some(v) = variants.and_then(|vs| {
        vs.iter()
            .find(|v| v.get("aspect").and_then(Value::as_str) == Some(aspect(surface)))
    }) else {
        return [0., 0.];
    };
    let Some(cs) = v
        .get("constraintsByLayer")
        .and_then(|x| x.get(id))
        .and_then(Value::as_array)
    else {
        return [0., 0.];
    };
    let mut x = 0.;
    let mut y = 0.;
    for c in cs {
        match c.get("type").and_then(Value::as_str) {
            Some("pin-left") => x = c.get("value").and_then(Value::as_f64).unwrap_or(0.),
            Some("pin-top") => y = c.get("value").and_then(Value::as_f64).unwrap_or(0.),
            _ => {}
        }
    }
    [x, y]
}

pub fn resolve(
    mut pos: Vec3,
    width: f64,
    height: f64,
    safe: [f64; 4],
    constraints: Option<&Value>,
) -> Vec3 {
    let Some(cs) = constraints.and_then(Value::as_array) else {
        return pos;
    };
    let [l, t, r, b] = safe;
    let safe_width = width - l - r;
    let safe_height = height - t - b;
    for c in cs {
        let value = c.get("value").and_then(Value::as_f64).unwrap_or(0.0);
        match c.get("type").and_then(Value::as_str).unwrap_or("") {
            "pin-left" => pos[0] += l + value,
            "pin-right" => pos[0] += width - r - value,
            "pin-top" => pos[1] += t + value,
            "pin-bottom" => pos[1] += height - b - value,
            "center-x" => pos[0] += l + safe_width / 2.0 + value,
            "center-y" => pos[1] += t + safe_height / 2.0 + value,
            "scale-with-width" => pos[0] *= safe_width / 1920.0,
            "scale-with-height" => pos[1] *= safe_height / 1080.0,
            _ => {}
        }
    }
    pos
}

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

use serde_json::Value;

pub type Vec3 = [f64; 3];
fn clamp01(v: f64) -> f64 {
    v.clamp(0.0, 1.0)
}
fn cubic(a: f64, b: f64, c: f64, d: f64, t: f64) -> f64 {
    let u = 1.0 - t;
    u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d
}
fn cubic_d(a: f64, b: f64, c: f64, d: f64, t: f64) -> f64 {
    let u = 1.0 - t;
    3.0 * u * u * (b - a) + 6.0 * u * t * (c - b) + 3.0 * t * t * (d - c)
}
fn bezier_progress(x: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let x = clamp01(x);
    if x <= 0.0 {
        return 0.0;
    }
    if x >= 1.0 {
        return 1.0;
    }
    let mut t = x;
    for _ in 0..8 {
        let bx = cubic(0.0, x1, x2, 1.0, t);
        let d = cubic_d(0.0, x1, x2, 1.0, t);
        if d.abs() < 1e-7 {
            break;
        }
        t = clamp01(t - (bx - x) / d)
    }
    let (mut lo, mut hi) = (0.0, 1.0);
    for _ in 0..16 {
        let bx = cubic(0.0, x1, x2, 1.0, t);
        if (bx - x).abs() < 1e-7 {
            break;
        }
        if bx < x {
            lo = t
        } else {
            hi = t
        }
        t = (lo + hi) / 2.0
    }
    cubic(0.0, y1, y2, 1.0, t)
}
fn tangent(k: &Value, name: &str, default: [f64; 2]) -> [f64; 2] {
    k.get(name)
        .and_then(Value::as_object)
        .map(|o| {
            [
                o.get("x").and_then(Value::as_f64).unwrap_or(default[0]),
                o.get("y").and_then(Value::as_f64).unwrap_or(default[1]),
            ]
        })
        .unwrap_or(default)
}
fn easing(kind: &str, t: f64, a: &Value, b: &Value) -> f64 {
    let t = clamp01(t);
    if t == 0.0 || t == 1.0 {
        return t;
    }
    match kind {
        "hold" => 0.0,
        "linear" => t,
        "bezier" => {
            let out = tangent(a, "outTangent", [0.33, 0.33]);
            let inc = tangent(b, "inTangent", [0.67, 0.67]);
            bezier_progress(t, clamp01(out[0]), out[1], clamp01(inc[0]), inc[1])
        }
        "auto-bezier" => t * t * (3.0 - 2.0 * t),
        "continuous-bezier" => bezier_progress(t, 0.42, 0.0, 0.58, 1.0),
        "ease" => bezier_progress(t, 0.25, 0.1, 0.25, 1.0),
        "expo-in" => 2f64.powf(10.0 * (t - 1.0)),
        "expo-out" => 1.0 - 2f64.powf(-10.0 * t),
        "expo-in-out" => {
            if t < 0.5 {
                2f64.powf(20.0 * t - 10.0) / 2.0
            } else {
                (2.0 - 2f64.powf(-20.0 * t + 10.0)) / 2.0
            }
        }
        "spring" => {
            let raw = 1.0 - (-6.0 * t).exp() * (12.0 * t).cos();
            let end = 1.0 - (-6.0f64).exp() * 12.0f64.cos();
            raw / end
        }
        "damped-overshoot" => {
            let raw = 1.0 - (-5.0 * t).exp() * ((9.0 * t).cos() + 0.35 * (9.0 * t).sin());
            let end = 1.0 - (-5.0f64).exp() * (9.0f64.cos() + 0.35 * 9.0f64.sin());
            raw / end
        }
        _ => t,
    }
}
fn frames(prop: &Value) -> Vec<&Value> {
    let mut v: Vec<&Value> = prop
        .get("keyframes")
        .and_then(Value::as_array)
        .map(|a| a.iter().collect())
        .unwrap_or_default();
    v.sort_by_key(|k| k.get("frame").and_then(Value::as_i64).unwrap_or(0));
    v
}
pub fn eval_number(prop: &Value, frame: f64) -> f64 {
    let base = prop.get("baseValue").and_then(Value::as_f64).unwrap_or(0.0);
    let fs = frames(prop);
    if fs.is_empty() {
        return base;
    }
    let first = fs[0];
    let last = *fs.last().unwrap();
    let ff = first.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
    let lf = last.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
    if frame <= ff {
        return first.get("value").and_then(Value::as_f64).unwrap_or(base);
    }
    if frame >= lf {
        return last.get("value").and_then(Value::as_f64).unwrap_or(base);
    }
    for w in fs.windows(2) {
        let a = w[0];
        let b = w[1];
        let af = a.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
        let bf = b.get("frame").and_then(Value::as_f64).unwrap_or(af + 1.0);
        if frame <= bf {
            let av = a.get("value").and_then(Value::as_f64).unwrap_or(base);
            let bv = b.get("value").and_then(Value::as_f64).unwrap_or(av);
            let t = (frame - af) / (bf - af).max(1e-9);
            let e = easing(
                a.get("interpolation")
                    .and_then(Value::as_str)
                    .unwrap_or("linear"),
                t,
                a,
                b,
            );
            return av + (bv - av) * e;
        }
    }
    base
}
fn val_vec(v: &Value, default: Vec3) -> Vec3 {
    v.as_array()
        .map(|a| {
            [
                a.first().and_then(Value::as_f64).unwrap_or(default[0]),
                a.get(1).and_then(Value::as_f64).unwrap_or(default[1]),
                a.get(2).and_then(Value::as_f64).unwrap_or(default[2]),
            ]
        })
        .unwrap_or(default)
}
pub fn eval_vec3(prop: &Value, frame: f64) -> Vec3 {
    let base = val_vec(
        prop.get("baseValue").unwrap_or(&Value::Null),
        [0.0, 0.0, 0.0],
    );
    let fs = frames(prop);
    if fs.is_empty() {
        return base;
    }
    let first = fs[0];
    let last = *fs.last().unwrap();
    let ff = first.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
    let lf = last.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
    if frame <= ff {
        return val_vec(first.get("value").unwrap_or(&Value::Null), base);
    }
    if frame >= lf {
        return val_vec(last.get("value").unwrap_or(&Value::Null), base);
    }
    for w in fs.windows(2) {
        let a = w[0];
        let b = w[1];
        let af = a.get("frame").and_then(Value::as_f64).unwrap_or(0.0);
        let bf = b.get("frame").and_then(Value::as_f64).unwrap_or(af + 1.0);
        if frame <= bf {
            let av = val_vec(a.get("value").unwrap_or(&Value::Null), base);
            let bv = val_vec(b.get("value").unwrap_or(&Value::Null), av);
            let t = (frame - af) / (bf - af).max(1e-9);
            let e = easing(
                a.get("interpolation")
                    .and_then(Value::as_str)
                    .unwrap_or("linear"),
                t,
                a,
                b,
            );
            return [
                av[0] + (bv[0] - av[0]) * e,
                av[1] + (bv[1] - av[1]) * e,
                av[2] + (bv[2] - av[2]) * e,
            ];
        }
    }
    base
}

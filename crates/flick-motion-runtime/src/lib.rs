pub mod animation;
pub mod behaviors;
pub mod expression;
pub mod layout;
pub mod procedural;
pub mod rigs;
pub mod transform;
use animation::{eval_number, eval_vec3, Vec3};
use behaviors::{apply_number, apply_vec3, BehaviorContext};
use flick_render_contract::RenderProgramV1;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use thiserror::Error;
use transform::{apply, matrix, mul, Matrix};

type LocalLayerState = (
    Vec3,
    Vec3,
    Vec3,
    Vec3,
    f64,
    Matrix,
    String,
    i64,
    Option<String>,
);

#[derive(Debug, Clone, Copy)]
pub struct RenderSurface {
    pub width: f64,
    pub height: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatedLayer {
    pub id: String,
    pub kind: String,
    pub local_position: Vec3,
    pub world_position: Vec3,
    pub local_scale: Vec3,
    pub local_rotation: Vec3,
    pub opacity: f64,
    pub matrix: [f64; 16],
    pub z_index: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatedScene {
    pub composition_id: String,
    pub frame: u32,
    pub width: f64,
    pub height: f64,
    pub background: String,
    pub layers: Vec<EvaluatedLayer>,
}
#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("frame outside composition")]
    Frame,
    #[error("invalid layer {0}")]
    Layer(String),
    #[error("parent cycle at {0}")]
    Cycle(String),
    #[error("runtime budget exceeded")]
    Budget,
}

fn validate_parent_graph(layers: &[Value], max_depth: usize) -> Result<(), RuntimeError> {
    let mut parents = HashMap::<String, Option<String>>::new();
    for layer in layers {
        let id = layer
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| RuntimeError::Layer("missing id".into()))?
            .to_string();
        let parent = layer
            .get("parentId")
            .and_then(Value::as_str)
            .map(str::to_string);
        parents.insert(id, parent);
    }
    for id in parents.keys() {
        let mut seen = HashSet::<String>::new();
        let mut current = Some(id.as_str());
        let mut depth = 0usize;
        while let Some(node) = current {
            if !seen.insert(node.to_string()) {
                return Err(RuntimeError::Cycle(node.to_string()));
            }
            depth += 1;
            if depth > max_depth {
                return Err(RuntimeError::Budget);
            }
            current = parents.get(node).and_then(|parent| parent.as_deref());
        }
    }
    Ok(())
}

fn aspect_ratio(value: &Value) -> Option<f64> {
    let aspect = value.get("aspect")?.as_str()?;
    let (width, height) = aspect.split_once(':')?;
    let width = width.parse::<f64>().ok()?;
    let height = height.parse::<f64>().ok()?;
    (height.abs() > f64::EPSILON).then_some(width / height)
}

fn safe_area(value: &Value) -> [f64; 4] {
    let Some(values) = value.get("safeArea").and_then(Value::as_array) else {
        return [0.0; 4];
    };
    [0usize, 1, 2, 3].map(|index| values.get(index).and_then(Value::as_f64).unwrap_or(0.0))
}

pub struct MotionRuntime {
    program: Arc<RenderProgramV1>,
    max_depth: usize,
    max_layers: usize,
}
impl MotionRuntime {
    pub fn load(program: Arc<RenderProgramV1>) -> Result<Self, RuntimeError> {
        const MAX_DEPTH: usize = 128;
        if program.layers.len() > 4096 {
            return Err(RuntimeError::Budget);
        }
        validate_parent_graph(&program.layers, MAX_DEPTH)?;
        Ok(Self {
            program,
            max_depth: MAX_DEPTH,
            max_layers: 4096,
        })
    }
    pub fn evaluate(
        &self,
        frame: u32,
        surface: RenderSurface,
    ) -> Result<EvaluatedScene, RuntimeError> {
        if frame as f64 >= self.program.surface.duration_frames {
            return Err(RuntimeError::Frame);
        }
        if self.program.layers.len() > self.max_layers {
            return Err(RuntimeError::Budget);
        }
        let target_aspect = if surface.height.abs() > f64::EPSILON {
            surface.width / surface.height
        } else {
            1.0
        };
        let layout_variant = self
            .program
            .extra
            .get("layoutVariants")
            .and_then(Value::as_array)
            .and_then(|variants| {
                variants.iter().min_by(|a, b| {
                    let da = aspect_ratio(a)
                        .map(|ratio| (ratio - target_aspect).abs())
                        .unwrap_or(f64::INFINITY);
                    let db = aspect_ratio(b)
                        .map(|ratio| (ratio - target_aspect).abs())
                        .unwrap_or(f64::INFINITY);
                    da.total_cmp(&db)
                })
            });
        let mut local = HashMap::<String, LocalLayerState>::new();
        for (index, l) in self.program.layers.iter().enumerate() {
            let id = l
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| RuntimeError::Layer("missing id".into()))?
                .to_string();
            let start = l.get("start").and_then(Value::as_f64).unwrap_or(0.);
            let duration = l.get("duration").and_then(Value::as_f64).unwrap_or(0.);
            if (frame as f64) < start || (frame as f64) >= start + duration {
                continue;
            }
            let tr = l.get("transform").unwrap_or(&Value::Null);
            let ctx = BehaviorContext {
                frame: frame as f64,
                start,
                duration,
                index,
                count: self.program.layers.len(),
                seed: 0.,
                energy: 0.,
                low: 0.,
                mid: 0.,
                high: 0.,
            };
            let ep = |name: &str, default: Vec3| {
                let p = tr.get(name).unwrap_or(&Value::Null);
                let mut v = if p.is_null() {
                    default
                } else {
                    eval_vec3(p, frame as f64)
                };
                v = apply_vec3(v, p.get("behaviors").and_then(Value::as_array), ctx);
                v
            };
            let mut position = ep("position", [0., 0., 0.]);
            if let Some(variant) = layout_variant {
                let constraint = variant
                    .get("constraintsByLayer")
                    .and_then(|constraints| constraints.get(&id));
                position = layout::resolve(
                    position,
                    surface.width,
                    surface.height,
                    safe_area(variant),
                    constraint,
                );
            }
            let anchor = ep("anchor", [0., 0., 0.]);
            let scale = ep("scale", [1., 1., 1.]);
            let mut rotation = ep("rotation", [0., 0., 0.]);
            let orientation = ep("orientation", [0., 0., 0.]);
            for i in 0..3 {
                rotation[i] += orientation[i]
            }
            let op = l.get("opacity").unwrap_or(&Value::Null);
            let opacity = (if op.is_null() {
                1.
            } else {
                apply_number(
                    eval_number(op, frame as f64),
                    op.get("behaviors").and_then(Value::as_array),
                    ctx,
                )
            })
            .clamp(0., 1.);
            let m = matrix(position, anchor, scale, rotation);
            local.insert(
                id,
                (
                    position,
                    anchor,
                    scale,
                    rotation,
                    opacity,
                    m,
                    l.get("kind")
                        .and_then(Value::as_str)
                        .unwrap_or("group")
                        .into(),
                    l.get("zIndex").and_then(Value::as_i64).unwrap_or(0),
                    l.get("parentId")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                ),
            );
        }
        let mut world = HashMap::<String, Matrix>::new();
        fn world_for(
            id: &str,
            local: &HashMap<String, LocalLayerState>,
            world: &mut HashMap<String, Matrix>,
            vis: &mut HashSet<String>,
            depth: usize,
            max_depth: usize,
        ) -> Result<Matrix, RuntimeError> {
            if depth > max_depth {
                return Err(RuntimeError::Budget);
            }
            if let Some(m) = world.get(id) {
                return Ok(*m);
            }
            if !vis.insert(id.into()) {
                return Err(RuntimeError::Cycle(id.into()));
            }
            let item = local
                .get(id)
                .ok_or_else(|| RuntimeError::Layer(id.into()))?;
            let m = if let Some(p) = &item.8 {
                mul(
                    world_for(p, local, world, vis, depth + 1, max_depth)?,
                    item.5,
                )
            } else {
                item.5
            };
            vis.remove(id);
            world.insert(id.into(), m);
            Ok(m)
        }
        let mut layers = Vec::new();
        for (id, item) in &local {
            let m = world_for(
                id,
                &local,
                &mut world,
                &mut HashSet::new(),
                0,
                self.max_depth,
            )?;
            layers.push(EvaluatedLayer {
                id: id.clone(),
                kind: item.6.clone(),
                local_position: item.0,
                world_position: apply(m, [0., 0., 0.]),
                local_scale: item.2,
                local_rotation: item.3,
                opacity: item.4,
                matrix: m,
                z_index: item.7,
            });
        }
        layers.sort_by(|a, b| a.z_index.cmp(&b.z_index).then_with(|| a.id.cmp(&b.id)));
        Ok(EvaluatedScene {
            composition_id: self.program.target.composition_id.clone(),
            frame,
            width: surface.width,
            height: surface.height,
            background: self.program.surface.background.clone(),
            layers,
        })
    }
}

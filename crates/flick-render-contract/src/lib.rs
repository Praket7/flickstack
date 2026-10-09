use serde::{Deserialize,Serialize};
use serde_json::Value;
use std::collections::{HashMap,HashSet};
use thiserror::Error;

#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Target { pub composition_id:String }
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Surface { pub width:f64,pub height:f64,pub fps:f64,pub duration_frames:f64,pub background:String }
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct Limits { #[serde(rename="maxLayers")] pub max_layers:usize, #[serde(rename="maxPathPoints")] pub max_path_points:usize, #[serde(rename="maxMasks")] pub max_masks:usize, #[serde(rename="maxEffectNodes")] pub max_effect_nodes:usize, #[serde(rename="maxTextureDimension")] pub max_texture_dimension:usize }
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct GraphNode { pub id:String, #[serde(default)] pub upstream:Vec<String>, #[serde(flatten)] pub rest:HashMap<String,Value> }
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct RenderGraph { pub composition_id:String,pub nodes:Vec<GraphNode>,pub output_node_id:String,#[serde(default)]pub audio_output_node_id:Option<String> }
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct RenderProgramV1 {
 pub version:u32,pub project_version:u32,pub project_id:String,pub target:Target,pub surface:Surface,
 #[serde(default)]pub layers:Vec<Value>,pub graph:RenderGraph,#[serde(default)]pub assets:Vec<Value>,#[serde(default)]pub audio_analyses:Vec<Value>,#[serde(default)]pub transitions:Vec<Value>,#[serde(default)]pub limits:Option<Limits>,
 #[serde(flatten)]pub extra:HashMap<String,Value>,
}
#[derive(Debug,Error)]pub enum ContractError { #[error("unsupported RenderProgram major version {0}")]Version(u32),#[error("non-finite or invalid surface")]Surface,#[error("graph cycle at {0}")]Cycle(String),#[error("layer limit exceeded")]LayerLimit }
fn dfs(id:&str,map:&HashMap<&str,&GraphNode>,visiting:&mut HashSet<String>,done:&mut HashSet<String>)->Result<(),ContractError>{if done.contains(id){return Ok(())}if !visiting.insert(id.to_string()){return Err(ContractError::Cycle(id.into()))}if let Some(n)=map.get(id){for u in &n.upstream{if map.contains_key(u.as_str()){dfs(u,map,visiting,done)?;}}}visiting.remove(id);done.insert(id.into());Ok(())}
pub fn validate_program(p:&RenderProgramV1)->Result<(),ContractError>{if p.version!=1{return Err(ContractError::Version(p.version))}if p.project_version!=3||!p.surface.width.is_finite()||!p.surface.height.is_finite()||!p.surface.fps.is_finite()||p.surface.width<=0.0||p.surface.height<=0.0||p.surface.fps<=0.0{return Err(ContractError::Surface)}if let Some(l)=&p.limits{if p.layers.len()>l.max_layers{return Err(ContractError::LayerLimit)}}let map:HashMap<&str,&GraphNode>=p.graph.nodes.iter().map(|n|(n.id.as_str(),n)).collect();let mut visiting=HashSet::new();let mut done=HashSet::new();for n in &p.graph.nodes{dfs(&n.id,&map,&mut visiting,&mut done)?;}Ok(())}

use crate::RenderError;
pub const MAX_INSTANCE_BATCH:usize=10_000;
#[derive(Debug,Clone,PartialEq)]pub struct InstanceTransform{pub position:[f64;3],pub rotation:[f64;3],pub scale:[f64;3],pub opacity:f64,pub index:u32}
#[derive(Debug,Clone,PartialEq)]pub struct InstanceBatch{pub source_id:String,pub instances:Vec<InstanceTransform>}
impl InstanceBatch{pub fn new(source_id:impl Into<String>,instances:Vec<InstanceTransform>)->Result<Self,RenderError>{if instances.len()>MAX_INSTANCE_BATCH{return Err(RenderError::Budget)}Ok(Self{source_id:source_id.into(),instances})}}

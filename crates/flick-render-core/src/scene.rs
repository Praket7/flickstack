use crate::{color::LinearRgba,paint::Paint,text::GlyphInstance,vector::VectorPrimitive};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FontResource{pub identity:String,pub index:u32,#[serde(skip)]pub bytes:Vec<u8>}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextPrimitive{pub glyphs:Vec<GlyphInstance>,pub paint:Paint,pub opacity:f32}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Primitive{Vector(VectorPrimitive),Text(TextPrimitive)}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SceneLayer{pub id:String,pub z_index:i32,pub opacity:f32,pub primitive:Primitive}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EvaluatedScene{pub width:u32,pub height:u32,pub background:LinearRgba,pub layers:Vec<SceneLayer>,#[serde(skip)]pub fonts:Vec<FontResource>}
#[derive(Clone, Debug, PartialEq)]
pub struct RgbaFrame{pub width:u32,pub height:u32,pub pixels:Vec<LinearRgba>}
impl RgbaFrame{pub fn new(width:u32,height:u32,clear:LinearRgba)->Self{Self{width,height,pixels:vec![clear;width as usize*height as usize]}}pub fn get(&self,x:u32,y:u32)->LinearRgba{self.pixels[(y*self.width+x)as usize]}pub fn get_mut(&mut self,x:u32,y:u32)->&mut LinearRgba{&mut self.pixels[(y*self.width+x)as usize]}pub fn to_srgba8(&self)->Vec<u8>{let mut out=Vec::with_capacity(self.pixels.len()*4);for pixel in &self.pixels{out.extend_from_slice(&crate::color::to_srgb8(*pixel));}out}}

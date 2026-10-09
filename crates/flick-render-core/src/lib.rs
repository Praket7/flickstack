pub mod camera;pub mod color;pub mod effects;pub mod instances;pub mod mask;pub mod matte;pub mod paint;pub mod scene;pub mod text;pub mod transition;pub mod vector;
pub use camera::*;pub use color::*;pub use effects::*;pub use instances::*;pub use mask::*;pub use matte::*;pub use paint::*;pub use scene::*;pub use text::*;pub use transition::*;pub use vector::*;
use thiserror::Error;
#[derive(Debug,Error)]pub enum RenderError{#[error("invalid render surface")]InvalidSurface,#[error("invalid render state: {0}")]Invalid(String),#[error("render allocation budget exceeded")]Budget,#[error("missing font resource {0}")]MissingFont(String),#[error("GPU device error: {0}")]Device(String),#[error("renderer backend error: {0}")]Backend(String)}

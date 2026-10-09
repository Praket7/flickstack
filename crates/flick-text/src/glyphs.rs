use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Glyph {
    pub id: u32,
    /// UTF-8 byte range of the atomic shaping cluster that owns this glyph.
    pub cluster_start: usize,
    pub cluster_end: usize,
    pub x: f32,
    pub y: f32,
    pub advance: f32,
    pub x_offset: f32,
    pub y_offset: f32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextCluster {
    pub start: usize,
    pub end: usize,
    pub advance: f32,
    pub line_index: usize,
    pub rtl: bool,
    pub ligature_start: bool,
    pub ligature_continuation: bool,
    pub glyph_ids: Vec<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GlyphRun {
    /// Stable identity inside the resolved font resource set. The renderer must
    /// use the font bytes referenced by this identity rather than guessing a
    /// family from UI text.
    pub font_identity: String,
    pub font_index: u32,
    pub font_size: f32,
    /// Resolved font bytes retained in-memory for render-core. Omitted from serialized layout diagnostics.
    #[serde(skip, default)]
    pub font_bytes: Vec<u8>,
    pub rtl: bool,
    pub normalized_variation_coords: Vec<i16>,
    pub glyphs: Vec<Glyph>,
    pub clusters: Vec<TextCluster>,
}

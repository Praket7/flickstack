use crate::{layout::layout_text, TextError, TextLayout, TextLayoutRequest};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontRequest {
    pub families: Vec<String>,
    pub weight: u16,
    pub style: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolvedFontFace {
    pub identity: String,
    pub collection_index: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontProvenance {
    pub requested_families: Vec<String>,
    pub resolved_faces: Vec<ResolvedFontFace>,
    /// True whenever shaping required more than the primary resolved face.
    /// The exact fallback family name is platform font-database metadata and
    /// is intentionally not inferred from the request string.
    pub fallback_used: bool,
}

/// Production text engine. Font and layout contexts are retained so shaping
/// caches and discovered system-font state survive frame-to-frame evaluation.
pub struct TextEngine {
    pub(crate) fonts: parley::FontContext,
    pub(crate) layout: parley::LayoutContext<()>,
}

impl Default for TextEngine {
    fn default() -> Self {
        Self { fonts: parley::FontContext::new(), layout: parley::LayoutContext::new() }
    }
}

impl TextEngine {
    pub fn new() -> Self { Self::default() }

    pub fn layout(&mut self, request: &TextLayoutRequest) -> Result<TextLayout, TextError> {
        layout_text(&mut self.fonts, &mut self.layout, request)
    }
}

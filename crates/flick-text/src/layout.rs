use crate::{FontProvenance, Glyph, GlyphRun, ResolvedFontFace, TextBounds, TextCluster};
use parley::{
    Alignment, AlignmentOptions, FontFamily, FontVariations, FontWeight, LineHeight,
    PositionedLayoutItem, StyleProperty,
};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use thiserror::Error;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TextAlign {
    Left,
    Center,
    Right,
    Justify,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TextDirection {
    Ltr,
    Rtl,
    Mixed,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextLayoutRequest {
    pub text: String,
    pub families: Vec<String>,
    pub font_size: f32,
    pub line_height: f32,
    pub tracking: f32,
    pub max_width: Option<f32>,
    pub align: TextAlign,
    pub weight: u16,
    #[serde(default)]
    pub variation_axes: Vec<(String, f32)>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextLine {
    pub index: usize,
    pub baseline: f32,
    pub width: f32,
    pub bounds: TextBounds,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextLayout {
    pub text: String,
    pub lines: Vec<TextLine>,
    pub runs: Vec<GlyphRun>,
    pub bounds: TextBounds,
    pub direction: TextDirection,
    pub provenance: FontProvenance,
}
#[derive(Debug, Error)]
pub enum TextError {
    #[error("font size and line height must be finite and positive")]
    InvalidMetrics,
    #[error("text layout exceeds safety budget")]
    BudgetExceeded,
    #[error("text shaping failed: {0}")]
    Shape(String),
}
fn direction(text: &str) -> TextDirection {
    let rtl = text.chars().any(|c| matches!(c as u32, 0x0590..=0x08ff));
    let ltr = text
        .chars()
        .any(|c| c.is_ascii_alphabetic() || matches!(c as u32, 0x00c0..=0x02af));
    match (ltr, rtl) {
        (true, true) => TextDirection::Mixed,
        (false, true) => TextDirection::Rtl,
        _ => TextDirection::Ltr,
    }
}
fn family_source(families: &[String]) -> String {
    if families.is_empty() {
        return "sans-serif".into();
    }
    let mut values: Vec<String> = families
        .iter()
        .map(|family| format!("\"{}\"", family.replace('"', "\\\"")))
        .collect();
    values.push("sans-serif".into());
    values.join(", ")
}
fn variation_source(axes: &[(String, f32)]) -> String {
    axes.iter()
        .filter(|(tag, value)| tag.len() == 4 && value.is_finite())
        .map(|(tag, value)| format!("\"{tag}\" {value}"))
        .collect::<Vec<_>>()
        .join(", ")
}
pub(crate) fn layout_text(
    fonts: &mut parley::FontContext,
    layout_cx: &mut parley::LayoutContext<()>,
    request: &TextLayoutRequest,
) -> Result<TextLayout, TextError> {
    if !request.font_size.is_finite()
        || request.font_size <= 0.0
        || !request.line_height.is_finite()
        || request.line_height <= 0.0
        || !request.tracking.is_finite()
        || request
            .max_width
            .is_some_and(|w| !w.is_finite() || w <= 0.0)
    {
        return Err(TextError::InvalidMetrics);
    }
    if request.text.chars().count() > 100_000
        || request.families.len() > 32
        || request.variation_axes.len() > 32
    {
        return Err(TextError::BudgetExceeded);
    }
    let mut builder = layout_cx.ranged_builder(fonts, &request.text, 1.0, true);
    builder.push_default(StyleProperty::FontSize(request.font_size));
    builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(
        request.line_height,
    )));
    builder.push_default(StyleProperty::FontWeight(FontWeight::new(
        request.weight as f32,
    )));
    builder.push_default(StyleProperty::FontFamily(FontFamily::Source(Cow::Owned(
        family_source(&request.families),
    ))));
    if request.tracking != 0.0 {
        builder.push_default(StyleProperty::LetterSpacing(request.tracking));
    }
    let variation_css = variation_source(&request.variation_axes);
    if !variation_css.is_empty() {
        builder.push_default(StyleProperty::FontVariations(FontVariations::Source(
            Cow::Owned(variation_css),
        )));
    }
    let mut layout = builder.build(&request.text);
    layout.break_all_lines(request.max_width);
    let align = match request.align {
        TextAlign::Left => Alignment::Start,
        TextAlign::Center => Alignment::Center,
        TextAlign::Right => Alignment::End,
        TextAlign::Justify => Alignment::Justify,
    };
    layout.align(align, AlignmentOptions::default());
    let mut runs = Vec::new();
    let mut lines = Vec::new();
    let mut resolved_faces = Vec::<ResolvedFontFace>::new();
    for (line_index, line) in layout.lines().enumerate() {
        let metrics = line.metrics();
        lines.push(TextLine {
            index: line_index,
            baseline: metrics.baseline,
            width: metrics.advance,
            bounds: TextBounds {
                x: metrics.inline_min_coord + metrics.offset,
                y: metrics.block_min_coord,
                width: (metrics.inline_max_coord - metrics.inline_min_coord).max(0.0),
                height: (metrics.block_max_coord - metrics.block_min_coord).max(0.0),
            },
        });
        for item in line.items() {
            let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
                continue;
            };
            let run = glyph_run.run();
            let face = run.font();
            let identity = format!("font-face:{}", face.index);
            if !resolved_faces
                .iter()
                .any(|entry| entry.identity == identity)
            {
                resolved_faces.push(ResolvedFontFace {
                    identity: identity.clone(),
                    collection_index: face.index,
                });
            }
            let mut clusters = Vec::new();
            for cluster in run.visual_clusters() {
                let range = cluster.text_range();
                clusters.push(TextCluster {
                    start: range.start,
                    end: range.end,
                    advance: cluster.advance(),
                    line_index,
                    rtl: cluster.is_rtl(),
                    ligature_start: cluster.is_ligature_start(),
                    ligature_continuation: cluster.is_ligature_continuation(),
                    glyph_ids: cluster.glyphs().map(|glyph| glyph.id).collect(),
                });
            }
            let positioned: Vec<_> = glyph_run.positioned_glyphs().collect();
            let mut glyphs = Vec::with_capacity(positioned.len());
            let mut cluster_iter = run.visual_clusters();
            let mut current_cluster = cluster_iter.next();
            let mut glyphs_remaining = current_cluster
                .as_ref()
                .map(|c| c.glyphs().count())
                .unwrap_or(0);
            for glyph in positioned {
                while glyphs_remaining == 0 {
                    current_cluster = cluster_iter.next();
                    glyphs_remaining = current_cluster
                        .as_ref()
                        .map(|c| c.glyphs().count())
                        .unwrap_or(0);
                    if current_cluster.is_none() {
                        break;
                    }
                }
                let range = current_cluster
                    .as_ref()
                    .map(|c| c.text_range())
                    .unwrap_or(run.text_range());
                glyphs.push(Glyph {
                    id: glyph.id,
                    cluster_start: range.start,
                    cluster_end: range.end,
                    x: glyph.x,
                    y: glyph.y,
                    advance: glyph.advance,
                    x_offset: 0.0,
                    y_offset: 0.0,
                });
                glyphs_remaining = glyphs_remaining.saturating_sub(1);
            }
            runs.push(GlyphRun {
                font_identity: identity,
                font_index: face.index,
                font_size: run.font_size(),
                font_bytes: face.data.as_ref().to_vec(),
                rtl: run.is_rtl(),
                normalized_variation_coords: run.normalized_coords().to_vec(),
                glyphs,
                clusters,
            });
        }
    }
    let bounds = TextBounds {
        x: 0.0,
        y: 0.0,
        width: layout.width(),
        height: layout.height(),
    };
    let requested_families = if request.families.is_empty() {
        vec!["sans-serif".into()]
    } else {
        request.families.clone()
    };
    let fallback_used = resolved_faces.len() > 1;
    Ok(TextLayout {
        text: request.text.clone(),
        lines,
        runs,
        bounds,
        direction: direction(&request.text),
        provenance: FontProvenance {
            requested_families,
            resolved_faces,
            fallback_used,
        },
    })
}

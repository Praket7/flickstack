use flick_text::{Glyph as ShapedGlyph, TextLayout};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum TextSelectorEval {
    Characters { start: usize, end: usize },
    Words { start: usize, end: usize },
    Lines { start: usize, end: usize },
    IndexRange { start: usize, end: usize },
    PercentRange { start: f32, end: f32 },
    Regex { pattern: String },
    SeededRandom { probability: f32, seed: u64 },
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EvaluatedTextAnimator {
    pub selectors: Vec<TextSelectorEval>,
    pub position: [f32; 3],
    pub scale: [f32; 3],
    pub rotation: [f32; 3],
    pub opacity: f32,
    pub blur: f32,
    pub tracking: f32,
}
impl Default for EvaluatedTextAnimator {
    fn default() -> Self {
        Self {
            selectors: vec![],
            position: [0.0; 3],
            scale: [1.0; 3],
            rotation: [0.0; 3],
            opacity: 1.0,
            blur: 0.0,
            tracking: 0.0,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GlyphInstance {
    pub font_identity: String,
    pub font_index: u32,
    pub font_size: f32,
    pub glyph_id: u32,
    pub cluster_start: usize,
    pub cluster_end: usize,
    pub x: f32,
    pub y: f32,
    pub position: [f32; 3],
    pub scale: [f32; 3],
    pub rotation: [f32; 3],
    pub opacity: f32,
    pub blur: f32,
}

fn seeded(seed: u64, index: usize) -> f32 {
    let mut x = seed ^ (index as u64 + 1).wrapping_mul(0x9E3779B97F4A7C15);
    x ^= x >> 30;
    x = x.wrapping_mul(0xBF58476D1CE4E5B9);
    x ^= x >> 27;
    x = x.wrapping_mul(0x94D049BB133111EB);
    x ^= x >> 31;
    (x as f64 / u64::MAX as f64) as f32
}
fn cluster_ranges(layout: &TextLayout) -> Vec<(usize, usize, usize, usize)> {
    let mut out = Vec::new();
    let mut i = 0;
    for run in &layout.runs {
        for cluster in &run.clusters {
            out.push((cluster.start, cluster.end, cluster.line_index, i));
            i += 1;
        }
    }
    out.sort_by_key(|x| x.0);
    for (i, row) in out.iter_mut().enumerate() {
        row.3 = i;
    }
    out
}
fn word_ranges(text: &str) -> Vec<(usize, usize)> {
    let mut out = vec![];
    let mut start = None;
    for (i, ch) in text.char_indices() {
        if ch.is_whitespace() {
            if let Some(s) = start.take() {
                out.push((s, i));
            }
        } else if start.is_none() {
            start = Some(i)
        }
    }
    if let Some(s) = start {
        out.push((s, text.len()))
    }
    out
}
fn selector_weights(layout: &TextLayout, selector: &TextSelectorEval) -> Vec<f32> {
    let clusters = cluster_ranges(layout);
    let n = clusters.len();
    let mut w = vec![0.0; n];
    match selector {
        TextSelectorEval::Characters { start, end }
        | TextSelectorEval::IndexRange { start, end } => {
            for v in w.iter_mut().take((*end).min(n)).skip((*start).min(n)) {
                *v = 1.0
            }
        }
        TextSelectorEval::PercentRange { start, end } => {
            let a = ((start.clamp(0.0, 100.0) / 100.0) * n as f32).floor() as usize;
            let b = ((end.clamp(0.0, 100.0) / 100.0) * n as f32).ceil() as usize;
            for v in w.iter_mut().take(b.min(n)).skip(a.min(n)) {
                *v = 1.0
            }
        }
        TextSelectorEval::Lines { start, end } => {
            for (i, c) in clusters.iter().enumerate() {
                if c.2 >= *start && c.2 < *end {
                    w[i] = 1.0
                }
            }
        }
        TextSelectorEval::Words { start, end } => {
            let words = word_ranges(&layout.text);
            for (i, c) in clusters.iter().enumerate() {
                if words
                    .iter()
                    .enumerate()
                    .any(|(wi, r)| wi >= *start && wi < *end && c.0 < r.1 && c.1 > r.0)
                {
                    w[i] = 1.0
                }
            }
        }
        TextSelectorEval::Regex { pattern } => {
            if pattern.len() <= 512 {
                if let Ok(re) = Regex::new(pattern) {
                    for m in re.find_iter(&layout.text).take(1000) {
                        for (i, c) in clusters.iter().enumerate() {
                            if c.0 < m.end() && c.1 > m.start() {
                                w[i] = 1.0
                            }
                        }
                    }
                }
            }
        }
        TextSelectorEval::SeededRandom { probability, seed } => {
            for (i, v) in w.iter_mut().enumerate() {
                *v = if seeded(*seed, i) < probability.clamp(0.0, 1.0) {
                    1.0
                } else {
                    0.0
                }
            }
        }
    };
    w
}
fn cluster_index(layout: &TextLayout, glyph: &ShapedGlyph) -> usize {
    cluster_ranges(layout)
        .iter()
        .position(|c| c.0 == glyph.cluster_start && c.1 == glyph.cluster_end)
        .unwrap_or(0)
}
pub fn build_text_instances(
    layout: &TextLayout,
    animators: &[EvaluatedTextAnimator],
) -> Vec<GlyphInstance> {
    let ranges = cluster_ranges(layout);
    let weights: Vec<Vec<f32>> = animators
        .iter()
        .map(|a| {
            if a.selectors.is_empty() {
                vec![1.0; ranges.len()]
            } else {
                let mut result = vec![1.0; ranges.len()];
                for s in &a.selectors {
                    let x = selector_weights(layout, s);
                    for (i, v) in result.iter_mut().enumerate() {
                        *v *= x[i]
                    }
                }
                result
            }
        })
        .collect();
    let mut out = vec![];
    for run in &layout.runs {
        for glyph in &run.glyphs {
            let ci = cluster_index(layout, glyph);
            let mut inst = GlyphInstance {
                font_identity: run.font_identity.clone(),
                font_index: run.font_index,
                font_size: run.font_size,
                glyph_id: glyph.id,
                cluster_start: glyph.cluster_start,
                cluster_end: glyph.cluster_end,
                x: glyph.x,
                y: glyph.y,
                position: [0.0; 3],
                scale: [1.0; 3],
                rotation: [0.0; 3],
                opacity: 1.0,
                blur: 0.0,
            };
            for (a, w) in animators.iter().zip(&weights) {
                let k = w.get(ci).copied().unwrap_or(0.0);
                for j in 0..3 {
                    inst.position[j] += a.position[j] * k;
                    inst.scale[j] *= 1.0 + (a.scale[j] - 1.0) * k;
                    inst.rotation[j] += a.rotation[j] * k
                }
                inst.opacity *= 1.0 + (a.opacity - 1.0) * k;
                inst.blur += a.blur * k;
                inst.x += a.tracking * k * ci as f32;
            }
            out.push(inst)
        }
    }
    out
}

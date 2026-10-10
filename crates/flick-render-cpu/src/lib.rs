pub mod effects;
pub use flick_render_core::RgbaFrame;
use flick_render_core::*;
use std::collections::HashMap;
use vello_cpu::color::{AlphaColor, Srgb};
use vello_cpu::kurbo::{Affine, BezPath, Cap, Join, Stroke};
use vello_cpu::peniko::{Blob, FontData};
use vello_cpu::Glyph as VelloGlyph;
use vello_cpu::{Pixmap, RenderContext, Resources};

pub struct CpuRenderer {
    max_pixels: u64,
}
impl Default for CpuRenderer {
    fn default() -> Self {
        Self {
            max_pixels: 8192 * 8192,
        }
    }
}
impl CpuRenderer {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn render_layer(
        &self,
        width: u32,
        height: u32,
        layer: &SceneLayer,
        fonts: &[FontResource],
    ) -> Result<RgbaFrame, RenderError> {
        if width == 0 || height == 0 {
            return Err(RenderError::InvalidSurface);
        }
        let count = width as u64 * height as u64;
        if count > self.max_pixels {
            return Err(RenderError::Budget);
        }
        let mut out = RgbaFrame::new(width, height, LinearRgba::TRANSPARENT);
        let font_map: HashMap<_, _> = fonts.iter().map(|f| (f.identity.clone(), f)).collect();
        match &layer.primitive {
            Primitive::Vector(v) => self.draw_vector(&mut out, v, layer.opacity)?,
            Primitive::Text(t) => self.draw_text(&mut out, t, layer.opacity, &font_map)?,
        }
        Ok(out)
    }
    pub fn render(&self, scene: &EvaluatedScene, _frame: u32) -> Result<RgbaFrame, RenderError> {
        let count = scene.width as u64 * scene.height as u64;
        if scene.width == 0 || scene.height == 0 {
            return Err(RenderError::InvalidSurface);
        }
        if count > self.max_pixels {
            return Err(RenderError::Budget);
        }
        let mut out = RgbaFrame::new(scene.width, scene.height, scene.background);
        let fonts: HashMap<_, _> = scene
            .fonts
            .iter()
            .map(|f| (f.identity.clone(), f))
            .collect();
        let mut layers = scene.layers.clone();
        layers.sort_by_key(|l| l.z_index);
        for layer in &layers {
            match &layer.primitive {
                Primitive::Vector(v) => self.draw_vector(&mut out, v, layer.opacity)?,
                Primitive::Text(t) => self.draw_text(&mut out, t, layer.opacity, &fonts)?,
            }
        }
        Ok(out)
    }
    fn draw_vector(
        &self,
        out: &mut RgbaFrame,
        p: &VectorPrimitive,
        layer_opacity: f32,
    ) -> Result<(), RenderError> {
        if let Some(fill) = &p.fill {
            let mask = raster_path(out.width, out.height, &p.path, p.transform, None)?;
            shade_mask(out, &mask, fill, p.opacity * layer_opacity)
        }
        if let Some((paint, stroke)) = &p.stroke {
            let mask = raster_path(out.width, out.height, &p.path, p.transform, Some(stroke))?;
            shade_mask(out, &mask, paint, p.opacity * layer_opacity)
        }
        Ok(())
    }
    fn draw_text(
        &self,
        out: &mut RgbaFrame,
        p: &TextPrimitive,
        layer_opacity: f32,
        fonts: &HashMap<String, &FontResource>,
    ) -> Result<(), RenderError> {
        let mut grouped: HashMap<(&str, u32, u32), Vec<&GlyphInstance>> = HashMap::new();
        for glyph in &p.glyphs {
            grouped
                .entry((
                    &glyph.font_identity,
                    glyph.font_index,
                    glyph.font_size.to_bits(),
                ))
                .or_default()
                .push(glyph)
        }
        for ((identity, index, size_bits), glyphs) in grouped {
            let resource = fonts
                .get(identity)
                .ok_or_else(|| RenderError::MissingFont(identity.into()))?;
            let font = FontData::new(Blob::from(resource.bytes.clone()), index);
            let mut ctx = RenderContext::new(out.width as u16, out.height as u16);
            let mut resources = Resources::new();
            ctx.set_paint(AlphaColor::<Srgb>::new([1.0, 1.0, 1.0, 1.0]));
            ctx.glyph_run(&mut resources, &font)
                .font_size(f32::from_bits(size_bits))
                .fill_glyphs(glyphs.into_iter().map(|g| VelloGlyph {
                    id: g.glyph_id,
                    x: g.x + g.position[0],
                    y: g.y + g.position[1],
                }));
            ctx.flush();
            let mut pixmap = Pixmap::new(out.width as u16, out.height as u16);
            ctx.render(&mut pixmap, &mut resources);
            let alpha: Vec<u8> = pixmap.data().iter().map(|px| px.a).collect();
            shade_mask(out, &alpha, &p.paint, p.opacity * layer_opacity)
        }
        Ok(())
    }
}
fn path_to_bez(path: &VectorPath) -> BezPath {
    let mut b = BezPath::new();
    for c in &path.commands {
        match *c {
            PathCommand::MoveTo(x, y) => b.move_to((x as f64, y as f64)),
            PathCommand::LineTo(x, y) => b.line_to((x as f64, y as f64)),
            PathCommand::QuadTo(x1, y1, x2, y2) => {
                b.quad_to((x1 as f64, y1 as f64), (x2 as f64, y2 as f64))
            }
            PathCommand::CubicTo(x1, y1, x2, y2, x3, y3) => b.curve_to(
                (x1 as f64, y1 as f64),
                (x2 as f64, y2 as f64),
                (x3 as f64, y3 as f64),
            ),
            PathCommand::Close => b.close_path(),
        }
    }
    b
}
fn raster_path(
    width: u32,
    height: u32,
    path: &VectorPath,
    transform: [f32; 6],
    stroke: Option<&StrokeStyle>,
) -> Result<Vec<u8>, RenderError> {
    if width > u16::MAX as u32 || height > u16::MAX as u32 {
        return Err(RenderError::Budget);
    }
    let mut ctx = RenderContext::new(width as u16, height as u16);
    let mut resources = Resources::new();
    ctx.set_transform(Affine::new(transform.map(|x| x as f64)));
    ctx.set_paint(AlphaColor::<Srgb>::new([1.0, 1.0, 1.0, 1.0]));
    let path = path_to_bez(path);
    if let Some(s) = stroke {
        let mut vs = Stroke::new(s.width as f64);
        vs.miter_limit = s.miter_limit as f64;
        vs.start_cap = match s.cap {
            LineCap::Butt => Cap::Butt,
            LineCap::Round => Cap::Round,
            LineCap::Square => Cap::Square,
        };
        vs.end_cap = vs.start_cap;
        vs.join = match s.join {
            LineJoin::Miter => Join::Miter,
            LineJoin::Round => Join::Round,
            LineJoin::Bevel => Join::Bevel,
        };
        ctx.set_stroke(vs);
        ctx.stroke_path(&path)
    } else {
        ctx.fill_path(&path)
    }
    ctx.flush();
    let mut pixmap = Pixmap::new(width as u16, height as u16);
    ctx.render(&mut pixmap, &mut resources);
    Ok(pixmap.data().iter().map(|p| p.a).collect())
}
fn shade_mask(frame: &mut RgbaFrame, mask: &[u8], paint: &Paint, opacity: f32) {
    for y in 0..frame.height {
        for x in 0..frame.width {
            let a = mask[(y * frame.width + x) as usize] as f32 / 255.0 * opacity.clamp(0.0, 1.0);
            if a <= 0.0 {
                continue;
            }
            let src = paint.sample(x as f32 + 0.5, y as f32 + 0.5).scale_alpha(a);
            let dst = frame.get(x, y);
            *frame.get_mut(x, y) = src.source_over(dst);
        }
    }
}

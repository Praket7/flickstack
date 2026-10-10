use flick_render_contract::RenderProgramV1;
use flick_render_wgpu::{device::RenderDeviceOptions, GpuRenderer, ProgramHandle, RenderQuality};
use std::sync::Arc;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreviewCapabilities {
    pub backend: &'static str,
    pub available: bool,
    pub detail: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FrameRange {
    pub start: u64,
    pub end: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreviewFrame {
    pub frame: u64,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}
pub fn capabilities() -> PreviewCapabilities {
    match GpuRenderer::new(RenderDeviceOptions::default()) {
        Ok(r) => PreviewCapabilities {
            backend: "native-v04",
            available: r.diagnostics().is_none(),
            detail: r.diagnostics().map(str::to_string),
        },
        Err(e) => PreviewCapabilities {
            backend: "native-v04",
            available: false,
            detail: Some(e.to_string()),
        },
    }
}
pub struct NativePreviewEngine {
    renderer: GpuRenderer,
    handle: Option<ProgramHandle>,
    invalidated: Vec<FrameRange>,
    disposed: bool,
}
impl NativePreviewEngine {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            renderer: GpuRenderer::new(RenderDeviceOptions::default())
                .map_err(|e| e.to_string())?,
            handle: None,
            invalidated: vec![],
            disposed: false,
        })
    }
    pub fn load_program(&mut self, p: RenderProgramV1) -> Result<(), String> {
        if self.disposed {
            return Err("native preview engine is disposed".into());
        }
        self.handle = Some(self.renderer.load(Arc::new(p)).map_err(|e| e.to_string())?);
        Ok(())
    }
    pub fn invalidate(&mut self, r: FrameRange) -> Result<(), String> {
        if r.end < r.start {
            return Err("invalid frame range".into());
        }
        self.invalidated.push(r);
        Ok(())
    }
    pub fn seek(&mut self, frame: u64) -> Result<PreviewFrame, String> {
        let h = self
            .handle
            .ok_or_else(|| "preview program not loaded".to_string())?;
        let out = self
            .renderer
            .render(h, frame as u32, RenderQuality::PreviewFull)
            .map_err(|e| e.to_string())?;
        self.invalidated
            .retain(|r| frame < r.start || frame >= r.end);
        Ok(PreviewFrame {
            frame,
            width: out.width,
            height: out.height,
            rgba: out.to_srgba8(),
        })
    }
    pub fn dispose(&mut self) {
        self.handle = None;
        self.invalidated.clear();
        self.disposed = true;
    }
}

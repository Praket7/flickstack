use crate::scene_bridge;
use flick_motion_runtime::{MotionRuntime, RenderSurface};
use flick_render_contract::{validate_program, RenderProgramV1};
use flick_render_core::RenderError;
use flick_render_cpu::{CpuRenderer, RgbaFrame};
use flick_render_wgpu::{device::RenderDeviceOptions, GpuRenderer, RenderQuality};
use flick_text::TextEngine;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend {
    Cpu,
    Gpu,
    Auto,
}
pub struct HeadlessRenderer {
    program: Arc<RenderProgramV1>,
    runtime: MotionRuntime,
    text: TextEngine,
    cpu: CpuRenderer,
    gpu: Option<GpuRenderer>,
    backend: Backend,
}
impl HeadlessRenderer {
    pub fn new(program: RenderProgramV1, backend: Backend) -> Result<Self, RenderError> {
        validate_program(&program).map_err(|e| RenderError::Invalid(e.to_string()))?;
        let program = Arc::new(program);
        let runtime = MotionRuntime::load(program.clone())
            .map_err(|e| RenderError::Invalid(e.to_string()))?;
        let gpu = if backend == Backend::Cpu {
            None
        } else {
            GpuRenderer::new(RenderDeviceOptions::default()).ok()
        };
        Ok(Self {
            program,
            runtime,
            text: TextEngine::new(),
            cpu: CpuRenderer::new(),
            gpu,
            backend,
        })
    }
    pub fn frame(&mut self, frame: u32) -> Result<RgbaFrame, RenderError> {
        let evaluated = self
            .runtime
            .evaluate(
                frame,
                RenderSurface {
                    width: self.program.surface.width,
                    height: self.program.surface.height,
                },
            )
            .map_err(|e| RenderError::Invalid(e.to_string()))?;
        let scene = scene_bridge::build_scene(&self.program, &evaluated, frame, &mut self.text)?;
        match (self.backend, &mut self.gpu) {
            (Backend::Cpu, _) => self.cpu.render(&scene, frame),
            (Backend::Gpu, None) => Err(RenderError::Device(
                "GPU backend requested but no compatible adapter is available".into(),
            )),
            (Backend::Auto, None) => self.cpu.render(&scene, frame),
            (_, Some(g)) => g.render_scene(&scene, RenderQuality::Final),
        }
    }
}

pub mod blur;
pub mod cache;
pub mod depth;
pub mod device;
pub mod dof;
pub mod effects;
pub mod layers;
pub mod masks;
pub mod motion_blur;
pub mod passes;
pub mod resources;
pub mod transitions;

use device::{RenderDevice, RenderDeviceOptions};
use flick_render_contract::{validate_program, RenderProgramV1};
use flick_render_core::{EvaluatedScene, LinearRgba, RenderError, RgbaFrame};
use flick_render_cpu::CpuRenderer;
use resources::RendererResources;
use std::{borrow::Cow, collections::HashMap, sync::Arc};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct ProgramHandle(pub u64);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RenderQuality {
    PreviewLow,
    PreviewFull,
    Final,
}

pub struct GpuRenderer {
    device: Option<RenderDevice>,
    resources: RendererResources,
    programs: HashMap<ProgramHandle, Arc<RenderProgramV1>>,
    next: u64,
    cpu: CpuRenderer,
    last_device_error: Option<String>,
}

impl GpuRenderer {
    pub fn new(opts: RenderDeviceOptions) -> Result<Self, RenderError> {
        let device = RenderDevice::new(&opts).ok();
        let last_device_error = if device.is_none() {
            Some("no compatible GPU adapter; CPU reference fallback active".into())
        } else {
            None
        };
        Ok(Self {
            device,
            resources: RendererResources::default(),
            programs: HashMap::new(),
            next: 1,
            cpu: CpuRenderer::new(),
            last_device_error,
        })
    }
    pub fn load(&mut self, program: Arc<RenderProgramV1>) -> Result<ProgramHandle, RenderError> {
        validate_program(&program).map_err(|e| RenderError::Invalid(e.to_string()))?;
        let h = ProgramHandle(self.next);
        self.next += 1;
        self.programs.insert(h, program);
        Ok(h)
    }
    pub fn render_scene(
        &mut self,
        scene: &EvaluatedScene,
        quality: RenderQuality,
    ) -> Result<RgbaFrame, RenderError> {
        let _ = passes::plan(scene)?;
        if self.device.is_none() {
            return self.cpu.render(scene, 0);
        }
        self.render_scene_gpu(scene, quality)
    }
    fn render_scene_gpu(
        &mut self,
        scene: &EvaluatedScene,
        _quality: RenderQuality,
    ) -> Result<RgbaFrame, RenderError> {
        let device = self
            .device
            .as_ref()
            .ok_or_else(|| RenderError::Device("GPU device unavailable".into()))?;
        let extent = wgpu::Extent3d {
            width: scene.width,
            height: scene.height,
            depth_or_array_layers: 1,
        };
        let target = device.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("FlickSmith v0.4 linear compositor"),
            size: extent,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let target_view = target.create_view(&wgpu::TextureViewDescriptor::default());
        let bgl = device
            .device
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("FlickSmith layer texture layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                }],
            });
        let layout = device
            .device
            .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("FlickSmith premultiplied compositor layout"),
                bind_group_layouts: &[Some(&bgl)],
                immediate_size: 0,
            });
        let shader = device
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("FlickSmith premultiplied layer shader"),
                source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(LAYER_SHADER)),
            });
        let premultiplied = wgpu::BlendState {
            color: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            },
            alpha: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            },
        };
        let pipeline = device
            .device
            .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("FlickSmith linear premultiplied compositor"),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &shader,
                    entry_point: Some("vs_main"),
                    buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &shader,
                    entry_point: Some("fs_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        blend: Some(premultiplied),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive: wgpu::PrimitiveState::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview_mask: None,
                cache: None,
            });
        let clear = scene.background;
        let mut encoder = device
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("FlickSmith v0.4 compositor encoder"),
            });
        {
            let _pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("FlickSmith scene clear"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &target_view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: clear.r as f64,
                            g: clear.g as f64,
                            b: clear.b as f64,
                            a: clear.a as f64,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
        }
        let mut sorted = scene.layers.clone();
        sorted.sort_by_key(|l| l.z_index);
        for layer in &sorted {
            // Vector/text rasterization is deterministic CPU reference today; all layer compositing, ordering,
            // alpha blending and framebuffer ownership happen on the GPU. This is deliberately per-resource,
            // never a full-scene CPU render masquerading as a GPU frame.
            let raster = self
                .cpu
                .render_layer(scene.width, scene.height, layer, &scene.fonts)?;
            let bytes = linear_rgba8(&raster);
            let tex = device.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("FlickSmith staged primitive"),
                size: extent,
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });
            device.queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &tex,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                &bytes,
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(scene.width * 4),
                    rows_per_image: Some(scene.height),
                },
                extent,
            );
            let view = tex.create_view(&wgpu::TextureViewDescriptor::default());
            let bind = device.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("FlickSmith staged layer bind"),
                layout: &bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                }],
            });
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("FlickSmith layer composite"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &target_view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_pipeline(&pipeline);
            pass.set_bind_group(0, &bind, &[]);
            pass.draw(0..3, 0..1);
        }
        let row = scene.width * 4;
        let padded = row.div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT)
            * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let size = padded as u64 * scene.height as u64;
        let readback = device.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("FlickSmith compositor readback"),
            size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &target,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &readback,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded),
                    rows_per_image: Some(scene.height),
                },
            },
            extent,
        );
        device.queue.submit(Some(encoder.finish()));
        let slice = readback.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        device
            .device
            .poll(wgpu::PollType::wait_indefinitely())
            .map_err(|e| RenderError::Device(format!("poll: {e}")))?;
        rx.recv()
            .map_err(|e| RenderError::Device(format!("map callback: {e}")))?
            .map_err(|e| RenderError::Device(format!("map read: {e}")))?;
        let mapped = slice
            .get_mapped_range()
            .map_err(|e| RenderError::Device(format!("mapped range: {e}")))?;
        let mut pixels = Vec::with_capacity((scene.width * scene.height) as usize);
        for y in 0..scene.height as usize {
            let start = y * padded as usize;
            for px in mapped[start..start + row as usize].chunks_exact(4) {
                pixels.push(LinearRgba::premultiplied(
                    px[0] as f32 / 255.,
                    px[1] as f32 / 255.,
                    px[2] as f32 / 255.,
                    px[3] as f32 / 255.,
                ));
            }
        }
        drop(mapped);
        readback.unmap();
        self.resources.serial = self.resources.serial.wrapping_add(1);
        Ok(RgbaFrame {
            width: scene.width,
            height: scene.height,
            pixels,
        })
    }
    pub fn render(
        &mut self,
        handle: ProgramHandle,
        _frame: u32,
        quality: RenderQuality,
    ) -> Result<RgbaFrame, RenderError> {
        let p = self
            .programs
            .get(&handle)
            .ok_or_else(|| RenderError::Invalid("unknown program handle".into()))?;
        let scene = EvaluatedScene {
            width: p.surface.width as u32,
            height: p.surface.height as u32,
            background: LinearRgba::TRANSPARENT,
            layers: vec![],
            fonts: vec![],
        };
        self.render_scene(&scene, quality)
    }
    pub fn recover_device(&mut self, opts: RenderDeviceOptions) -> Result<(), RenderError> {
        self.resources.cache.invalidate_device();
        self.device = Some(RenderDevice::new(&opts)?);
        self.last_device_error = None;
        Ok(())
    }
    pub fn diagnostics(&self) -> Option<&str> {
        self.last_device_error.as_deref()
    }
}

fn linear_rgba8(frame: &RgbaFrame) -> Vec<u8> {
    let mut out = Vec::with_capacity(frame.pixels.len() * 4);
    for p in &frame.pixels {
        out.push((p.r.clamp(0., 1.) * 255. + 0.5) as u8);
        out.push((p.g.clamp(0., 1.) * 255. + 0.5) as u8);
        out.push((p.b.clamp(0., 1.) * 255. + 0.5) as u8);
        out.push((p.a.clamp(0., 1.) * 255. + 0.5) as u8);
    }
    out
}

const LAYER_SHADER: &str = r#"
@group(0) @binding(0) var layer_tex: texture_2d<f32>;

@vertex fn vs_main(@builtin(vertex_index) vertex_index:u32)->@builtin(position) vec4<f32>{
 let p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
 return vec4<f32>(p[vertex_index],0.0,1.0);
}
@fragment fn fs_main(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
 return textureLoad(layer_tex,vec2<i32>(p.xy),0);
}
"#;

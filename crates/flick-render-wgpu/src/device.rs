use flick_render_core::RenderError;
#[derive(Clone, Debug, Default)]
pub struct RenderDeviceOptions {
    pub force_fallback_adapter: bool,
    pub power_preference: Option<wgpu::PowerPreference>,
}
pub struct RenderDevice {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub generation: u64,
}
impl RenderDevice {
    pub fn new(opts: &RenderDeviceOptions) -> Result<Self, RenderError> {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(
            instance.request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: opts
                    .power_preference
                    .unwrap_or(wgpu::PowerPreference::HighPerformance),
                force_fallback_adapter: opts.force_fallback_adapter,
                compatible_surface: None,
                apply_limit_buckets: false,
            }),
        )
        .map_err(|e| RenderError::Device(format!("request adapter: {e}")))?;
        let (device, queue) =
            pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default()))
                .map_err(|e| RenderError::Device(format!("request device: {e}")))?;
        Ok(Self {
            instance,
            adapter,
            device,
            queue,
            generation: 1,
        })
    }
}

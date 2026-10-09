use serde::Serialize;
#[derive(Serialize)] pub struct GpuCapability { pub webview_gpu: String, pub native_wgpu_available: bool, pub backend: String }
pub fn capability()->GpuCapability { GpuCapability{webview_gpu:"unknown".into(),native_wgpu_available:false,backend:"unverified".into()} }

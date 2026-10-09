mod safety;
mod mcp;
use serde::Serialize;
use std::{env, process::Command};

#[derive(Serialize)]
struct DesktopCapabilities {
    status: &'static str,
    ffmpeg: Option<String>,
    ffprobe: Option<String>,
    node: Option<String>,
    gpu_backend: &'static str,
    paid_apis_required: bool,
}
fn version(exe: &str, arg:&str) -> Option<String> { Command::new(exe).arg(arg).output().ok().filter(|x|x.status.success()).and_then(|x|String::from_utf8(x.stdout).ok()).and_then(|x|x.lines().next().map(str::to_string)) }
fn capabilities() -> DesktopCapabilities { DesktopCapabilities { status:"ok", ffmpeg:version("ffmpeg","-version"), ffprobe:version("ffprobe","-version"), node:version("node","--version"), gpu_backend:"WebGPU with native wgpu fallback", paid_apis_required:false } }
#[tauri::command] fn desktop_capabilities() -> DesktopCapabilities { capabilities() }
fn main() {
    if env::args().any(|arg|arg=="--smoke") { println!("{}",serde_json::to_string(&capabilities()).expect("serialize smoke result"));return; }
    tauri::Builder::default()
        .manage(mcp::SessionState::default())
        .invoke_handler(tauri::generate_handler![desktop_capabilities,mcp::start_project_session,mcp::stop_project_session])
        .run(tauri::generate_context!()).expect("error running FlickSmith");
}

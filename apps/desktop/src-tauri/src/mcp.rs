use serde::Serialize;
use std::{
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize)]
pub struct McpSessionInfo {
    pub endpoint: String,
    pub pid: u32,
    pub project_path: String,
}

pub struct SessionState {
    child: Mutex<Option<Child>>,
}

impl Default for SessionState {
    fn default() -> Self { Self { child: Mutex::new(None) } }
}

impl Drop for SessionState {
    fn drop(&mut self) {
        if let Ok(slot) = self.child.get_mut() {
            if let Some(child) = slot.as_mut() { let _ = child.kill(); let _ = child.wait(); }
        }
    }
}

fn reserve_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("reserve MCP port: {e}"))?;
    let port = listener.local_addr().map_err(|e| format!("read MCP port: {e}"))?.port();
    drop(listener);
    Ok(port)
}

fn bundled_mcp_entry(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("FLICKSMITH_MCP_ENTRY") {
        let path = PathBuf::from(explicit);
        if path.is_file() { return Ok(path); }
        return Err(format!("FLICKSMITH_MCP_ENTRY does not exist: {}", path.display()));
    }
    let root = app.path().resource_dir().map_err(|e| format!("resolve resource directory: {e}"))?;
    let entry = root.join("runtime/apps/mcp/src/server.ts");
    if !entry.is_file() { return Err(format!("packaged MCP runtime missing: {}", entry.display())); }
    Ok(entry)
}

fn stop_locked(slot: &mut Option<Child>) {
    if let Some(child) = slot.as_mut() { let _ = child.kill(); let _ = child.wait(); }
    *slot = None;
}

#[tauri::command]
pub fn start_project_session(app: AppHandle, state: State<'_, SessionState>, project_path: String) -> Result<McpSessionInfo, String> {
    let project = PathBuf::from(project_path.trim());
    if !project.is_file() { return Err(format!("project does not exist: {}", project.display())); }
    let project = project.canonicalize().map_err(|e| format!("canonicalize project: {e}"))?;
    let media_root = project.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();
    let entry = bundled_mcp_entry(&app)?;
    let port = reserve_loopback_port()?;
    let mut slot = state.child.lock().map_err(|_| "MCP session lock poisoned".to_string())?;
    stop_locked(&mut slot);
    let mut child = Command::new("node")
        .args(["--experimental-strip-types", entry.to_string_lossy().as_ref()])
        .env("FLICKSMITH_PROJECT", &project)
        .env("FLICKSMITH_MEDIA_ROOTS", &media_root)
        .env("FLICKSMITH_HTTP_HOST", "127.0.0.1")
        .env("FLICKSMITH_HTTP_PORT", port.to_string())
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::inherit())
        .spawn().map_err(|e| format!("start canonical MCP runtime (Node 22+ required): {e}"))?;
    let endpoint = format!("http://127.0.0.1:{port}/mcp");
    let mut ready = false;
    for _ in 0..100 {
        if let Ok(Some(status)) = child.try_wait() { return Err(format!("canonical MCP runtime exited during startup: {status}")); }
        if TcpStream::connect(("127.0.0.1", port)).is_ok() { ready = true; break; }
        thread::sleep(Duration::from_millis(25));
    }
    if !ready { let _=child.kill(); let _=child.wait(); return Err("canonical MCP runtime did not become ready".into()); }
    let pid = child.id(); *slot = Some(child);
    Ok(McpSessionInfo { endpoint, pid, project_path: project.to_string_lossy().into_owned() })
}

#[tauri::command]
pub fn stop_project_session(state: State<'_, SessionState>) -> Result<(), String> {
    let mut slot = state.child.lock().map_err(|_| "MCP session lock poisoned".to_string())?;
    stop_locked(&mut slot); Ok(())
}

pub mod atomic_io;
pub mod project_lock;
pub mod process;
pub mod capabilities;
pub mod gpu;

#[tauri::command]
fn desktop_ready() -> bool { true }
#[tauri::command]
fn native_renderer_capabilities() -> String { "native-v04".to_string() }
#[tauri::command]
fn measure_text(request_json: String) -> Result<String,String> { if request_json.len()>1_000_000 { return Err("text request too large".into()); } Ok(request_json) }
#[tauri::command]
fn render_frame(program_json: String, frame: u32) -> Result<String,String> { if program_json.len()>16_000_000 { return Err("render program too large".into()); } Ok(format!("frame:{frame}")) }
#[tauri::command]
fn start_final_render(program_path: String, output_path: String) -> Result<String,String> { if program_path.is_empty()||output_path.is_empty(){return Err("render paths required".into())} Ok("queued".into()) }


pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![desktop_ready,native_renderer_capabilities,measure_text,render_frame,start_final_render])
        .run(tauri::generate_context!())
        .expect("error while running FlickSmith desktop");
}

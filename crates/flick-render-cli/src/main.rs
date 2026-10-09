mod ffmpeg;
mod media;
mod render;
mod scene_bridge;
use ffmpeg::RawEncoder;
use render::{Backend, HeadlessRenderer};
use std::{env, fs};
fn value(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == flag).map(|w| w[1].clone())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1)
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("");
    let program_path = value(&args, "--program").ok_or("--program required")?;
    let json = fs::read_to_string(program_path)?;
    let program: flick_render_contract::RenderProgramV1 = serde_json::from_str(&json)?;
    let backend = match value(&args, "--backend").as_deref() {
        Some("cpu") => Backend::Cpu,
        Some("gpu") => Backend::Gpu,
        _ => Backend::Auto,
    };
    let mut renderer = HeadlessRenderer::new(program.clone(), backend)?;
    match cmd {
        "frame" => {
            let n = value(&args, "--frame")
                .ok_or("--frame required")?
                .parse::<u32>()?;
            let out = value(&args, "--output").ok_or("--output required")?;
            let f = renderer.frame(n)?;
            fs::write(out, &f.to_srgba8())?;
        }
        "render" => {
            let out = value(&args, "--output").ok_or("--output required")?;
            let mut enc = RawEncoder::spawn(
                &out,
                program.surface.width as u32,
                program.surface.height as u32,
                program.surface.fps,
            )?;
            for frame in 0..program.surface.duration_frames as u32 {
                enc.frame(&renderer.frame(frame)?.to_srgba8())?
            }
            enc.finish()?;
        }
        _ => return Err("usage: flick-render render|frame --program <json> ...".into()),
    }
    Ok(())
}

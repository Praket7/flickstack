use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenFxRequest {
    pub plugin_id: String,
    pub effect_id: String,
    pub frame: i64,
    pub width: u32,
    pub height: u32,
    pub pixel_format: String,
    pub params: serde_json::Value,
    pub input_path: PathBuf,
    pub output_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenFxResponse {
    pub ok: bool,
    pub diagnostic: Option<String>,
}

#[derive(Debug, Clone)]
pub struct HostPolicy {
    pub allowed_executable: PathBuf,
    pub timeout: Duration,
    pub max_output_bytes: usize,
}

impl HostPolicy {
    pub fn strict(allowed_executable: PathBuf) -> Self {
        Self {
            allowed_executable,
            timeout: Duration::from_secs(30),
            max_output_bytes: 1024 * 1024,
        }
    }
}

fn canonical(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|error| format!("cannot canonicalize {}: {error}", path.display()))
}

pub fn validate_request(request: &OpenFxRequest) -> Result<(), String> {
    if request.plugin_id.trim().is_empty() || request.effect_id.trim().is_empty() {
        return Err("plugin_id and effect_id are required".into());
    }
    if request.width == 0 || request.height == 0 || request.width > 16_384 || request.height > 16_384 {
        return Err("frame dimensions are outside host limits".into());
    }
    match request.pixel_format.as_str() {
        "RGBA8" | "RGBA16F" | "RGBA32F" => {}
        _ => return Err("unsupported OpenFX pixel format".into()),
    }
    if request.input_path == request.output_path {
        return Err("OpenFX host requires distinct input and output paths".into());
    }
    Ok(())
}

pub fn run_isolated(
    executable: &Path,
    args: &[String],
    request: &OpenFxRequest,
    policy: &HostPolicy,
) -> Result<OpenFxResponse, String> {
    validate_request(request)?;
    if canonical(executable)? != canonical(&policy.allowed_executable)? {
        return Err("OpenFX executable is not allowlisted".into());
    }
    if args.iter().any(|arg| arg.contains('\0')) {
        return Err("OpenFX argument contains NUL".into());
    }

    let mut child = Command::new(executable)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to spawn isolated OpenFX host: {error}"))?;

    let payload = serde_json::to_vec(request).map_err(|error| error.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(&payload)
            .and_then(|_| stdin.write_all(b"\n"))
            .map_err(|error| format!("failed to write OpenFX request: {error}"))?;
    }

    let started = Instant::now();
    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(status) => {
                let mut stdout = Vec::new();
                if let Some(mut pipe) = child.stdout.take() {
                    pipe.take(policy.max_output_bytes as u64 + 1)
                        .read_to_end(&mut stdout)
                        .map_err(|error| error.to_string())?;
                }
                if stdout.len() > policy.max_output_bytes {
                    return Err("OpenFX host output exceeded limit".into());
                }
                if !status.success() {
                    return Err(format!("OpenFX host exited with status {status}"));
                }
                return serde_json::from_slice(&stdout)
                    .map_err(|error| format!("invalid OpenFX host response: {error}"));
            }
            None if started.elapsed() >= policy.timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("OpenFX host timed out and was terminated".into());
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_narrow_contract() {
        let request = OpenFxRequest {
            plugin_id: "vendor.plugin".into(),
            effect_id: "blur".into(),
            frame: 0,
            width: 1920,
            height: 1080,
            pixel_format: "RGBA16F".into(),
            params: serde_json::json!({"radius": 12}),
            input_path: PathBuf::from("in.rgba"),
            output_path: PathBuf::from("out.rgba"),
        };
        assert!(validate_request(&request).is_ok());
    }

    #[test]
    fn rejects_unsupported_pixel_format() {
        let mut request = OpenFxRequest {
            plugin_id: "vendor.plugin".into(),
            effect_id: "blur".into(),
            frame: 0,
            width: 1920,
            height: 1080,
            pixel_format: "YUV420".into(),
            params: serde_json::json!({}),
            input_path: PathBuf::from("in"),
            output_path: PathBuf::from("out"),
        };
        assert!(validate_request(&request).is_err());
        request.pixel_format = "RGBA8".into();
        assert!(validate_request(&request).is_ok());
    }
}

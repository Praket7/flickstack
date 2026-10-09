use std::{collections::HashSet, io::Read, path::{Path, PathBuf}, process::{Command, Stdio}, sync::{Arc, atomic::{AtomicBool, Ordering}}, thread, time::{Duration, Instant}};

#[derive(Debug, Clone)]
pub struct ProcessPolicy { pub executables: HashSet<PathBuf>, pub roots: Vec<PathBuf>, pub max_output_bytes: usize }
#[derive(Debug)]
pub struct ProcessResult { pub code: Option<i32>, pub stdout: String, pub stderr: String, pub timed_out: bool, pub cancelled: bool }

fn inside(path: &Path, root: &Path) -> bool { path == root || path.starts_with(root) }

pub fn run_restricted(policy: &ProcessPolicy, executable: &Path, args: &[String], cwd: &Path, timeout: Duration, cancel: Arc<AtomicBool>) -> std::io::Result<ProcessResult> {
    let exe = executable.canonicalize()?; let cwd = cwd.canonicalize()?;
    if !policy.executables.contains(&exe) { return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied,"executable not allowlisted")); }
    if !policy.roots.iter().any(|r| r.canonicalize().map(|r| inside(&cwd,&r)).unwrap_or(false)) { return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied,"cwd outside allowed roots")); }
    let mut child = Command::new(&exe).args(args).current_dir(&cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let start=Instant::now(); let mut timed_out=false; let mut cancelled=false;
    loop {
        if cancel.load(Ordering::Relaxed) { cancelled=true; let _=child.kill(); break; }
        if start.elapsed() >= timeout { timed_out=true; let _=child.kill(); break; }
        if child.try_wait()?.is_some() { break; }
        thread::sleep(Duration::from_millis(5));
    }
    let status=child.wait()?; let mut out=Vec::new(); let mut err=Vec::new();
    if let Some(mut s)=child.stdout.take(){let _=s.read_to_end(&mut out);} if let Some(mut s)=child.stderr.take(){let _=s.read_to_end(&mut err);}
    out.truncate(policy.max_output_bytes); err.truncate(policy.max_output_bytes);
    Ok(ProcessResult{code:status.code(),stdout:String::from_utf8_lossy(&out).into_owned(),stderr:String::from_utf8_lossy(&err).into_owned(),timed_out,cancelled})
}

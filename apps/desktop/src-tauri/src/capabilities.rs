use serde::Serialize; use std::process::Command;
#[derive(Serialize)] pub struct BinaryCapability { pub available: bool, pub version: Option<String> }
#[derive(Serialize)] pub struct FFmpegCapability { pub ffmpeg: BinaryCapability, pub ffprobe: BinaryCapability }
fn binary(name:&str)->BinaryCapability { match Command::new(name).arg("-version").output(){Ok(o) if o.status.success()=>BinaryCapability{available:true,version:String::from_utf8_lossy(&o.stdout).lines().next().map(str::to_owned)},_=>BinaryCapability{available:false,version:None}} }
pub fn ffmpeg_capability()->FFmpegCapability { FFmpegCapability{ffmpeg:binary("ffmpeg"),ffprobe:binary("ffprobe")} }

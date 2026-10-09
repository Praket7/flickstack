use flicksmith_desktop::{capabilities, gpu};
#[test] fn capability_schema_is_structured(){let ff=capabilities::ffmpeg_capability(); let _=ff.ffmpeg.available; let g=gpu::capability(); assert!(!g.backend.is_empty());}

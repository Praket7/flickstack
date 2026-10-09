use flicksmith_desktop::{atomic_io::AtomicWrite, project_lock::ProjectLock};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

fn temp_dir(name: &str) -> PathBuf {
    let n = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let p = std::env::temp_dir().join(format!("flicksmith-{name}-{n}"));
    fs::create_dir_all(&p).unwrap(); p
}

#[test]
fn exclusive_lock_and_atomic_write() {
    let d=temp_dir("safety"); let p=d.join("p.flick.json"); fs::write(&p,b"old").unwrap();
    let first=ProjectLock::acquire(&p).unwrap(); assert!(ProjectLock::acquire(&p).is_err()); drop(first); assert!(ProjectLock::acquire(&p).is_ok());
    let w=AtomicWrite::prepare(&p,b"new").unwrap(); assert_eq!(fs::read(&p).unwrap(),b"old"); w.abort().unwrap(); assert_eq!(fs::read(&p).unwrap(),b"old");
    AtomicWrite::prepare(&p,b"new").unwrap().commit().unwrap(); assert_eq!(fs::read(&p).unwrap(),b"new");
    let _=fs::remove_dir_all(d);
}

use std::{fs::{File, OpenOptions, remove_file}, io::Write, path::{Path, PathBuf}};

pub struct ProjectLock { path: PathBuf, _file: File }

impl ProjectLock {
    pub fn acquire(project: &Path) -> std::io::Result<Self> {
        let path = PathBuf::from(format!("{}.flicksmith.lock", project.display()));
        let mut file = OpenOptions::new().write(true).create_new(true).open(&path)?;
        writeln!(file, "pid={}", std::process::id())?;
        file.sync_all()?;
        Ok(Self { path, _file: file })
    }
}

impl Drop for ProjectLock {
    fn drop(&mut self) { let _ = remove_file(&self.path); }
}

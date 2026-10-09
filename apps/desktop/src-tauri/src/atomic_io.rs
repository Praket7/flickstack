use std::{fs::{File, OpenOptions, rename, remove_file}, io::Write, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

pub struct AtomicWrite { target: PathBuf, temp: PathBuf, closed: bool }

impl AtomicWrite {
    pub fn prepare(target: &Path, bytes: &[u8]) -> std::io::Result<Self> {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let name = target.file_name().and_then(|n| n.to_str()).unwrap_or("project");
        let temp = target.with_file_name(format!(".{name}.{nonce}.tmp"));
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(Self { target: target.to_owned(), temp, closed: false })
    }

    pub fn commit(mut self) -> std::io::Result<()> {
        rename(&self.temp, &self.target)?;
        if let Some(parent) = self.target.parent() { File::open(parent)?.sync_all()?; }
        self.closed = true;
        Ok(())
    }

    pub fn abort(mut self) -> std::io::Result<()> {
        match remove_file(&self.temp) { Ok(()) => {}, Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}, Err(e) => return Err(e) }
        self.closed = true;
        Ok(())
    }
}

impl Drop for AtomicWrite {
    fn drop(&mut self) { if !self.closed { let _ = remove_file(&self.temp); } }
}

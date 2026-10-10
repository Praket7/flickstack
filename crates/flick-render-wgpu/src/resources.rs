use crate::cache::{ResourceCache, ResourceKey};
#[derive(Default)]
pub struct RendererResources {
    pub cache: ResourceCache,
    pub serial: u64,
}
impl RendererResources {
    pub fn touch(&mut self, key: ResourceKey) -> u64 {
        if let Some(id) = self.cache.get(&key) {
            return id;
        }
        self.serial += 1;
        self.cache.insert(key, self.serial);
        self.serial
    }
}

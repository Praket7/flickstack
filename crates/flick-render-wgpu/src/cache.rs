use std::collections::HashMap;
#[derive(Clone, Debug, Hash, PartialEq, Eq)]
pub struct ResourceKey {
    pub asset: String,
    pub frame: u32,
    pub variant: String,
    pub dependencies: u64,
}
#[derive(Default)]
pub struct ResourceCache {
    generation: u64,
    entries: HashMap<ResourceKey, u64>,
    hits: u64,
    misses: u64,
}
impl ResourceCache {
    pub fn get(&mut self, k: &ResourceKey) -> Option<u64> {
        if let Some(v) = self.entries.get(k) {
            self.hits += 1;
            Some(*v)
        } else {
            self.misses += 1;
            None
        }
    }
    pub fn insert(&mut self, k: ResourceKey, v: u64) {
        self.entries.insert(k, v);
    }
    pub fn invalidate_device(&mut self) {
        self.generation += 1;
        self.entries.clear();
    }
    pub fn stats(&self) -> (u64, u64) {
        (self.hits, self.misses)
    }
    pub fn generation(&self) -> u64 {
        self.generation
    }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('native renderer crates share the current EvaluatedScene and RenderError contracts', () => {
  const core = read('crates/flick-render-core/src/lib.rs');
  const scene = read('crates/flick-render-core/src/scene.rs');
  const gpu = read('crates/flick-render-wgpu/src/lib.rs');
  const layers = read('crates/flick-render-wgpu/src/layers.rs');
  const passes = read('crates/flick-render-wgpu/src/passes.rs');
  const parity = read('crates/flick-render-wgpu/tests/parity.rs');

  assert.match(core, /Invalid\(String\)/, 'RenderError must represent invalid native program/state');
  assert.match(core, /Device\(String\)/, 'RenderError must represent GPU device failures');
  assert.match(scene, /pub\s+layers\s*:\s*Vec<SceneLayer>/);
  assert.match(scene, /pub\s+fonts\s*:\s*Vec<FontResource>/);
  for (const source of [gpu, layers, passes, parity]) {
    assert.doesNotMatch(source, /\bdraws\s*:/, 'stale v0.3 draw-list field must not survive');
    assert.doesNotMatch(source, /\.draws\b/, 'stale v0.3 draw-list accessor must not survive');
  }
  assert.match(gpu, /layers\s*:\s*vec!\[\]/);
  assert.match(gpu, /fonts\s*:\s*vec!\[\]/);
});

test('GPU renderer cannot silently call the CPU renderer when a GPU device exists', () => {
  const gpu = read('crates/flick-render-wgpu/src/lib.rs');
  assert.doesNotMatch(gpu, /Until individual draw pass support is complete/);
  assert.match(gpu, /render_scene_gpu/);
  assert.match(gpu, /if\s+self\.device\.is_none\(\)\s*\{\s*return\s+self\.cpu\.render\(scene,\s*0\);/s);
});

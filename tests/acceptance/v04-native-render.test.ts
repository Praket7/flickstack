import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const gpu=readFileSync(new URL('../../crates/flick-render-wgpu/src/lib.rs',import.meta.url),'utf8');
const cli=readFileSync(new URL('../../crates/flick-render-cli/src/main.rs',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../../packages/render-gpu-native/src/bridge.ts',import.meta.url),'utf8');
const headless=readFileSync(new URL('../../crates/flick-render-cli/src/render.rs',import.meta.url),'utf8');
const text=readFileSync(new URL('../../crates/flick-text/src/glyphs.rs',import.meta.url),'utf8');

test('v0.4 GPU renderer does real device work instead of delegating GPU frames to CpuRenderer',()=>{
  assert.doesNotMatch(gpu,/fn render_scene_gpu[\s\S]{0,1200}cpu\.render\(/,'GPU path must not be a CPU reference bridge');
  for(const token of ['create_texture','create_command_encoder','submit']) assert.match(gpu,new RegExp(token),`GPU path missing ${token}`);
});

test('native CLI and bridge expose cpu gpu auto without FFmpeg visual-compositing fallback',()=>{
  assert.match(cli,/cpu/);assert.match(cli,/gpu/);assert.match(cli,/Backend::Auto/);
  assert.match(bridge,/native-v04|flick-render|renderNativeProgram/);
  assert.match(bridge,/projectVersion>=3\?'native-v04':'legacy-ffmpeg'/);
  assert.doesNotMatch(bridge,/spawnSync\([^)]*ffmpeg/i);
});


test('native final renderer converts evaluated v3 layers into real render-core primitives',()=>{
  assert.doesNotMatch(headless,/let _=evaluated|layers:vec!\[\]/);
  assert.match(headless,/scene_bridge::build_scene/);
  assert.match(text,/font_bytes/,'native shaping must retain resolved font bytes for render-core');
});

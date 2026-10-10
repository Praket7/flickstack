import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCacheKey } from '../src/index.ts';

const base = {
  renderProgram: { layers: [{ id: 'a', opacity: 1 }] }, assetHashes: ['sha256:a'], rendererVersion: '0.5', backend: 'wgpu',
  plugins: [{ id: 'fx.blur', version: '1.0' }], colorConfig: { id: 'aces-1' }, fonts: [{ family: 'Inter', hash: 'f1' }], quality: 'final', outputFormat: 'mp4',
};

test('render cache key is canonical across object key order', () => {
  const a = renderCacheKey(base);
  const b = renderCacheKey({ outputFormat: 'mp4', quality: 'final', fonts: base.fonts, colorConfig: base.colorConfig, plugins: base.plugins, backend: 'wgpu', rendererVersion: '0.5', assetHashes: ['sha256:a'], renderProgram: base.renderProgram });
  assert.equal(a, b);
});

test('render cache key invalidates on semantic render dependencies', () => {
  const key = renderCacheKey(base);
  assert.notEqual(renderCacheKey({ ...base, assetHashes: ['sha256:b'] }), key);
  assert.notEqual(renderCacheKey({ ...base, backend: 'cpu' }), key);
  assert.notEqual(renderCacheKey({ ...base, colorConfig: { id: 'aces-2' } }), key);
});

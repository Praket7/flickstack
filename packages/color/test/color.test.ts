import test from 'node:test';
import assert from 'node:assert/strict';
import { applyColorPipeline, computeScopes, encodeHdrMetadata, resolveColorPipeline } from '../src/index.ts';

test('resolves explicit ACES/OCIO pipeline and applies deterministic transform', () => {
  const pipeline = resolveColorPipeline({ input: 'srgb', working: 'acescg', output: 'rec709', ocioConfigId: 'studio-v1' });
  assert.equal(pipeline.working, 'acescg');
  assert.equal(pipeline.ocioConfigId, 'studio-v1');
  const out = applyColorPipeline([0.25, 0.5, 0.75, 1], pipeline);
  assert.equal(out.length, 4);
  assert.ok(out.every((v) => Number.isFinite(v)));
  assert.notDeepEqual(out.slice(0, 3), [0.25, 0.5, 0.75]);
});

test('computes waveform, histogram and vectorscope data without mutating pixels', () => {
  const pixels = new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
  const before = Array.from(pixels);
  const scopes = computeScopes(pixels, 3, 1);
  assert.equal(scopes.histogram.length, 256);
  assert.equal(scopes.waveform.length, 3);
  assert.equal(scopes.vectorscope.length, 3);
  assert.deepEqual(Array.from(pixels), before);
});

test('encodes explicit PQ and HLG metadata', () => {
  assert.equal(encodeHdrMetadata({ transfer: 'pq', maxNits: 1000 }).transferCharacteristic, 'smpte2084');
  assert.equal(encodeHdrMetadata({ transfer: 'hlg', maxNits: 1000 }).transferCharacteristic, 'arib-std-b67');
});

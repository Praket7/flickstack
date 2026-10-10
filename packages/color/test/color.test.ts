import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyColorPipeline,
  applyOcioPipeline,
  computeScopes,
  decodeHdrTransfer,
  encodeHdrMetadata,
  encodeHdrTransfer,
  resolveColorPipeline,
} from '../src/index.ts';

test('resolves explicit ACES/OCIO pipeline and applies deterministic transform', () => {
  const pipeline = resolveColorPipeline({ input: 'srgb', working: 'acescg', output: 'rec709', ocioConfigId: 'studio-v1' });
  assert.equal(pipeline.working, 'acescg');
  assert.equal(pipeline.ocioConfigId, 'studio-v1');
  const out = applyColorPipeline([0.25, 0.5, 0.75, 1], pipeline);
  assert.equal(out.length, 4);
  assert.ok(out.every((v) => Number.isFinite(v)));
  assert.notDeepEqual(out.slice(0, 3), [0.25, 0.5, 0.75]);
});

test('performs real Display-P3 primary conversion instead of treating P3 as sRGB', () => {
  const p3ToSrgb = resolveColorPipeline({ input: 'display-p3', working: 'acescg', output: 'srgb' });
  const out = applyColorPipeline([1, 0, 0, 1], p3ToSrgb);
  assert.equal(out[0], 1);
  assert.ok(out[1] < 0.05);
  assert.ok(out[2] < 0.05);

  const neutral = applyColorPipeline([0.5, 0.5, 0.5, 1], p3ToSrgb);
  assert.ok(Math.abs(neutral[0] - neutral[1]) < 0.002);
  assert.ok(Math.abs(neutral[1] - neutral[2]) < 0.002);
});

test('round-trips PQ absolute luminance and HLG scene-linear values', () => {
  for (const nits of [0, 0.1, 100, 1000, 4000]) {
    const encoded = encodeHdrTransfer(nits, 'pq');
    const decoded = decodeHdrTransfer(encoded, 'pq');
    assert.ok(Math.abs(decoded - nits) <= Math.max(0.001, nits * 1e-5));
  }
  for (const linear of [0, 0.01, 0.18, 0.5, 1]) {
    const encoded = encodeHdrTransfer(linear, 'hlg');
    const decoded = decodeHdrTransfer(encoded, 'hlg');
    assert.ok(Math.abs(decoded - linear) < 1e-6);
  }
});

test('routes OCIO transforms through an explicit native processor boundary', () => {
  const pipeline = resolveColorPipeline({ input: 'srgb', working: 'acescg', output: 'display-p3', ocioConfigId: 'aces-1.3', look: 'film' });
  const calls: unknown[] = [];
  const out = applyOcioPipeline([0.1, 0.2, 0.3, 1], pipeline, (request) => {
    calls.push(request);
    return [0.2, 0.3, 0.4, 1];
  });
  assert.deepEqual(out, [0.2, 0.3, 0.4, 1]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    configId: 'aces-1.3',
    input: 'srgb',
    output: 'display-p3',
    look: 'film',
    rgba: [0.1, 0.2, 0.3, 1],
  });
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

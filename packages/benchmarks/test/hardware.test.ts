import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBenchmark, summarizeBenchmark } from '../src/index.ts';

const hardware = { os: 'linux', cpu: 'x86_64-test', gpu: 'test-gpu', ramGb: 32, renderer: 'wgpu', driver: '1.0' };

test('benchmark claims require at least three measured samples', () => {
  assert.throws(() => summarizeBenchmark({ hardware, projectHash: 'p', samples: [{ fps: 30, p95Ms: 40, memoryMb: 500, cacheHitRatio: 0.2 }] }), /three/i);
  const summary = summarizeBenchmark({ hardware, projectHash: 'p', samples: [
    { fps: 30, p95Ms: 40, memoryMb: 500, cacheHitRatio: 0.2 },
    { fps: 32, p95Ms: 38, memoryMb: 510, cacheHitRatio: 0.4 },
    { fps: 31, p95Ms: 39, memoryMb: 505, cacheHitRatio: 0.3 },
  ] });
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.medianFps, 31);
});

test('regression comparison only makes claims on matching hardware fingerprints', () => {
  const base = summarizeBenchmark({ hardware, projectHash: 'p', samples: [
    { fps: 30, p95Ms: 40, memoryMb: 500, cacheHitRatio: 0.2 }, { fps: 30, p95Ms: 40, memoryMb: 500, cacheHitRatio: 0.2 }, { fps: 30, p95Ms: 40, memoryMb: 500, cacheHitRatio: 0.2 },
  ] });
  const current = { ...base, medianFps: 20, p95Ms: 60 };
  assert.equal(compareBenchmark(base, current).regression, true);
  assert.throws(() => compareBenchmark(base, { ...current, hardware: { ...hardware, gpu: 'other' } }), /hardware/i);
});

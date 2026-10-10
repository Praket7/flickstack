import { createHash } from 'node:crypto';

export interface HardwareFingerprint { os: string; cpu: string; gpu: string; ramGb: number; renderer: string; driver: string }
export interface BenchmarkSample { fps: number; p95Ms: number; memoryMb: number; cacheHitRatio: number }
export interface BenchmarkSummary {
  hardware: HardwareFingerprint;
  hardwareId: string;
  projectHash: string;
  sampleCount: number;
  medianFps: number;
  p95Ms: number;
  medianMemoryMb: number;
  medianCacheHitRatio: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
};
export function hardwareFingerprintId(hardware: HardwareFingerprint): string {
  const stable = JSON.stringify({ cpu: hardware.cpu, driver: hardware.driver, gpu: hardware.gpu, os: hardware.os, ramGb: hardware.ramGb, renderer: hardware.renderer });
  return `sha256:${createHash('sha256').update(stable).digest('hex')}`;
}
export function summarizeBenchmark(input: { hardware: HardwareFingerprint; projectHash: string; samples: BenchmarkSample[] }): BenchmarkSummary {
  if (input.samples.length < 3) throw new Error('At least three measured benchmark samples are required before making performance claims');
  for (const sample of input.samples) {
    if (![sample.fps,sample.p95Ms,sample.memoryMb,sample.cacheHitRatio].every(Number.isFinite)) throw new Error('Benchmark sample contains non-finite metrics');
    if (sample.fps <= 0 || sample.p95Ms < 0 || sample.memoryMb < 0 || sample.cacheHitRatio < 0 || sample.cacheHitRatio > 1) throw new Error('Benchmark sample is outside valid ranges');
  }
  return {
    hardware: structuredClone(input.hardware), hardwareId: hardwareFingerprintId(input.hardware), projectHash: input.projectHash, sampleCount: input.samples.length,
    medianFps: median(input.samples.map((s)=>s.fps)), p95Ms: percentile(input.samples.map((s)=>s.p95Ms), 0.95),
    medianMemoryMb: median(input.samples.map((s)=>s.memoryMb)), medianCacheHitRatio: median(input.samples.map((s)=>s.cacheHitRatio)),
  };
}
export function compareBenchmark(baseline: BenchmarkSummary, current: BenchmarkSummary, tolerance = { throughput: 0.15, p95: 0.20 }) {
  if (baseline.hardwareId !== current.hardwareId) throw new Error('Benchmark hardware fingerprints do not match; cross-hardware regression claims are invalid');
  if (baseline.projectHash !== current.projectHash) throw new Error('Benchmark project hashes do not match');
  const throughputDrop = baseline.medianFps > 0 ? (baseline.medianFps - current.medianFps) / baseline.medianFps : 0;
  const p95Increase = baseline.p95Ms > 0 ? (current.p95Ms - baseline.p95Ms) / baseline.p95Ms : 0;
  return { regression: throughputDrop > tolerance.throughput || p95Increase > tolerance.p95, throughputDrop, p95Increase, tolerance };
}

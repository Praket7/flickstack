import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { platform, arch, cpus, totalmem, release } from 'node:os';
import { summarizeBenchmark } from '../packages/render-preview/src/index.ts';

const base=summarizeBenchmark({status:'blocked',backend:'webgpu',reason:'GPU execution unavailable in this runner: no verified browser WebGPU adapter; run the browser harness on GPU-enabled hardware'});
const report={
  ...base,
  scenario:'1080p30-two-layer-h264',
  codec:'H.264',
  proxyMode:'off',
  hardware:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model??'unknown',logicalCpus:cpus().length,memoryBytes:totalmem()},
  recordedAt:new Date().toISOString()
};
const out=process.argv[2]??'benchmarks/v0.2/current.json';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(out);console.log(JSON.stringify(report));

import { performance } from 'node:perf_hooks';
import { cpus, platform, arch, release } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createMotionComponent } from '../../packages/motion-components/src/index.ts';
import { evaluateMotionComposition } from '../../packages/motion/src/v3.ts';

const component=createMotionComponent('message-composer',{title:'Build a professional motion system',subtitle:'Structured, reversible, deterministic'});
const composition=component.composition;
const warmup=120,frames=1800;
for(let i=0;i<warmup;i++)evaluateMotionComposition(composition,i%composition.duration,{fps:30,audio:{energy:(i%30)/30}});
const start=performance.now();
for(let i=0;i<frames;i++)evaluateMotionComposition(composition,i%composition.duration,{fps:30,audio:{energy:(i%30)/30}});
const elapsedMs=performance.now()-start;
const cargo=spawnSync('cargo',['--version'],{encoding:'utf8',timeout:3000});
const report={
  kind:'motion-v03-foundation',
  measuredAt:new Date().toISOString(),
  environment:{platform:platform(),arch:arch(),osRelease:release(),node:process.version,cpu:cpus()[0]?.model??'unknown',logicalCpus:cpus().length},
  sceneGraphEvaluation:{scenario:'editable message-composer composition; scene-graph/property/layout evaluation only',frames,elapsedMs:Number(elapsedMs.toFixed(3)),framesPerSecond:Number((frames/(elapsedMs/1000)).toFixed(2)),pixelRendering:false},
  webgpu:{status:'blocked',framesPerSecond:null,reason:'This harness does not have a verified WebGPU adapter/hardware preview context; no GPU preview FPS is fabricated.'},
  nativeToolchain:cargo.status===0?{status:'available-unverified',cargo:String(cargo.stdout).trim(),reason:'Cargo exists, but this benchmark does not claim a built/signed desktop package.'}:{status:'blocked',cargo:null,reason:'Cargo/Rust toolchain is unavailable in this runner; native desktop compilation is not claimed.'},
};
console.log(JSON.stringify(report));

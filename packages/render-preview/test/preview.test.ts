import test from 'node:test';import assert from 'node:assert/strict';
import { selectPreviewBackend, AdaptiveQualityController, chooseRecoveryBackend, compareFrames, assertDeclaredApproximation, summarizeBenchmark } from '../src/index.ts';

test('selects preview backends without silent degradation',()=>{
 assert.equal(selectPreviewBackend({webGpu:true,webCodecs:true,nativeGpu:true,software:true}).backend,'webgpu');
 assert.equal(selectPreviewBackend({webGpu:true,webCodecs:false,nativeGpu:true,software:true}).backend,'native');
 assert.equal(selectPreviewBackend({webGpu:false,webCodecs:false,nativeGpu:false,software:true}).backend,'software');
 assert.equal(selectPreviewBackend({webGpu:false,webCodecs:false,nativeGpu:false,software:false}).backend,'unavailable');
});
test('adaptive quality uses hysteresis and device loss chooses next backend',()=>{
 const q=new AdaptiveQualityController('full'); q.observe(40,33);q.observe(40,33);assert.equal(q.quality,'full');q.observe(40,33);assert.equal(q.quality,'half');for(let i=0;i<20;i++)q.observe(10,33);assert.equal(q.quality,'full');
 assert.equal(chooseRecoveryBackend({nativeGpu:true,software:true}),'native');assert.equal(chooseRecoveryBackend({nativeGpu:false,software:true}),'software');
});
test('equivalence measures RGBA error and undeclared approximations fail',()=>{
 const a=new Uint8Array([255,0,0,255, 0,0,255,255]);const b=new Uint8Array([250,0,0,255, 0,0,250,255]);const m=compareFrames(a,b,2,1);assert.ok(m.pixelRmse>0&&m.pixelRmse<.03);assert.equal(m.alphaRmse,0);assert.throws(()=>assertDeclaredApproximation('blur','approximate',undefined),/tolerance/i);assert.doesNotThrow(()=>assertDeclaredApproximation('blur','approximate',{pixelRmse:.05}));
});
test('benchmark summary is non-null only for measured runs',()=>{const b=summarizeBenchmark({status:'measured',backend:'webgpu',frameTimesMs:[10,20,30],seekLatenciesMs:[40,60],droppedFrames:1,totalFrames:10,cacheHits:7,cacheMisses:3});assert.equal(b.status,'measured');assert.equal(b.p95FrameMs,30);assert.equal(b.cacheHitRate,.7);const x=summarizeBenchmark({status:'blocked',backend:'webgpu',reason:'no adapter'});assert.equal(x.fps,null);});

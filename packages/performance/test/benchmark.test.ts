import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoPerformanceRegression,summarizeBenchmark,type BenchmarkRun} from '../src/index.ts';
const hardware={os:'linux',arch:'x64',cpu:'test',gpu:'gpu',ramBytes:16,nodeVersion:'22',rendererVersion:'1'};
const run=(fps:number,p95:number):BenchmarkRun=>({id:'r',projectHash:'p',hardware,samples:[0,1,2].map(i=>({throughputFps:fps+i,p95FrameMs:p95+i,peakMemoryBytes:100+i,cacheHitRatio:.5,cold:i===0})),createdAt:'2026-10-10T00:00:00Z'});
test('benchmark summaries require three real samples',()=>{assert.equal(summarizeBenchmark(run(30,20)).sampleCount,3);assert.throws(()=>summarizeBenchmark({...run(30,20),samples:run(30,20).samples.slice(0,2)}))});
test('matching hardware regression gate rejects large slowdowns',()=>{assert.doesNotThrow(()=>assertNoPerformanceRegression(run(30,20),run(28,22)));assert.throws(()=>assertNoPerformanceRegression(run(30,20),run(20,30))) });

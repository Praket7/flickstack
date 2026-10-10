import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderWorkerPool,hashRenderJob,type ImmutableRenderJob} from '../src/index.ts';
const hash='a'.repeat(64);
const job:ImmutableRenderJob={id:'j',projectId:'p',projectRevision:'r1',renderProgramRevision:'rp1',renderContractVersion:'1',rendererVersion:'1',backend:'gpu',assetHashes:[hash],outputFormat:'mp4',quality:{level:'final'},outputPath:'out/final.mp4'};
test('render job hash is deterministic and revision sensitive',()=>{assert.equal(hashRenderJob(job),hashRenderJob({...job,assetHashes:[hash]}));assert.notEqual(hashRenderJob(job),hashRenderJob({...job,projectRevision:'r2'}))});
test('worker pool leases only compatible immutable workers',()=>{const pool=new RenderWorkerPool();assert.throws(()=>pool.register({id:'mutable',renderContractVersion:'1',rendererVersion:'1',backends:['gpu'],concurrency:1,immutable:false,healthy:true}));pool.register({id:'w',renderContractVersion:'1',rendererVersion:'1',backends:['gpu'],concurrency:1,immutable:true,healthy:true});const lease=pool.lease(job);assert.equal(lease.workerId,'w');assert.throws(()=>pool.lease(job));pool.release(lease);assert.equal(pool.lease(job).workerId,'w')});

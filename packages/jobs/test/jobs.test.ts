import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStore, JobScheduler } from '../src/index.ts';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('idempotent enqueue and restart recovery persist through SQLite',async()=>{
 const d=mkdtempSync(join(tmpdir(),'fsjobs-'));try{
  const path=join(d,'jobs.db');let s=new JobStore(path);const a=s.enqueue({projectId:'p',type:'render',resourceClass:'cpu',payload:{x:1},idempotencyKey:'same',dependencies:[],retryClass:'safe'});const b=s.enqueue({projectId:'p',type:'render',resourceClass:'cpu',payload:{x:2},idempotencyKey:'same',dependencies:[],retryClass:'safe'});assert.equal(a.id,b.id);s.markRunning(a.id);s.close();
  s=new JobStore(path);assert.equal(s.get(a.id)?.state,'running');assert.equal(s.recoverInterrupted(),1);assert.equal(s.get(a.id)?.state,'queued');s.close();
 }finally{rmSync(d,{recursive:true,force:true});}
});

test('scheduler respects dependency and per-resource concurrency cap',async()=>{
 const s=new JobStore(':memory:');const q=new JobScheduler(s,{cpu:1,io:2,gpu:1,model:1});const order:string[]=[];let active=0,max=0;
 q.register('work',async(job)=>{active++;max=Math.max(max,active);order.push('start:'+job.id);await sleep(20);order.push('end:'+job.id);active--;return {ok:true};});
 const a=s.enqueue({projectId:'p',type:'work',resourceClass:'cpu',payload:{},idempotencyKey:'a',dependencies:[],retryClass:'safe'});const b=s.enqueue({projectId:'p',type:'work',resourceClass:'cpu',payload:{},idempotencyKey:'b',dependencies:[a.id],retryClass:'safe'});const c=s.enqueue({projectId:'p',type:'work',resourceClass:'cpu',payload:{},idempotencyKey:'c',dependencies:[],retryClass:'safe'});
 await q.runUntilIdle();assert.equal(max,1);assert.equal(s.get(a.id)?.state,'completed');assert.equal(s.get(b.id)?.state,'completed');assert.ok(order.indexOf('end:'+a.id)<order.indexOf('start:'+b.id));s.close();
});

test('scheduler cancels running jobs via AbortSignal',async()=>{
 const s=new JobStore(':memory:');const q=new JobScheduler(s,{cpu:1,io:1,gpu:1,model:1});q.register('slow',async(_job,signal)=>{while(!signal.aborted)await sleep(5);throw new Error('aborted');});const j=s.enqueue({projectId:'p',type:'slow',resourceClass:'cpu',payload:{},idempotencyKey:'slow',dependencies:[],retryClass:'safe'});const run=q.runUntilIdle();await sleep(20);q.cancel(j.id);await run;assert.equal(s.get(j.id)?.state,'cancelled');s.close();
});

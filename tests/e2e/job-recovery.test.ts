import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { JobStore, JobScheduler } from '../../packages/jobs/src/index.ts';

function waitLine(child:ReturnType<typeof spawn>):Promise<string>{return new Promise((resolve,reject)=>{let buf='';child.stdout?.setEncoding('utf8');child.stdout?.on('data',c=>{buf+=c;const i=buf.indexOf('\n');if(i>=0)resolve(buf.slice(0,i).trim());});child.once('error',reject);setTimeout(()=>reject(new Error('child did not report ready')),3000);});}
function waitClose(child:ReturnType<typeof spawn>):Promise<void>{return new Promise(resolve=>child.once('close',()=>resolve()));}

test('killed running job is recovered and idempotency prevents duplicate output',async()=>{
 const d=mkdtempSync(join(tmpdir(),'flick-job-crash-'));try{const db=join(d,'jobs.db'),out=join(d,'render.txt');const mod=pathToFileURL(join(process.cwd(),'packages/jobs/src/index.ts')).href;
 const code=`import {JobStore} from ${JSON.stringify(mod)};const s=new JobStore(process.env.DB);const j=s.enqueue({projectId:'p',type:'render',resourceClass:'cpu',payload:{},idempotencyKey:'render-v1',dependencies:[],retryClass:'safe'});s.markRunning(j.id);console.log(j.id);setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,DB:db},stdio:['ignore','pipe','pipe']});const id=await waitLine(child);child.kill('SIGKILL');await waitClose(child);
 const store=new JobStore(db);assert.equal(store.get(id)?.state,'running');assert.equal(store.recoverInterrupted(),1);assert.equal(store.get(id)?.state,'queued');const scheduler=new JobScheduler(store,{cpu:1,io:1,gpu:1,model:1});scheduler.register('render',async()=>{await import('node:fs').then(fs=>fs.appendFileSync(out,'x'));return{path:out};});await scheduler.runUntilIdle();assert.equal(store.get(id)?.state,'completed');assert.equal(readFileSync(out,'utf8'),'x');
 const same=store.enqueue({projectId:'p',type:'render',resourceClass:'cpu',payload:{again:true},idempotencyKey:'render-v1',dependencies:[],retryClass:'safe'});assert.equal(same.id,id);await scheduler.runUntilIdle();assert.equal(readFileSync(out,'utf8'),'x');store.close();
 }finally{rmSync(d,{recursive:true,force:true});}
});

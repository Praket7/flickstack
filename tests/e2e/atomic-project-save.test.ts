import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { AtomicProjectWrite } from '../../packages/desktop-runtime/src/index.ts';

function waitLine(child:ReturnType<typeof spawn>):Promise<string>{return new Promise((resolve,reject)=>{let buf='';child.stdout?.setEncoding('utf8');child.stdout?.on('data',c=>{buf+=c;const i=buf.indexOf('\n');if(i>=0)resolve(buf.slice(0,i).trim());});child.once('error',reject);setTimeout(()=>reject(new Error('child did not prepare write')),3000);});}
function waitClose(child:ReturnType<typeof spawn>):Promise<void>{return new Promise(resolve=>child.once('close',()=>resolve()));}

test('killed prepared project save leaves old file valid and orphan recovery is safe',async()=>{
 const d=mkdtempSync(join(tmpdir(),'flick-save-crash-'));try{const target=join(d,'project.flick.json');writeFileSync(target,'{"version":1,"name":"old"}\n');const mod=pathToFileURL(join(process.cwd(),'packages/desktop-runtime/src/index.ts')).href;
 const code=`import {AtomicProjectWrite} from ${JSON.stringify(mod)};const w=AtomicProjectWrite.prepare(process.env.TARGET,'{"version":2,"name":"new"}\\n');console.log(w.tempPath);setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,TARGET:target},stdio:['ignore','pipe','pipe']});const temp=await waitLine(child);assert.ok(existsSync(temp));child.kill('SIGKILL');await waitClose(child);assert.equal(JSON.parse(readFileSync(target,'utf8')).name,'old');
 assert.equal(AtomicProjectWrite.recoverOrphans(target),1);assert.equal(existsSync(temp),false);assert.equal(JSON.parse(readFileSync(target,'utf8')).name,'old');
 const next=AtomicProjectWrite.prepare(target,'{"version":2,"name":"committed"}\n');next.commit();assert.equal(JSON.parse(readFileSync(target,'utf8')).name,'committed');
 }finally{rmSync(d,{recursive:true,force:true});}
});

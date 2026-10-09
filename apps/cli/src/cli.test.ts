import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCli } from './index.ts';

test('init creates canonical project.flick.json',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-cli-'));
 const code=runCli(['init','launch-ad','--dir',dir],{log:()=>{}});
 assert.equal(code,0); const path=join(dir,'launch-ad','project.flick.json'); assert.equal(existsSync(path),true);
 const p=JSON.parse(readFileSync(path,'utf8')); assert.equal(p.name,'launch-ad'); assert.equal(p.version,1);
});

test('doctor checks local free runtime dependencies',()=>{
 const lines:string[]=[]; const code=runCli(['doctor'],{log:(s)=>lines.push(s)});
 assert.equal(code,0); assert.ok(lines.join('\n').includes('ffmpeg')); assert.ok(lines.join('\n').includes('ffprobe'));
});

test('ingest persists asset analysis so search survives separate CLI calls',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-cli-search-'));
 runCli(['init','demo','--dir',dir],{log:()=>{}}); const root=join(dir,'demo'); const media=join(root,'product-demo.mp4');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=orange:s=160x120:r=30:d=0.5','-c:v','libx264','-pix_fmt','yuv420p',media],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const project=join(root,'project.flick.json');
 assert.equal(runCli(['ingest',media,'--project',project],{log:()=>{}}),0);
 const lines:string[]=[]; assert.equal(runCli(['search','product demo','--project',project],{log:s=>lines.push(s)}),0);
 const results=JSON.parse(lines.at(-1)!); assert.equal(results[0].assetId,'product-demo');
});

test('style save and apply round-trip project style packages',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-cli-style-')); runCli(['init','demo','--dir',dir],{log:()=>{}});
 const project=join(dir,'demo','project.flick.json'), style=join(dir,'style.json');
 const p=JSON.parse(readFileSync(project,'utf8')); p.style={captionMaxChars:36,transitions:['cut']}; writeFileSync(project,JSON.stringify(p));
 assert.equal(runCli(['style','save',style,'--project',project],{log:()=>{}}),0);
 p.style={}; writeFileSync(project,JSON.stringify(p));
 assert.equal(runCli(['style','apply',style,'--project',project],{log:()=>{}}),0);
 assert.equal(JSON.parse(readFileSync(project,'utf8')).style.captionMaxChars,36);
});


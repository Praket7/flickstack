import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reviewRender, buildRepairPlan } from './qc.ts';
import type { FlickProject } from '../../schema/src/project.ts';

function blackVideo(path:string):void { const r=spawnSync('ffmpeg',['-y','-f','lavfi','-i','color=c=black:s=320x240:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p',path],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr); }
function project(path:string):FlickProject{return {version:1,id:'p',name:'P',format:{width:320,height:240,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path,kind:'video',duration:30}],tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'c1',assetId:'a',start:0,duration:30,sourceIn:0}]},{id:'c1t',kind:'caption',name:'Captions',clips:[{id:'cap',start:0,duration:30,sourceIn:0,text:'This caption is deliberately much longer than forty two characters and should be flagged.'}]}],markers:[],style:{captionMaxChars:42},provenance:[],checkpoints:[],branches:[]};}

test('reviewRender finds black frames and caption overflow with localized ranges',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-qc-')), out=join(dir,'black.mp4'); blackVideo(out);
 const result=reviewRender(out,project(out));
 assert.ok(result.issues.some(i=>i.type==='black_frames'&&i.startFrame===0));
 assert.ok(result.issues.some(i=>i.type==='caption_overflow'&&i.clipId==='cap'));
 assert.equal(result.blocking,false);
});

test('repair plan creates an isolated localized repair lane',()=>{
 const issue={id:'q1',type:'caption_overflow' as const,severity:'warning' as const,startFrame:10,endFrame:30,message:'caption too long',suggestion:'split caption',clipId:'cap'};
 const plan=buildRepairPlan(issue,project('/tmp/x.mp4'));
 assert.equal(plan.branchName,'repair/q1');
 assert.deepEqual(plan.range,{startFrame:10,endFrame:30});
 assert.match(plan.intent,/caption too long/i);
});

test('reviewRender detects frozen frames, dead air, and missing required attribution',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-qc-more-')), out=join(dir,'silent-red.mp4');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=red:s=320x240:r=30:d=1','-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',out],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const p=project(out); p.provenance=[{assetId:'a',provider:'commons',license:'CC BY 4.0',commercialAllowed:true,attributionRequired:true,sourceUrl:'https://example.com/a'}];
 const result=reviewRender(out,p);
 assert.ok(result.issues.some(i=>i.type==='frozen_frames'));
 assert.ok(result.issues.some(i=>i.type==='dead_air'));
 assert.ok(result.issues.some(i=>i.type==='missing_attribution'));
});

test('reviewRender flags repeated adjacent source shots as duplicate-shot risk',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-qc-dup-')), out=join(dir,'red.mp4');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=red:s=320x240:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p',out],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const p=project(out); p.tracks[0].clips=[{id:'c1',assetId:'a',start:0,duration:15,sourceIn:0},{id:'c2',assetId:'a',start:15,duration:15,sourceIn:0}];
 const result=reviewRender(out,p); assert.ok(result.issues.some(i=>i.type==='duplicate_shot'&&i.clipId==='c2'));
});

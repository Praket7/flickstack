import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildRenderPlan, renderProject } from './render.ts';
import { probeMedia } from '../../media/src/ingest.ts';
import type { FlickProject } from '../../schema/src/project.ts';

function makeClip(path:string,color:string):void {
  const r=spawnSync('ffmpeg',['-y','-f','lavfi','-i',`color=c=${color}:s=320x240:r=30:d=1`,'-c:v','libx264','-pix_fmt','yuv420p',path],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
}
function project(a:string,b:string):FlickProject { return {
 version:1,id:'r',name:'render',format:{width:320,height:240,fps:{numerator:30,denominator:1},audioSampleRate:48000},
 assets:[{id:'a',path:a,kind:'video',duration:30},{id:'b',path:b,kind:'video',duration:30}],
 tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'c1',assetId:'a',start:0,duration:15,sourceIn:0},{id:'c2',assetId:'b',start:15,duration:15,sourceIn:0}]}],
 markers:[],style:{},provenance:[],checkpoints:[],branches:[]}; }

test('buildRenderPlan uses exact rational frame timing',()=>{
 const p=project('/tmp/a.mp4','/tmp/b.mp4');
 const plan=buildRenderPlan(p);
 assert.deepEqual(plan.segments.map(s=>[s.assetId,s.timelineStartSeconds,s.durationSeconds]),[['a',0,.5],['b',.5,.5]]);
});

test('renderProject produces a playable final MP4 from timeline data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-render-')); const a=join(dir,'a.mp4'),b=join(dir,'b.mp4'),out=join(dir,'out.mp4');
 makeClip(a,'red'); makeClip(b,'blue');
 renderProject(project(a,b),out);
 const meta=probeMedia(out);
 assert.equal(meta.video?.width,320); assert.ok(Math.abs((meta.durationSeconds??0)-1)<.08);
});

test('renderProject honors clip speed for video and source audio',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-speed-')); const source=join(dir,'source.mp4'),out=join(dir,'out.mp4'),raw=join(dir,'pixel.rgb');
 const generated=spawnSync('ffmpeg',['-y',
   '-f','lavfi','-i','color=c=red:s=64x64:r=30:d=0.5',
   '-f','lavfi','-i','color=c=blue:s=64x64:r=30:d=0.5',
   '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.5',
   '-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=0.5',
   '-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a][3:a]concat=n=2:v=0:a=1[a]',
   '-map','[v]','-map','[a]','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source],{encoding:'utf8'});
 assert.equal(generated.status,0,generated.stderr);
 const p:FlickProject={version:1,id:'speed',name:'speed',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:source,kind:'video',duration:30}],tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'c1',assetId:'a',start:0,duration:15,sourceIn:0,speed:2}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 renderProject(p,out);
 const meta=probeMedia(out); assert.ok(Math.abs((meta.durationSeconds??0)-0.5)<0.08); assert.ok(meta.audio);
 const frame=spawnSync('ffmpeg',['-y','-ss','0.44','-i',out,'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24',raw],{encoding:'utf8'}); assert.equal(frame.status,0,frame.stderr);
 const pixel=Array.from(readFileSync(raw));
 assert.ok(pixel[2] > pixel[0] * 1.5,`expected sped-up frame to reach blue half, got rgb=${pixel.join(',')}`);
});

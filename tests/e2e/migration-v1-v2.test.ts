import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseProject, parseAnyProject, serializeProjectV2, type FlickProject } from '../../packages/schema/src/index.ts';
import { renderProject, renderProjectV2 } from '../../packages/render-ffmpeg/src/index.ts';

const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const run=(exe:string,args:string[])=>{const r=spawnSync(exe,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
const probe=(p:string)=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]));
const pixel=(p:string)=>{const r=spawnSync('ffmpeg',['-v','error','-ss','0.2','-i',p,'-vf','format=rgb24,crop=1:1:32:32','-frames:v','1','-f','rawvideo','-'],{encoding:null});assert.equal(r.status,0,String(r.stderr));return [...(r.stdout as Buffer).subarray(0,3)];};

test('v1 opens in memory without overwrite and explicit v2 save preserves rendered video + embedded audio',()=>{
 const d=mkdtempSync(join(tmpdir(),'flick-migrate-'));
 try{
  const media=join(d,'source.mp4');
  run('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=c=red:s=64x64:r=30:d=1','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',media]);
  const v1:FlickProject={version:1,id:'legacy',name:'Legacy',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:media,kind:'video',duration:30}],tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'c',assetId:'a',start:0,duration:30,sourceIn:0}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
  const v1Path=join(d,'project.flick.json'); writeFileSync(v1Path,JSON.stringify(v1,null,2)+'\n'); const before=sha(v1Path);
  const parsed=parseProject(JSON.parse(readFileSync(v1Path,'utf8'))); const v2=parseAnyProject(parsed);
  assert.equal(v2.version,2); assert.equal(sha(v1Path),before,'opening must not rewrite v1 file');
  const v2Path=join(d,'project.v2.flick.json'); writeFileSync(v2Path,serializeProjectV2(v2)); assert.equal(JSON.parse(readFileSync(v2Path,'utf8')).version,2);
  const oldOut=join(d,'old.mp4'),newOut=join(d,'new.mp4'); renderProject(parsed,oldOut); renderProjectV2(v2,newOut);
  const oldProbe=probe(oldOut),newProbe=probe(newOut); const oldDur=Number(oldProbe.format.duration),newDur=Number(newProbe.format.duration);
  assert.ok(Math.abs(oldDur-newDur)<0.05,`${oldDur} vs ${newDur}`); const np=pixel(newOut),op=pixel(oldOut); assert.ok(np.every((v,i)=>Math.abs(v-op[i])<=2),`${np} vs ${op}`);
  assert.ok(oldProbe.streams.some((s:any)=>s.codec_type==='audio'),'legacy render should have embedded audio');
  assert.ok(newProbe.streams.some((s:any)=>s.codec_type==='audio'),'v2 migration must preserve embedded video audio');
 }finally{rmSync(d,{recursive:true,force:true});}
});

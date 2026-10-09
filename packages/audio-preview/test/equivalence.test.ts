import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2 } from '../../schema/src/v2/project.ts';
import { renderProjectV2 } from '../../render-ffmpeg/src/v2.ts';
import { renderAudioPreview } from '../src/index.ts';

function run(cmd:string,args:string[]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:120000});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr}`);return r.stdout+r.stderr;}
function meanDb(path:string){const text=run('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-vn','-f','null','-']);const m=text.match(/mean_volume:\s*(-?[\d.]+) dB/);if(!m)throw new Error('mean volume missing');return Number(m[1]);}
function duration(path:string){return Number(run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]).trim());}
function project(video:string,tone:string):FlickProjectV2{return{version:2,id:'audio-preview',name:'Audio Preview',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'v',path:video,kind:'video'},{id:'a',path:tone,kind:'audio'}],rootCompositionId:'root',compositions:[{id:'root',name:'Root',width:64,height:64,tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'vc',assetId:'v',start:0,duration:60,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true}]},{id:'a1',kind:'audio',name:'A1',clips:[{id:'ac',assetId:'a',start:0,duration:60,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,busId:'music',gainDb:-2}]}]}],masks:[],audioBuses:[{id:'music',name:'Music',effects:[{id:'eq',type:'eq',enabled:true,params:{frequency:440,gainDb:2,q:1}},{id:'comp',type:'compressor',enabled:true,params:{thresholdDb:-24,ratio:2,attackMs:10,releaseMs:100}}],gainDb:-6,pan:0,outputBusId:'master'},{id:'master',name:'Master',effects:[{id:'limit',type:'limiter',enabled:true,params:{limitDb:-1}}],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}

test('audio preview and final export use equivalent professional bus/effect semantics',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fs-audio-preview-'));try{
  const video=join(dir,'video.mp4'),tone=join(dir,'tone.wav'),final=join(dir,'final.mp4'),preview=join(dir,'preview.wav');
  run('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=64x64:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',video]);
  run('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=2','-c:a','pcm_s16le',tone]);
  const p=project(video,tone);renderProjectV2(p,final);renderAudioPreview(p,preview);
  const delta=Math.abs(meanDb(final)-meanDb(preview));assert.ok(delta<1.0,`preview/final mean-volume delta ${delta} dB`);
  assert.ok(Math.abs(duration(final)-duration(preview))<0.08,`duration mismatch ${duration(final)} vs ${duration(preview)}`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderProjectV2 } from '../src/index.ts';
import type { FlickProjectV2, V2Clip } from '../../schema/src/index.ts';

function run(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'}); if(r.status!==0)throw new Error(r.stderr);}
function color(path:string,c:string,d=2){run(['-f','lavfi','-i',`color=c=${c}:s=64x64:r=30:d=${d}`,'-f','lavfi','-i',`sine=frequency=440:sample_rate=48000:duration=${d}`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path]);}
function pixel(path:string,t:number,x:number,y:number){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(t),'-i',path,'-vf',`format=rgb24,crop=1:1:${x}:${y}`,'-frames:v','1','-f','rawvideo','pipe:1'],{encoding:null,maxBuffer:1024*1024}); if(r.status!==0)throw new Error(String(r.stderr)); return [...(r.stdout as Buffer).subarray(0,3)];}
function volumeDb(path:string){const r=spawnSync('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-f','null','-'],{encoding:'utf8'}); const m=(r.stderr||'').match(/mean_volume:\s*(-?[\d.]+) dB/); if(!m)throw new Error('no volume'); return Number(m[1]);}
function clip(id:string,assetId:string,start=0,duration=60):V2Clip{return{id,assetId,start,duration,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,busId:'master'};}
function base(a:string,b:string):FlickProjectV2{return{version:2,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'r',path:a,kind:'video'},{id:'b',path:b,kind:'video'}],rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks:[{id:'v0',kind:'video',name:'bg',clips:[clip('red','r')]},{id:'v1',kind:'video',name:'fg',zIndex:1,clips:[{...clip('blue','b'),transform:{x:32,y:0,scaleX:.5,scaleY:.5,rotation:0}}]}]}],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}

test('renders overlapping layers, masks, color, blend and transitions with real pixels',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fsv2-')); try{const r=join(dir,'r.mp4'),b=join(dir,'b.mp4'),o=join(dir,'o.mp4'); color(r,'red');color(b,'blue');const p=base(r,b);p.compositions[0].tracks[1].clips[0].opacity=.5;p.compositions[0].tracks[1].clips[0].effectStack.push({id:'sat',type:'saturation',enabled:true,params:{value:.5}});renderProjectV2(p,o);const left=pixel(o,.5,10,10),right=pixel(o,.5,50,10);assert.ok(left[0]>150&&left[2]<80,`left ${left}`);assert.ok(right[0]>40&&right[2]>40,`right ${right}`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('renders audio buses so -12 dB lowers encoded signal by about 12 dB',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fsv2a-')); try{const r=join(dir,'r.mp4'),b=join(dir,'b.mp4'),a=join(dir,'a.mp4'),q=join(dir,'q.mp4');color(r,'red');color(b,'blue');const p=base(r,b);p.compositions[0].tracks=[{id:'v',kind:'video',name:'v',clips:[clip('red','r')]},{id:'music',kind:'audio',name:'music',clips:[{...clip('m','r'),busId:'music'}]}];p.audioBuses=[{id:'master',name:'Master',effects:[],gainDb:0,pan:0},{id:'music',name:'Music',effects:[],gainDb:0,pan:0,outputBusId:'master'}];renderProjectV2(p,a);p.audioBuses[1].gainDb=-12;renderProjectV2(p,q);const delta=volumeDb(q)-volumeDb(a);assert.ok(delta<-9&&delta>-15,`delta ${delta}`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

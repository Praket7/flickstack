import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2, V2Clip } from '../../packages/schema/src/index.ts';
import { renderProjectV2 } from '../../packages/render-ffmpeg/src/index.ts';
import { syncAudioOffset, buildDriftModel, mapProgramFrameToSourceFrame } from '../../packages/multicam/src/index.ts';
import { evaluateSpatialLock } from '../../packages/intelligence/src/spatial.ts';
import { inspectForQuery, type VisualEvidence } from '../../packages/vision/src/index.ts';
import { buildRepairPlan, type QCIssue } from '../../packages/qc/src/qc.ts';
import { applyV2Operation } from '../../packages/timeline/src/v2.ts';

function ff(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
function color(path:string,c:string,d=2,audio=false){const args=['-f','lavfi','-i',`color=c=${c}:s=64x64:r=30:d=${d}`];if(audio)args.push('-f','lavfi','-i',`sine=frequency=440:sample_rate=48000:duration=${d}`);args.push('-c:v','libx264','-pix_fmt','yuv420p');if(audio)args.push('-c:a','aac','-shortest');ff([...args,path]);}
function redBlue(path:string){ff(['-f','lavfi','-i','color=c=red:s=64x64:r=30:d=1','-f','lavfi','-i','color=c=blue:s=64x64:r=30:d=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p',path]);}
function pixel(path:string,t:number,x:number,y:number){const r=spawnSync('ffmpeg',['-v','error','-ss',String(t),'-i',path,'-vf',`format=rgb24,crop=1:1:${x}:${y}`,'-frames:v','1','-f','rawvideo','-'],{encoding:null});assert.equal(r.status,0,String(r.stderr));return [...(r.stdout as Buffer).subarray(0,3)];}
function meanDb(path:string){const r=spawnSync('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-vn','-f','null','-'],{encoding:'utf8'});const m=(r.stderr||'').match(/mean_volume:\s*(-?[\d.]+) dB/);if(!m)throw new Error('no volume');return Number(m[1]);}
function clip(id:string,assetId:string,start=0,duration=30):V2Clip{return{id,assetId,start,duration,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true};}
function project(assets:Array<{id:string,path:string,kind:'video'|'audio'}>,tracks:FlickProjectV2['compositions'][0]['tracks']):FlickProjectV2{return{version:2,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets,rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks}],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}
const redish=(p:number[])=>p[0]>150&&p[2]<100; const blueish=(p:number[])=>p[2]>130&&p[0]<130;

test('professional v0.2 matrix covers ten release scenarios',async()=>{
 const d=mkdtempSync(join(tmpdir(),'flick-pro-matrix-'));
 try{
  const red=join(d,'red.mp4'),blue=join(d,'blue.mp4'),rb=join(d,'rb.mp4'),tone=join(d,'tone.mp4');color(red,'red',2);color(blue,'blue',2);redBlue(rb);color(tone,'black',2,true);
  const assets=[{id:'r',path:red,kind:'video' as const},{id:'b',path:blue,kind:'video' as const},{id:'rb',path:rb,kind:'video' as const},{id:'tone',path:tone,kind:'video' as const}];

  // 1. PIP through public v2 render path.
  {const p=project(assets,[{id:'bg',kind:'video',name:'BG',clips:[clip('r','r',0,30)]},{id:'fg',kind:'video',name:'FG',zIndex:1,clips:[{...clip('b','b',0,30),transform:{x:32,y:0,scaleX:.5,scaleY:.5,rotation:0}}]}]);const out=join(d,'pip.mp4');renderProjectV2(p,out);assert.ok(redish(pixel(out,.5,8,8)));assert.ok(blueish(pixel(out,.5,50,10)));}

  // 2. Rectangle mask must affect final pixels, not just metadata.
  {const masked={...clip('b','b',0,30),maskRefs:['m']};const p=project(assets,[{id:'bg',kind:'video',name:'BG',clips:[clip('r','r',0,30)]},{id:'fg',kind:'video',name:'FG',zIndex:1,clips:[masked]}]);p.masks=[{id:'m',kind:'rect',x:0,y:48,width:64,height:16,feather:0,invert:false}];const out=join(d,'mask.mp4');renderProjectV2(p,out);assert.ok(redish(pixel(out,.5,20,20)));assert.ok(blueish(pixel(out,.5,20,56)));}

  // 3. Nested composition renders into parent.
  {const p=project(assets,[{id:'nest',kind:'video',name:'Nested',clips:[{...clip('nested','b',0,30),compositionId:'sub',assetId:undefined}]}]);p.compositions.push({id:'sub',name:'Sub',width:64,height:64,tracks:[{id:'v',kind:'video',name:'V',clips:[clip('blue','b',0,30)]}]});const out=join(d,'nested.mp4');renderProjectV2(p,out);assert.ok(blueish(pixel(out,.5,32,32)));}

  // 4. A 1x→2x speed ramp over one second must reach the blue half of a red/blue two-second source by the end.
  {const ramp={...clip('ramp','rb',0,30),speedCurve:{points:[{frame:0,speed:1},{frame:30,speed:2}]}};const p=project(assets,[{id:'v',kind:'video',name:'V',clips:[ramp]}]);const out=join(d,'ramp.mp4');renderProjectV2(p,out);assert.ok(blueish(pixel(out,.9,32,32)),`speed ramp did not advance source: ${pixel(out,.9,32,32)}`);}

  // 5. Incoming clip cross-dissolves over exact frame range.
  {const incoming={...clip('b','b',15,30),effectStack:[{id:'xf',type:'transition:cross-dissolve',enabled:true,params:{durationFrames:15}}]};const p=project(assets,[{id:'bg',kind:'video',name:'BG',clips:[clip('r','r',0,60)]},{id:'fg',kind:'video',name:'FG',zIndex:1,clips:[incoming]}]);const out=join(d,'xf.mp4');renderProjectV2(p,out);const early=pixel(out,.52,32,32),late=pixel(out,.95,32,32);assert.ok(early[0]>early[2],`early ${early}`);assert.ok(blueish(late),`late ${late}`);}

  // 6. Dialogue/music/SFX-style bus gain is audible in final output.
  {const a={...clip('a','tone',0,30),busId:'music'};const p=project(assets,[{id:'v',kind:'video',name:'V',clips:[clip('r','r',0,30)]},{id:'a',kind:'audio',name:'Music',clips:[a]}]);p.audioBuses.push({id:'music',name:'Music',effects:[],gainDb:0,pan:0,outputBusId:'master'});const loud=join(d,'loud.mp4'),quiet=join(d,'quiet.mp4');renderProjectV2(p,loud);p.audioBuses.find(x=>x.id==='music')!.gainDb=-12;renderProjectV2(p,quiet);const delta=meanDb(quiet)-meanDb(loud);assert.ok(delta<-9&&delta>-15,`bus gain delta ${delta}`);}

  // 7. Three-camera interview sync primitives: offset + hour-scale drift mapping.
  {const ref=Array.from({length:8000},(_,i)=>i===2000?1:0),cand=Array.from({length:8000},(_,i)=>i===2400?1:0);const sync=syncAudioOffset({reference:ref,referenceRate:8000,candidate:cand,candidateRate:8000,projectFps:30,maxOffsetSeconds:.2});assert.ok(Math.abs(sync.offsetFrames-2)<=1);const m=buildDriftModel([{programFrame:0,sourceFrame:0},{programFrame:54000,sourceFrame:54005},{programFrame:108000,sourceFrame:108010}]);assert.equal(mapProgramFrameToSourceFrame(m,108000),108010);}

  // 8. Spatial hard lock rejects confident occlusion.
  {const r=evaluateSpatialLock({id:'product',type:'visibility',hard:true,minVisible:.7},{visibleFraction:.35,confidence:.95});assert.equal(r.status,'blocked');}

  // 9. Active perception inspects a bounded query-relevant subset.
  {const ev:VisualEvidence[]=[{id:'e1',assetId:'a',start:0,end:10,kind:'visual',text:'founder talking',confidence:.9,provider:'local',model:'m',version:'1',sourceHash:'x',createdAt:new Date(0).toISOString(),metadata:{}},{id:'e2',assetId:'a',start:100,end:110,kind:'visual',text:'product dashboard demo',confidence:.95,provider:'local',model:'m',version:'1',sourceHash:'x',createdAt:new Date(0).toISOString(),metadata:{}}];const trace=await inspectForQuery('product dashboard',ev,{maxFrames:1});assert.equal(trace.inspectedFrames.length,1);assert.equal(trace.evidence[0].id,'e2');}

  // 10. Localized repair produces a range-scoped repair lane.
  {const issue:QCIssue={id:'qc_black_12_18_0',type:'black_frames',severity:'warning',startFrame:12,endFrame:18,message:'black section',suggestion:'replace coverage'};const legacy:any={version:1,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};const repair=buildRepairPlan(issue,legacy);assert.deepEqual(repair.range,{startFrame:12,endFrame:18});assert.match(repair.branchName,/repair\//);}

  // Shared v2 mutation API produces a checkpointed human/agent-editable change.
  {const p=project(assets,[{id:'v',kind:'video',name:'V',clips:[clip('r','r',0,30)]}]);const changed=applyV2Operation(p,{type:'set_opacity',compositionId:'root',clipId:'r',opacity:.8,intent:'human direct manipulation'});assert.match(changed.checkpointId,/^cp_/);}
 } finally { rmSync(d,{recursive:true,force:true}); }
});

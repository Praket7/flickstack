import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMotionFrames,type MotionFrameSample,type MotionShotRange,type MotionAnnotation} from '../src/motion-analysis.ts';

function frame(n:number,occupancy:number,phase:number,cut=false):MotionFrameSample{
  const width=20,height=12,total=width*height;const luma=new Uint8Array(total);const active=Math.round(total*occupancy);
  for(let i=0;i<active;i++)luma[(i+phase)%total]=cut?230:120+((i+phase)%30);
  return {frame:n,width,height,luma:[...luma]};
}

function failedV03(){
 const frames:MotionFrameSample[]=[];let f=0;
 for(let shot=0;shot<5;shot++)for(let i=0;i<24;i++,f++)frames.push(frame(f,shot===2?.20:.10,i<2?i:2,i===0));
 const shots:MotionShotRange[]=Array.from({length:5},(_,i)=>({id:`s${i}`,start:i*24,end:(i+1)*24-1}));
 const annotations:MotionAnnotation[]=[
  {kind:'ui',start:0,end:119,occupancy:.12,safeMarginPx:92},
  {kind:'text',start:0,end:119,projectedPixelHeight:14,safeMarginPx:40},
  {kind:'activity',start:0,end:119,independentMotionGroups:1,activeLayerCount:1},
  {kind:'end-card',start:116,end:119,resolvedAt:118},
 ];
 return{frames,shots,annotations};
}

test('failed v0.3-style product film is rejected for bland motion and spacing',()=>{
 const {frames,shots,annotations}=failedV03();
 const report=analyzeMotionFrames(frames,shots,annotations,{fps:30});
 const types=new Set(report.issues.map(i=>i.type));
 for(const type of ['static_motion_ratio','cut_only_energy','dead_space','ui_occupancy','readability_projection','single_plane_motion','inactive_shot','end_card_hold'])assert.ok(types.has(type as any),`expected ${type}`);
 assert.ok(report.metrics.staticFrameRatio>.5);
 assert.ok(report.blocking);
});

test('intentional static hero hold can be annotated without hiding inactive motion elsewhere',()=>{
 const frames:Array<MotionFrameSample>=[];for(let f=0;f<60;f++)frames.push(frame(f,.45,f<30?0:f-29));
 const report=analyzeMotionFrames(frames,[{id:'hero',start:0,end:59}],[{kind:'intentional-hold',start:0,end:29},{kind:'activity',start:30,end:59,independentMotionGroups:3,activeLayerCount:5}],{fps:30});
 assert.ok(!report.issues.some(i=>i.type==='static_motion_ratio'));
 assert.ok(!report.issues.some(i=>i.type==='single_plane_motion'));
});

test('premium layered motion fixture passes blocking thresholds',()=>{
 const frames:Array<MotionFrameSample>=[];for(let f=0;f<90;f++)frames.push(frame(f,.46,f*3));
 const shots=[{id:'premium',start:0,end:89}];
 const annotations:MotionAnnotation[]=[{kind:'ui',start:0,end:89,occupancy:.46,safeMarginPx:120},{kind:'text',start:0,end:89,projectedPixelHeight:32,safeMarginPx:96},{kind:'activity',start:0,end:89,independentMotionGroups:3,activeLayerCount:6},{kind:'end-card',start:30,end:89,resolvedAt:45}];
 const report=analyzeMotionFrames(frames,shots,annotations,{fps:30});
 assert.equal(report.blocking,false,JSON.stringify(report.issues));
 assert.ok(report.metrics.staticFrameRatio<.5);
});

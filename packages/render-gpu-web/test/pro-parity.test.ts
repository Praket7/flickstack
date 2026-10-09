import test from 'node:test';
import assert from 'node:assert/strict';
import { CpuLayerCompositor, buildFramePlan, webGpuShaderSource } from '../src/index.ts';
import { compileRenderGraph } from '../../render-graph/src/index.ts';
import type { FlickProjectV2, V2Clip } from '../../schema/src/v2/project.ts';

function clip(id:string,assetId:string):V2Clip{return{id,assetId,start:0,duration:30,sourceIn:0,transform:{x:1,y:1,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:['m'],effectStack:[{id:'sat',type:'saturation',enabled:true,params:{value:0}},{id:'xf',type:'transition:cross-dissolve',enabled:true,params:{durationFrames:10}}],enabled:true};}
function project():FlickProjectV2{return{version:2,id:'gpu',name:'GPU',format:{width:4,height:4,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:'/tmp/a.mp4',kind:'video'}],rootCompositionId:'root',compositions:[{id:'root',name:'Root',width:4,height:4,tracks:[{id:'v',kind:'video',name:'V',clips:[clip('c','a')]}]}],masks:[{id:'m',kind:'rect',x:0,y:0,width:2,height:2,feather:0,invert:false}],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}
function solid(w:number,h:number,r:number,g:number,b:number,a=255){const out=new Uint8Array(w*h*4);for(let i=0;i<out.length;i+=4){out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=a;}return out;}
function px(buf:Uint8Array,w:number,x:number,y:number){const i=(y*w+x)*4;return [...buf.subarray(i,i+4)];}

test('render graph carries masks, enabled effects, text/motion metadata for preview',()=>{
 const p=project();p.compositions[0].tracks[0].clips[0].text='HELLO';p.compositions[0].tracks[0].clips[0].component='kinetic-title';
 const g=compileRenderGraph(p);const n=g.nodes.find(x=>x.kind==='visual-source')!;
 assert.deepEqual(n.params.masks,p.masks);
 assert.equal((n.params.effects as any[]).length,2);
 assert.equal(n.params.text,'HELLO');
 assert.equal(n.params.component,'kinetic-title');
});

test('frame plan evaluates cross-dissolve opacity in clip-local frame time',()=>{
 const g=compileRenderGraph(project());
 assert.equal(buildFramePlan(g,0)[0].opacity,0);
 assert.ok(Math.abs(buildFramePlan(g,5)[0].opacity-.5)<1e-9);
 assert.equal(buildFramePlan(g,10)[0].opacity,1);
});

test('CPU preview applies rectangle mask, transform placement, and saturation effect',async()=>{
 const c=new CpuLayerCompositor();const base=solid(4,4,255,0,0),top=solid(4,4,0,0,255);
 const out=await c.composite(4,4,[
  {frame:{width:4,height:4,rgba:base},opacity:1,params:{transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},blendMode:'normal',masks:[],effects:[]}},
  {frame:{width:4,height:4,rgba:top},opacity:1,params:{transform:{x:1,y:1,scaleX:1,scaleY:1,rotation:0},blendMode:'normal',masks:[{id:'m',kind:'rect',x:0,y:0,width:2,height:2,feather:0,invert:false}],effects:[{id:'sat',type:'saturation',enabled:true,params:{value:0}}]}}
 ]);
 assert.deepEqual(px(out,4,0,0),[255,0,0,255]);
 const inside=px(out,4,1,1);assert.ok(Math.abs(inside[0]-inside[1])<=1&&Math.abs(inside[1]-inside[2])<=1,`expected grayscale, got ${inside}`);
 assert.deepEqual(px(out,4,3,3),[255,0,0,255]);
});

test('CPU preview implements non-normal multiply blending',async()=>{
 const c=new CpuLayerCompositor();
 const out=await c.composite(1,1,[
  {frame:{width:1,height:1,rgba:new Uint8Array([200,100,50,255])},opacity:1,params:{transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},blendMode:'normal',masks:[],effects:[]}},
  {frame:{width:1,height:1,rgba:new Uint8Array([100,200,50,255])},opacity:1,params:{transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},blendMode:'multiply',masks:[],effects:[]}}
 ]);
 const p=[...out];assert.ok(Math.abs(p[0]-78)<=2&&Math.abs(p[1]-78)<=2&&Math.abs(p[2]-10)<=2,`multiply output ${p}`);
});

test('production WGSL includes destination sampling, transform, mask, color and blend-mode branches',()=>{
 assert.match(webGpuShaderSource,/baseTex/);
 assert.match(webGpuShaderSource,/blendMode/);
 assert.match(webGpuShaderSource,/maskRect/);
 assert.match(webGpuShaderSource,/rotation/);
 assert.match(webGpuShaderSource,/saturation/);
 assert.match(webGpuShaderSource,/multiply/);
});

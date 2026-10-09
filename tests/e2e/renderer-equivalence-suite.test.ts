import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2, V2Clip } from '../../packages/schema/src/index.ts';
import { renderProjectV2 } from '../../packages/render-ffmpeg/src/index.ts';
import { compileRenderGraph } from '../../packages/render-graph/src/index.ts';
import { WebGpuPreviewRenderer, CpuLayerCompositor, type FrameDecoder } from '../../packages/render-gpu-web/src/index.ts';
import { compareFrames, assertDeclaredApproximation } from '../../packages/render-preview/src/index.ts';

function run(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
function color(path:string,c:string){run(['-f','lavfi','-i',`color=c=${c}:s=64x64:r=30:d=1`,'-c:v','libx264','-pix_fmt','yuv420p',path]);}
function frame(path:string,n:number):Uint8Array{const r=spawnSync('ffmpeg',['-v','error','-i',path,'-vf',`select=eq(n\\,${n}),format=rgba`,'-frames:v','1','-f','rawvideo','-'],{encoding:null,maxBuffer:64*64*4+4096});assert.equal(r.status,0,String(r.stderr));return new Uint8Array((r.stdout as Buffer).subarray(0,64*64*4));}
function clip(id:string,assetId:string,start:number,duration:number,opacity=1):V2Clip{return{id,assetId,start,duration,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true};}
function rgba(r:number,g:number,b:number):Uint8Array{const out=new Uint8Array(64*64*4);for(let i=0;i<out.length;i+=4){out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=255;}return out;}

test('preview normal-alpha compositing and clip timing match FFmpeg within declared tolerance',async()=>{
 const d=mkdtempSync(join(tmpdir(),'flick-equiv-'));try{const red=join(d,'r.mp4'),blue=join(d,'b.mp4'),out=join(d,'out.mp4');color(red,'red');color(blue,'blue');
 const p:FlickProjectV2={version:2,id:'eq',name:'Equivalence',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'r',path:red,kind:'video'},{id:'b',path:blue,kind:'video'}],rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks:[{id:'bg',kind:'video',name:'BG',clips:[clip('r','r',0,30)]},{id:'fg',kind:'video',name:'FG',zIndex:1,clips:[clip('b','b',15,15,.5)]}]}],masks:[],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 renderProjectV2(p,out);const graph=compileRenderGraph(p);
 const decoder:FrameDecoder={async decode(node){const id=String(node.params.assetId);return{width:64,height:64,rgba:id==='b'?rgba(0,0,255):rgba(255,0,0)};}};
 const preview=new WebGpuPreviewRenderer(decoder,new CpuLayerCompositor());await preview.load(graph);
 const before=await preview.seek(14),after=await preview.seek(15);const refBefore=frame(out,14),refAfter=frame(out,15);
 const a=compareFrames(before.rgba,refBefore,64,64),b=compareFrames(after.rgba,refAfter,64,64);
 const tolerance={pixelRmse:.035,alphaRmse:.01,timingFrames:0};assertDeclaredApproximation('normal-alpha','approximate',tolerance);
 assert.ok(a.pixelRmse<=tolerance.pixelRmse,`frame14 rmse ${a.pixelRmse}`);assert.ok(b.pixelRmse<=tolerance.pixelRmse,`frame15 rmse ${b.pixelRmse}`);
 assert.ok(before.rgba[0]>200&&before.rgba[2]<20,'frame 14 must not show incoming blue layer');assert.ok(after.rgba[0]>100&&after.rgba[2]>100,'frame 15 must include incoming blue layer');
 assert.throws(()=>assertDeclaredApproximation('undeclared-effect','approximate'),/tolerance/i);assert.throws(()=>assertDeclaredApproximation('non-normal-blend','unsupported'),/unsupported/i);
 await preview.dispose();
 }finally{rmSync(d,{recursive:true,force:true});}
});

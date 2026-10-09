import type { RenderGraph, RenderNode, FrameRange } from '../../render-graph/src/index.ts';
import type { PreviewCapabilities, PreviewFrame, PreviewRenderer } from '../../render-preview/src/index.ts';

export type DecodePriority='playhead'|'near-future'|'scrub'|'thumbnail';
export interface DecodeRequest{key:string;priority:DecodePriority;generation:number}
const rank:Record<DecodePriority,number>={playhead:0,'near-future':1,scrub:2,thumbnail:3};
export class DecodeScheduler {
 private q:DecodeRequest[]=[];
 enqueue(r:DecodeRequest){const i=this.q.findIndex(x=>x.key===r.key);if(i>=0)this.q.splice(i,1);this.q.push({...r});this.q.sort((a,b)=>rank[a.priority]-rank[b.priority]||b.generation-a.generation);}
 take(){return this.q.shift();}
 cancelBeforeGeneration(g:number){this.q=this.q.filter(x=>x.generation>=g);}
 get size(){return this.q.length;}
}
export class FrameCache {
 private readonly values=new Map<string,{data:Uint8Array;bytes:number}>();private used=0;private readonly maxBytes:number;
 constructor(maxBytes:number){if(maxBytes<=0)throw new Error('maxBytes must be positive');this.maxBytes=maxBytes;}
 get(key:string){const v=this.values.get(key);if(!v)return undefined;this.values.delete(key);this.values.set(key,v);return v.data;}
 set(key:string,data:Uint8Array){const old=this.values.get(key);if(old){this.used-=old.bytes;this.values.delete(key);}const copy=data.slice();this.values.set(key,{data:copy,bytes:copy.byteLength});this.used+=copy.byteLength;while(this.used>this.maxBytes&&this.values.size){const first=this.values.keys().next().value as string;const v=this.values.get(first)!;this.values.delete(first);this.used-=v.bytes;}}
 clear(){this.values.clear();this.used=0;}
 get bytes(){return this.used;}
}

export interface FrameLayer {nodeId:string;opacity:number;params:Record<string,unknown>}
type EffectLike={id?:string;type?:string;enabled?:boolean;params?:Record<string,unknown>};
function effectsOf(params:Record<string,unknown>):EffectLike[]{return Array.isArray(params.effects)?params.effects.filter((x):x is EffectLike=>Boolean(x)&&typeof x==='object'):[];}
function numberParam(value:unknown,fallback:number):number{return typeof value==='number'&&Number.isFinite(value)?value:fallback;}
export function buildFramePlan(graph:RenderGraph,frame:number):FrameLayer[]{
 return graph.nodes
  .filter(n=>(n.kind==='visual-source'||n.kind==='composition-source')&&frame>=n.range.start&&frame<n.range.end)
  .map(n=>{
   let opacity=numberParam(n.params.opacity,1);
   const local=frame-n.range.start;
   for(const effect of effectsOf(n.params))if(effect.enabled!==false&&effect.type==='transition:cross-dissolve'){
    const duration=Math.max(0,numberParam(effect.params?.durationFrames,Math.min(10,n.range.end-n.range.start)));
    opacity*=duration<=0?1:Math.max(0,Math.min(1,local/duration));
   }
   return{nodeId:n.id,opacity,params:n.params};
  });
}

export function blendRgba(base:Uint8Array,top:Uint8Array,opacity=1):Uint8Array{
 if(base.length!==top.length||base.length%4)throw new Error('RGBA buffers differ');
 const out=new Uint8Array(base.length);
 for(let i=0;i<base.length;i+=4){const ta=(top[i+3]/255)*opacity,ba=base[i+3]/255,oa=ta+ba*(1-ta);for(let c=0;c<3;c++)out[i+c]=oa?Math.round((top[i+c]*ta+base[i+c]*ba*(1-ta))/oa):0;out[i+3]=Math.round(oa*255);}
 return out;
}

interface TransformLike{x:number;y:number;scaleX:number;scaleY:number;rotation:number}
interface MaskLike{kind:string;x?:number;y?:number;width?:number;height?:number;invert?:boolean;points?:Array<{x:number;y:number}>}
function transformOf(params:Record<string,unknown>):TransformLike{const t=(params.transform??{}) as Partial<TransformLike>;return{x:numberParam(t.x,0),y:numberParam(t.y,0),scaleX:numberParam(t.scaleX,1)||1,scaleY:numberParam(t.scaleY,1)||1,rotation:numberParam(t.rotation,0)};}
function masksOf(params:Record<string,unknown>):MaskLike[]{return Array.isArray(params.masks)?params.masks.filter((x):x is MaskLike=>Boolean(x)&&typeof x==='object'):[];}
function pointInPolygon(x:number,y:number,points:Array<{x:number;y:number}>):boolean{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];const crosses=((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y||1e-12)+a.x);if(crosses)inside=!inside;}return inside;}
function maskAllows(mask:MaskLike,x:number,y:number):boolean{
 let inside=true;
 if(mask.kind==='rect')inside=x>=numberParam(mask.x,0)&&y>=numberParam(mask.y,0)&&x<numberParam(mask.x,0)+numberParam(mask.width,0)&&y<numberParam(mask.y,0)+numberParam(mask.height,0);
 else if(mask.kind==='ellipse'){const w=numberParam(mask.width,0),h=numberParam(mask.height,0),cx=numberParam(mask.x,0)+w/2,cy=numberParam(mask.y,0)+h/2;inside=w>0&&h>0&&((x-cx)/(w/2))**2+((y-cy)/(h/2))**2<=1;}
 else if(mask.kind==='polygon')inside=Array.isArray(mask.points)&&mask.points.length>=3&&pointInPolygon(x,y,mask.points);
 return mask.invert?!inside:inside;
}
function clamp255(v:number){return Math.max(0,Math.min(255,Math.round(v)));}
function applyColorEffects(r:number,g:number,b:number,effects:EffectLike[]):[number,number,number]{
 let rr=r/255,gg=g/255,bb=b/255;
 for(const fx of effects){if(fx.enabled===false)continue;const p=fx.params??{};switch(fx.type){
  case 'saturation':{const s=numberParam(p.value,1),lum=.2126*rr+.7152*gg+.0722*bb;rr=lum+(rr-lum)*s;gg=lum+(gg-lum)*s;bb=lum+(bb-lum)*s;break;}
  case 'exposure':{const d=numberParam(p.value,0)/10;rr+=d;gg+=d;bb+=d;break;}
  case 'contrast':{const c=numberParam(p.value,1);rr=(rr-.5)*c+.5;gg=(gg-.5)*c+.5;bb=(bb-.5)*c+.5;break;}
  case 'gamma':{const gam=Math.max(.01,numberParam(p.value,1));rr=Math.pow(Math.max(0,rr),1/gam);gg=Math.pow(Math.max(0,gg),1/gam);bb=Math.pow(Math.max(0,bb),1/gam);break;}
  case 'temperature':{const v=numberParam(p.value,0);rr*=Math.max(.1,1+v/200);bb*=Math.max(.1,1-v/200);break;}
  case 'transition:cross-dissolve': break;
  case 'blur': case 'sharpen': throw new Error(`CPU preview effect ${fx.type} is not supported; use an explicit fallback`);
  default: if(fx.type&&['exposure','contrast','saturation','gamma','temperature'].includes(fx.type)===false) throw new Error(`CPU preview effect ${fx.type} is not supported`);
 }}
 return[clamp255(rr*255),clamp255(gg*255),clamp255(bb*255)];
}
function blendChannel(mode:string,b:number,s:number):number{switch(mode){case'multiply':return b*s;case'screen':return b+s-b*s;case'overlay':return b<.5?2*b*s:1-2*(1-b)*(1-s);case'darken':return Math.min(b,s);case'lighten':return Math.max(b,s);case'add':return Math.min(1,b+s);case'difference':return Math.abs(b-s);case'exclusion':return b+s-2*b*s;case'hard-light':return s<.5?2*b*s:1-2*(1-b)*(1-s);case'soft-light':return (1-2*s)*b*b+2*s*b;default:return s;}}
function compositePixel(dst:Uint8Array,di:number,src:[number,number,number,number],opacity:number,mode:string):void{
 const sa=(src[3]/255)*Math.max(0,Math.min(1,opacity)),da=dst[di+3]/255,oa=sa+da*(1-sa);if(oa<=0){dst.fill(0,di,di+4);return;}
 for(let c=0;c<3;c++){const cb=dst[di+c]/255,cs=src[c]/255,b=blendChannel(mode,cb,cs);const co=sa*(1-da)*cs+sa*da*b+(1-sa)*da*cb;dst[di+c]=clamp255(co/oa*255);}dst[di+3]=clamp255(oa*255);
}
function sourceCoordinate(dx:number,dy:number,w:number,h:number,t:TransformLike):{x:number;y:number}|undefined{
 const sx=t.scaleX,sy=t.scaleY;if(Math.abs(sx)<1e-9||Math.abs(sy)<1e-9)return undefined;
 const scaledW=w*Math.abs(sx),scaledH=h*Math.abs(sy),cx=scaledW/2,cy=scaledH/2;
 let x=dx-t.x,y=dy-t.y;const rad=-t.rotation*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);const rx=(x-cx)*cos-(y-cy)*sin+cx,ry=(x-cx)*sin+(y-cy)*cos+cy;
 const ox=sx<0?scaledW-rx:rx,oy=sy<0?scaledH-ry:ry;const px=ox/Math.abs(sx),py=oy/Math.abs(sy);if(px<0||py<0||px>=w||py>=h)return undefined;return{x:px,y:py};
}

export interface DecodedFrame {width:number;height:number;rgba:Uint8Array}
export interface FrameDecoder {decode(node:RenderNode,frame:number):Promise<DecodedFrame>}
export interface LayerCompositor {composite(width:number,height:number,layers:Array<{frame:DecodedFrame;opacity:number;params:Record<string,unknown>}>):Promise<Uint8Array>}
export class CpuLayerCompositor implements LayerCompositor {
 async composite(width:number,height:number,layers:Array<{frame:DecodedFrame;opacity:number;params:Record<string,unknown>}>){
  const out=new Uint8Array(width*height*4);
  for(const layer of layers){const t=transformOf(layer.params),masks=masksOf(layer.params),effects=effectsOf(layer.params),mode=typeof layer.params.blendMode==='string'?layer.params.blendMode:'normal';for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sp=sourceCoordinate(x,y,layer.frame.width,layer.frame.height,t);if(!sp)continue;if(masks.some(mask=>!maskAllows(mask,sp.x,sp.y)))continue;const sx=Math.min(layer.frame.width-1,Math.max(0,Math.floor(sp.x))),sy=Math.min(layer.frame.height-1,Math.max(0,Math.floor(sp.y))),si=(sy*layer.frame.width+sx)*4;if(layer.frame.rgba[si+3]===0)continue;const [r,g,b]=applyColorEffects(layer.frame.rgba[si],layer.frame.rgba[si+1],layer.frame.rgba[si+2],effects);compositePixel(out,(y*width+x)*4,[r,g,b,layer.frame.rgba[si+3]],layer.opacity,mode);}}
  return out;
 }
}

export const webGpuShaderSource=`
struct Uniforms {
  data0:vec4<f32>, // opacity, blendMode, saturation, maskEnabled
  transform:vec4<f32>, // x,y,scaleX,scaleY
  maskRect:vec4<f32>, // x,y,width,height
  data1:vec4<f32>, // rotation,width,height,pad
  color:vec4<f32>, // exposure,contrast,gamma,temperature
};
@group(0) @binding(0) var baseTex:texture_2d<f32>;
@group(0) @binding(1) var layerTex:texture_2d<f32>;
@group(0) @binding(2) var samp:sampler;
@group(0) @binding(3) var<uniform> u:Uniforms;
struct O { @builtin(position) p:vec4<f32>, @location(0) uv:vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i:u32)->O { var pos=array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1)); var uv=array<vec2<f32>,6>(vec2(0,1),vec2(1,1),vec2(0,0),vec2(0,0),vec2(1,1),vec2(1,0)); var o:O;o.p=vec4(pos[i],0,1);o.uv=uv[i];return o; }
fn multiply(b:f32,s:f32)->f32{return b*s;}
fn blend(mode:u32,b:f32,s:f32)->f32{switch mode{case 1u:{return multiply(b,s);}case 2u:{return b+s-b*s;}case 3u:{return select(2.0*b*s,1.0-2.0*(1.0-b)*(1.0-s),b>=0.5);}case 4u:{return min(b,s);}case 5u:{return max(b,s);}case 6u:{return min(1.0,b+s);}case 7u:{return abs(b-s);}case 8u:{return b+s-2.0*b*s;}case 9u:{return (1.0-2.0*s)*b*b+2.0*s*b;}case 10u:{return select(2.0*b*s,1.0-2.0*(1.0-b)*(1.0-s),s>=0.5);}default:{return s;}}}
fn applyColor(c:vec3<f32>)->vec3<f32>{let saturation=u.data0.z;let lum=dot(c,vec3(0.2126,0.7152,0.0722));var v=vec3(lum)+(c-vec3(lum))*saturation;v=(v-vec3(0.5))*u.color.y+vec3(0.5+u.color.x/10.0);v=pow(max(v,vec3(0.0)),vec3(1.0/max(0.01,u.color.z)));v.r*=max(0.1,1.0+u.color.w/200.0);v.b*=max(0.1,1.0-u.color.w/200.0);return clamp(v,vec3(0.0),vec3(1.0));}
@fragment fn fs(i:O)->@location(0) vec4<f32>{
 let base=textureSample(baseTex,samp,i.uv);let outputSize=vec2(u.data1.y,u.data1.z);let dest=i.uv*outputSize;let scale=u.transform.zw;let scaled=outputSize*abs(scale);let center=scaled*0.5;let r=-u.data1.x;let co=cos(r);let si=sin(r);let q=dest-u.transform.xy-center;let rotated=vec2(q.x*co-q.y*si,q.x*si+q.y*co)+center;let sourcePx=rotated/abs(scale);let sourceUv=sourcePx/outputSize;
 if(any(sourceUv<vec2(0.0))||any(sourceUv>=vec2(1.0))){return base;}
 let maskRect=u.maskRect;let maskEnabled=u.data0.w>0.5;if(maskEnabled&&(sourcePx.x<maskRect.x||sourcePx.y<maskRect.y||sourcePx.x>=maskRect.x+maskRect.z||sourcePx.y>=maskRect.y+maskRect.w)){return base;}
 var layer=textureSample(layerTex,samp,sourceUv);layer=vec4(applyColor(layer.rgb),layer.a*u.data0.x);let mode=u32(u.data0.y+0.5);let oa=layer.a+base.a*(1.0-layer.a);if(oa<=0.0){return vec4(0.0);}let blended=vec3(blend(mode,base.r,layer.r),blend(mode,base.g,layer.g),blend(mode,base.b,layer.b));let rgb=(layer.a*(1.0-base.a)*layer.rgb+layer.a*base.a*blended+(1.0-layer.a)*base.a*base.rgb)/oa;return vec4(rgb,oa);
}
`;

function blendModeCode(mode:unknown):number{return{normal:0,multiply:1,screen:2,overlay:3,darken:4,lighten:5,add:6,difference:7,exclusion:8,'soft-light':9,'hard-light':10}[typeof mode==='string'?mode:'normal']??0;}
function colorUniforms(params:Record<string,unknown>):[number,number,number,number]{let saturation=1,exposure=0,contrast=1,gamma=1,temperature=0;for(const fx of effectsOf(params)){if(fx.enabled===false)continue;const v=fx.params?.value;switch(fx.type){case'saturation':saturation=numberParam(v,1);break;case'exposure':exposure=numberParam(v,0);break;case'contrast':contrast=numberParam(v,1);break;case'gamma':gamma=numberParam(v,1);break;case'temperature':temperature=numberParam(v,0);break;case'transition:cross-dissolve':break;case'blur':case'sharpen':throw new Error(`WebGPU preview effect ${fx.type} is not supported; use explicit fallback`);default:if(fx.type)throw new Error(`WebGPU preview effect ${fx.type} is not supported`);}}return[saturation,exposure,contrast,gamma,temperature] as unknown as [number,number,number,number];}
function gpuLayerUniforms(width:number,height:number,layer:{opacity:number;params:Record<string,unknown>}):Float32Array{const t=transformOf(layer.params),masks=masksOf(layer.params);if(masks.length>1)throw new Error('WebGPU preview currently supports one mask per layer');const mask=masks[0];if(mask&&mask.kind!=='rect')throw new Error(`WebGPU preview mask ${mask.kind} requires fallback`);const sat=effectsOf(layer.params).find(x=>x.type==='saturation');let saturation=sat?numberParam(sat.params?.value,1):1,exposure=0,contrast=1,gamma=1,temperature=0;for(const fx of effectsOf(layer.params)){const v=fx.params?.value;if(fx.type==='exposure')exposure=numberParam(v,0);else if(fx.type==='contrast')contrast=numberParam(v,1);else if(fx.type==='gamma')gamma=numberParam(v,1);else if(fx.type==='temperature')temperature=numberParam(v,0);else if(['saturation','transition:cross-dissolve'].includes(String(fx.type))){}else if(fx.type)throw new Error(`WebGPU preview effect ${fx.type} is not supported; use explicit fallback`);}return new Float32Array([layer.opacity,blendModeCode(layer.params.blendMode),saturation,mask?1:0,t.x,t.y,t.scaleX,t.scaleY,numberParam(mask?.x,0),numberParam(mask?.y,0),numberParam(mask?.width,0),numberParam(mask?.height,0),t.rotation*Math.PI/180,width,height,0,exposure,contrast,gamma,temperature]);}

export class WebGpuPreviewRenderer implements PreviewRenderer {
 private graph?:RenderGraph;private readonly decoder:FrameDecoder;private readonly compositor:LayerCompositor;
 constructor(decoder:FrameDecoder,compositor:LayerCompositor=new CpuLayerCompositor()){this.decoder=decoder;this.compositor=compositor;}
 async capabilities():Promise<PreviewCapabilities>{const nav=(globalThis as {navigator?:{gpu?:unknown}}).navigator;return{backend:'webgpu',available:Boolean(nav?.gpu),webGpu:Boolean(nav?.gpu),webCodecs:typeof (globalThis as {VideoDecoder?:unknown}).VideoDecoder!=='undefined'};}
 async load(g:RenderGraph){this.graph=g;}
 async seek(frame:number):Promise<PreviewFrame>{if(!this.graph)throw new Error('preview graph not loaded');const output=this.graph.nodes.find(n=>n.id===this.graph!.outputNodeId);const width=Number(output?.params.width??0),height=Number(output?.params.height??0);if(!width||!height)throw new Error('preview dimensions unavailable');const layers=[] as Array<{frame:DecodedFrame;opacity:number;params:Record<string,unknown>}>;for(const p of buildFramePlan(this.graph,frame)){const n=this.graph.nodes.find(x=>x.id===p.nodeId)!;layers.push({frame:await this.decoder.decode(n,frame),opacity:p.opacity,params:p.params});}return{frame,width,height,rgba:await this.compositor.composite(width,height,layers)};}
 async invalidate(_range:FrameRange){}
 async dispose(){this.graph=undefined;}
}

/** Browser WebGPU compositor. Decoded frames are normalized to project output dimensions by the decoder/provider. */
export class BrowserWebGpuCompositor implements LayerCompositor {
 private readonly device:any;private readonly format:string;private readonly module:any;private readonly sampler:any;
 private constructor(device:any,format='rgba8unorm'){this.device=device;this.format=format;this.module=device.createShaderModule({code:webGpuShaderSource});this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});}
 static async create():Promise<BrowserWebGpuCompositor>{const gpu=(globalThis as any).navigator?.gpu;if(!gpu)throw new Error('WebGPU unavailable');const adapter=await gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter');const device=await adapter.requestDevice();return new BrowserWebGpuCompositor(device);}
 async composite(width:number,height:number,layers:Array<{frame:DecodedFrame;opacity:number;params:Record<string,unknown>}>):Promise<Uint8Array>{
  const TU=(globalThis as any).GPUTextureUsage,BU=(globalThis as any).GPUBufferUsage,MM=(globalThis as any).GPUMapMode;if(!TU||!BU||!MM)throw new Error('WebGPU constants unavailable');
  const makeTarget=()=>this.device.createTexture({size:[width,height,1],format:this.format,usage:TU.RENDER_ATTACHMENT|TU.COPY_SRC|TU.TEXTURE_BINDING});let current=makeTarget();{const enc=this.device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view:current.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});pass.end();this.device.queue.submit([enc.finish()]);}
  const pipeline=this.device.createRenderPipeline({layout:'auto',vertex:{module:this.module,entryPoint:'vs'},fragment:{module:this.module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  for(const layer of layers){if(layer.frame.width!==width||layer.frame.height!==height)throw new Error('WebGPU compositor expects normalized frames');const source=this.device.createTexture({size:[width,height,1],format:'rgba8unorm',usage:TU.TEXTURE_BINDING|TU.COPY_DST});this.device.queue.writeTexture({texture:source},layer.frame.rgba,{bytesPerRow:width*4,rowsPerImage:height},{width,height,depthOrArrayLayers:1});const ub=this.device.createBuffer({size:80,usage:BU.UNIFORM|BU.COPY_DST});this.device.queue.writeBuffer(ub,0,gpuLayerUniforms(width,height,layer));const target=makeTarget();const bind=this.device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:current.createView()},{binding:1,resource:source.createView()},{binding:2,resource:this.sampler},{binding:3,resource:{buffer:ub}}]});const enc=this.device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(6);pass.end();this.device.queue.submit([enc.finish()]);current=target;}
  const rowBytes=width*4,aligned=Math.ceil(rowBytes/256)*256,buffer=this.device.createBuffer({size:aligned*height,usage:BU.COPY_DST|BU.MAP_READ});const enc=this.device.createCommandEncoder();enc.copyTextureToBuffer({texture:current},{buffer,bytesPerRow:aligned,rowsPerImage:height},{width,height,depthOrArrayLayers:1});this.device.queue.submit([enc.finish()]);await buffer.mapAsync(MM.READ);const mapped=new Uint8Array(buffer.getMappedRange()),result=new Uint8Array(rowBytes*height);for(let y=0;y<height;y++)result.set(mapped.subarray(y*aligned,y*aligned+rowBytes),y*rowBytes);buffer.unmap();return result;
 }
}

export interface VideoFrameProvider { frameFor(node:RenderNode,frame:number):Promise<any> }
/** Adapter for browser WebCodecs VideoFrame providers; demuxing and text/motion rasterization stay pluggable. */
export class WebCodecsFrameDecoder implements FrameDecoder {
 private readonly provider:VideoFrameProvider;constructor(provider:VideoFrameProvider){this.provider=provider;}
 async decode(node:RenderNode,frame:number):Promise<DecodedFrame>{const vf=await this.provider.frameFor(node,frame);if(!vf||typeof vf.copyTo!=='function')throw new Error('Provider did not return a VideoFrame-like object');const width=vf.displayWidth??vf.codedWidth,height=vf.displayHeight??vf.codedHeight;const rgba=new Uint8Array(width*height*4);await vf.copyTo(rgba,{format:'RGBA'});if(typeof vf.close==='function')vf.close();return{width,height,rgba};}
}

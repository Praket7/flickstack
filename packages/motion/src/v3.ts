import type {
  AnimatedProperty,
  MotionComposition,
  MotionLayer,
  MotionMaskDefinition,
  MotionRigDefinition,
  Rect,
  TextSelector,
  Vec3,
} from '../../schema/src/v3/project.ts';
import { evaluateAnimatedNumber, evaluateAnimatedVec3 } from '../../animation/src/index.ts';
import { evaluateBehaviorNumber, evaluateBehaviorVec3, type BehaviorContext } from '../../behaviors/src/index.ts';
import { evaluateExpression } from '../../expressions/src/index.ts';
import { classifyAspect, solveLayout, safeAreaForSurface, type LayoutItem } from '../../layout/src/index.ts';
import { ReferenceTextShaper, combineSelectorWeights, selectorWeights, type TextLayout } from '../../typography/src/index.ts';
import { geometryBounds } from '../../vector/src/index.ts';
import { resolveRigControls } from '../../motion-components/src/rigs.ts';

export interface MotionEvaluationOptions {
  fps?:number;
  audio?:Partial<Record<'energy'|'low'|'mid'|'high'|'beat'|'downbeat',number>>;
  vars?:Record<string,number>;
  seed?:number;
  surface?:{width:number;height:number};
  rig?:MotionRigDefinition;
  rigValues?:Record<string,unknown>;
}
export interface EvaluatedTextCluster {
  index:number;
  text:string;
  x:number;
  y:number;
  position:Vec3;
  scale:Vec3;
  rotation:Vec3;
  opacity:number;
  blur:number;
  tracking:number;
  fill?:string;
  strokeWidth:number;
}
export interface EvaluatedMotionLayer {
  id:string;
  kind:MotionLayer['kind'];
  localPosition:Vec3;
  worldPosition:Vec3;
  localScale:Vec3;
  localRotation:Vec3;
  opacity:number;
  matrix:number[];
  bounds:Rect;
  textLayout?:TextLayout;
  selectorWeights?:Record<string,number[]>;
  textClusters?:EvaluatedTextCluster[];
  masks:MotionMaskDefinition[];
  matteSourceId?:string;
  source:MotionLayer;
}
export interface EvaluatedMotionScene { compositionId:string; frame:number; width:number; height:number; background:string; layers:EvaluatedMotionLayer[] }

type Matrix=number[];
const I=():Matrix=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a:Matrix,b:Matrix):Matrix {const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)o[r*4+c]+=a[r*4+k]*b[k*4+c];return o;}
function translate(x:number,y:number,z:number):Matrix {const m=I();m[3]=x;m[7]=y;m[11]=z;return m;}
function scale(x:number,y:number,z:number):Matrix {const m=I();m[0]=x;m[5]=y;m[10]=z;return m;}
function rotateX(d:number):Matrix {const r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[1,0,0,0,0,c,-s,0,0,s,c,0,0,0,0,1];}
function rotateY(d:number):Matrix {const r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[c,0,s,0,0,1,0,0,-s,0,c,0,0,0,0,1];}
function rotateZ(d:number):Matrix {const r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[c,-s,0,0,s,c,0,0,0,0,1,0,0,0,0,1];}
function apply(m:Matrix,p:Vec3):Vec3 {return[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];}
function matrixFor(position:Vec3,anchor:Vec3,s:Vec3,r:Vec3):Matrix {return mul(translate(...position),mul(rotateZ(r[2]),mul(rotateY(r[1]),mul(rotateX(r[0]),mul(scale(...s),translate(-anchor[0],-anchor[1],-anchor[2]))))));}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const addVec=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];

function behaviorContext(layer:MotionLayer,frame:number,index:number,count:number,opts:MotionEvaluationOptions,resolveVector:(id:string)=>Vec3|undefined):BehaviorContext {
  return{frame,start:layer.start,duration:layer.duration,index,count,seed:opts.seed??0,audio:opts.audio,resolveVector};
}
function evalNumber(prop:AnimatedProperty<number>,layer:MotionLayer,frame:number,index:number,count:number,opts:MotionEvaluationOptions,resolveVector:(id:string)=>Vec3|undefined,min=-Infinity,max=Infinity,rigOverride?:unknown):number {
  let value=evaluateAnimatedNumber(prop,frame);
  const ctx=behaviorContext(layer,frame,index,count,opts,resolveVector);
  for(const b of prop.behaviors??[])value=evaluateBehaviorNumber(value,b,ctx);
  if(prop.expression){const expression=evaluateExpression(prop.expression.source,{frame,time:frame/(opts.fps??30),width:Number(opts.vars?.width??0),height:Number(opts.vars?.height??0),index,seed:opts.seed??0,vars:{...(opts.vars??{}),value}} ,{maxOperations:prop.expression.maxOperations});const mode=prop.expression.mode??'replace';value=mode==='add'?value+expression:mode==='multiply'?value*expression:expression;}
  if(rigOverride!==undefined){if(typeof rigOverride!=='number'||!Number.isFinite(rigOverride))throw new Error(`rig override for ${layer.id} must be a finite number`);value=rigOverride;}
  if(!Number.isFinite(value))throw new Error(`non-finite motion value on ${layer.id}`);
  return clamp(value,min,max);
}
function evalVec3(prop:AnimatedProperty<Vec3>,layer:MotionLayer,frame:number,index:number,count:number,opts:MotionEvaluationOptions,resolveVector:(id:string)=>Vec3|undefined,rigOverride?:unknown):Vec3 {
  let value=evaluateAnimatedVec3(prop,frame);const ctx=behaviorContext(layer,frame,index,count,opts,resolveVector);for(const b of prop.behaviors??[])value=evaluateBehaviorVec3(value,b,ctx);
  if(prop.expression){const initial:Vec3=[value[0],value[1],value[2]];const component=(componentIndex:0|1|2):number=>{const current=initial[componentIndex];const expression=evaluateExpression(prop.expression!.source,{frame,time:frame/(opts.fps??30),width:Number(opts.vars?.width??0),height:Number(opts.vars?.height??0),index,seed:opts.seed??0,vars:{...(opts.vars??{}),value:current,x:initial[0],y:initial[1],z:initial[2],component:componentIndex}}, {maxOperations:prop.expression!.maxOperations});const mode=prop.expression!.mode??'replace';return mode==='add'?current+expression:mode==='multiply'?current*expression:expression;};value=[component(0),component(1),component(2)];}
  if(rigOverride!==undefined){if(!Array.isArray(rigOverride)||rigOverride.length<2||!rigOverride.every(Number.isFinite))throw new Error(`rig override for ${layer.id} must be a finite point or vec3`);value=[Number(rigOverride[0]),Number(rigOverride[1]),rigOverride.length>=3?Number(rigOverride[2]):value[2]];}
  if(!value.every(Number.isFinite))throw new Error(`non-finite vector motion value on ${layer.id}`);return value;
}
function evalBool(value:boolean|AnimatedProperty<boolean>,frame:number,rigOverride?:unknown):boolean {
  let out:boolean;if(typeof value==='boolean')out=value;else {const frames=[...(value.keyframes??[])].sort((a,b)=>a.frame-b.frame);out=value.baseValue;for(const k of frames){if(k.frame>frame)break;out=k.value;}}
  if(rigOverride!==undefined){if(typeof rigOverride!=='boolean')throw new Error('rig boolean override must be boolean');out=rigOverride;}return out;
}
function evalString(prop:AnimatedProperty<string>,frame:number,rigOverride?:unknown):string {
  const frames=[...(prop.keyframes??[])].sort((a,b)=>a.frame-b.frame);let out=prop.baseValue;for(const k of frames){if(k.frame>frame)break;out=k.value;}
  if(rigOverride!==undefined){if(typeof rigOverride!=='string')throw new Error('rig string override must be string');out=rigOverride;}return out;
}
function rigOverrideMap(c:MotionComposition,opts:MotionEvaluationOptions):Map<string,unknown>{
  if(!opts.rig)return new Map();if(c.rigId&&opts.rig.id!==c.rigId)throw new Error(`motion composition ${c.id} expects rig ${c.rigId}, received ${opts.rig.id}`);
  return new Map(resolveRigControls(opts.rig,opts.rigValues??{}).map(binding=>[`${binding.layerId}:${binding.propertyPath}`,binding.value]));
}
function overrideFor(overrides:Map<string,unknown>,layer:MotionLayer,path:string):unknown{return overrides.get(`${layer.id}:${path}`);}
function intrinsic(layer:MotionLayer,frame:number,opts:MotionEvaluationOptions,index:number,count:number,resolveVector:(id:string)=>Vec3|undefined,overrides:Map<string,unknown>):{width:number;height:number;textLayout?:TextLayout} {
  if(layer.kind==='shape'&&layer.shape){const b=geometryBounds(layer.shape);return{width:b.width,height:b.height};}
  if(layer.kind==='text'){
    const style=layer.textStyle;const fontSize=style?evalNumber(style.fontSize,layer,frame,index,count,opts,resolveVector,0,Infinity,overrideFor(overrides,layer,'textStyle.fontSize')):48;const lineHeight=style?.lineHeight?evalNumber(style.lineHeight,layer,frame,index,count,opts,resolveVector,0,Infinity,overrideFor(overrides,layer,'textStyle.lineHeight')):fontSize*1.2;const tracking=style?.tracking?evalNumber(style.tracking,layer,frame,index,count,opts,resolveVector,-Infinity,Infinity,overrideFor(overrides,layer,'textStyle.tracking')):0;
    const maxWidth=style?.paragraphBox?.width;const textLayout=new ReferenceTextShaper().shape(layer.text??'',{fontSize,lineHeight,tracking,maxWidth,horizontalAlign:style?.horizontalAlign??'left'});return{width:style?.paragraphBox?.width??textLayout.width,height:style?.paragraphBox?.height??textLayout.height,textLayout};
  }
  const w=typeof layer.props?.width==='number'?layer.props.width:0,h=typeof layer.props?.height==='number'?layer.props.height:0;return{width:w,height:h};
}
function transformedBounds(local:Rect,m:Matrix):Rect {const p=[apply(m,[local.x,local.y,0]),apply(m,[local.x+local.width,local.y,0]),apply(m,[local.x,local.y+local.height,0]),apply(m,[local.x+local.width,local.y+local.height,0])];const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);const x=Math.min(...xs),y=Math.min(...ys);return{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};}

export function validateMotionComposition(c:MotionComposition):void {
  if(!c.id||!Number.isInteger(c.width)||c.width<=0||!Number.isInteger(c.height)||c.height<=0||!Number.isInteger(c.duration)||c.duration<=0)throw new Error('invalid motion composition');
  const ids=new Set<string>();for(const l of c.layers){if(ids.has(l.id))throw new Error(`duplicate layer ${l.id}`);ids.add(l.id);if(!Number.isInteger(l.start)||!Number.isInteger(l.duration)||l.start<0||l.duration<=0||l.start+l.duration>c.duration)throw new Error(`invalid lifetime for layer ${l.id}`);}
  const by=new Map(c.layers.map(l=>[l.id,l]));
  for(const l of c.layers){if(l.parentId&&!by.has(l.parentId))throw new Error(`missing parent ${l.parentId}`);if(l.matte&&!by.has(l.matte.sourceLayerId))throw new Error(`missing matte ${l.matte.sourceLayerId}`);}
  const visitParent=(l:MotionLayer,seen:Set<string>)=>{if(!l.parentId)return;if(seen.has(l.parentId)||l.parentId===l.id)throw new Error(`parent cycle involving ${l.id}`);seen.add(l.parentId);visitParent(by.get(l.parentId)!,seen);};for(const l of c.layers)visitParent(l,new Set());
  const visiting=new Set<string>(),done=new Set<string>();const visitMatte=(id:string)=>{if(done.has(id))return;if(visiting.has(id))throw new Error(`matte cycle involving ${id}`);visiting.add(id);const source=by.get(id)?.matte?.sourceLayerId;if(source)visitMatte(source);visiting.delete(id);done.add(id);};for(const l of c.layers)visitMatte(l.id);
  if(c.cameraId&&by.get(c.cameraId)?.kind!=='camera')throw new Error(`camera ${c.cameraId} is missing or invalid`);
}

function evaluateTextClusters(layer:MotionLayer,layout:TextLayout,weights:Record<string,number[]>,frame:number,index:number,count:number,opts:MotionEvaluationOptions,resolveVector:(id:string)=>Vec3|undefined,overrides:Map<string,unknown>):EvaluatedTextCluster[]{
  const baseFill=layer.textStyle?.fill?evalString(layer.textStyle.fill,frame,overrideFor(overrides,layer,'textStyle.fill')):undefined;
  const baseStrokeWidth=layer.textStyle?.strokeWidth?evalNumber(layer.textStyle.strokeWidth,layer,frame,index,count,opts,resolveVector,0,Infinity,overrideFor(overrides,layer,'textStyle.strokeWidth')):0;
  const clusters=layout.clusters.map(c=>({index:c.index,text:c.text,x:c.x,y:c.y,position:[0,0,0] as Vec3,scale:[1,1,1] as Vec3,rotation:[0,0,0] as Vec3,opacity:1,blur:0,tracking:0,fill:baseFill,strokeWidth:baseStrokeWidth}));
  for(const animator of layer.textAnimators??[]){
    const selected=animator.selectorIds.length?combineSelectorWeights(animator.selectorIds.map(id=>weights[id]??new Array(clusters.length).fill(0))):new Array(clusters.length).fill(1);
    const position=animator.position?evalVec3(animator.position,layer,frame,index,count,opts,resolveVector):undefined;
    const scaleValue=animator.scale?evalVec3(animator.scale,layer,frame,index,count,opts,resolveVector):undefined;
    const rotation=animator.rotation?evalVec3(animator.rotation,layer,frame,index,count,opts,resolveVector):undefined;
    const opacity=animator.opacity?evalNumber(animator.opacity,layer,frame,index,count,opts,resolveVector,0,1):undefined;
    const blur=animator.blur?evalNumber(animator.blur,layer,frame,index,count,opts,resolveVector,0,Infinity):undefined;
    const tracking=animator.tracking?evalNumber(animator.tracking,layer,frame,index,count,opts,resolveVector):undefined;
    const fill=animator.fill?evalString(animator.fill,frame):undefined;
    const strokeWidth=animator.strokeWidth?evalNumber(animator.strokeWidth,layer,frame,index,count,opts,resolveVector,0,Infinity):undefined;
    clusters.forEach((cluster,i)=>{const w=selected[i]??0;if(position)cluster.position=[cluster.position[0]+position[0]*w,cluster.position[1]+position[1]*w,cluster.position[2]+position[2]*w];if(scaleValue)cluster.scale=[cluster.scale[0]*(1+(scaleValue[0]-1)*w),cluster.scale[1]*(1+(scaleValue[1]-1)*w),cluster.scale[2]*(1+(scaleValue[2]-1)*w)];if(rotation)cluster.rotation=[cluster.rotation[0]+rotation[0]*w,cluster.rotation[1]+rotation[1]*w,cluster.rotation[2]+rotation[2]*w];if(opacity!==undefined)cluster.opacity*=1+(opacity-1)*w;if(blur!==undefined)cluster.blur+=blur*w;if(tracking!==undefined)cluster.tracking+=tracking*w;if(fill!==undefined&&w>=.5)cluster.fill=fill;if(strokeWidth!==undefined)cluster.strokeWidth+=(strokeWidth-cluster.strokeWidth)*w;});
  }
  return clusters;
}

export function evaluateMotionComposition(c:MotionComposition,frame:number,opts:MotionEvaluationOptions={}):EvaluatedMotionScene {
  validateMotionComposition(c);if(!Number.isInteger(frame)||frame<0||frame>=c.duration)throw new Error('frame outside motion composition');
  const surface=opts.surface??{width:c.width,height:c.height};if(!(Number.isFinite(surface.width)&&surface.width>0&&Number.isFinite(surface.height)&&surface.height>0))throw new Error('motion evaluation surface must be positive');
  const audioVars=Object.fromEntries(Object.entries(opts.audio??{}).filter(([,value])=>typeof value==='number'&&Number.isFinite(value)).map(([key,value])=>[`audio.${key}`,value as number]));
  const surfaceOpts:MotionEvaluationOptions={...opts,vars:{...audioVars,...(opts.vars??{}),width:surface.width,height:surface.height}};
  const overrides=rigOverrideMap(c,opts),by=new Map(c.layers.map(l=>[l.id,l]));
  const enabled=(l:MotionLayer)=>evalBool(l.enabled,frame,overrideFor(overrides,l,'enabled'));
  const active=c.layers.filter(l=>frame>=l.start&&frame<l.start+l.duration&&enabled(l));
  const local=new Map<string,{position:Vec3;anchor:Vec3;scale:Vec3;rotation:Vec3;opacity:number;matrix:Matrix}>();
  const resolveLocalVector=(id:string)=>local.get(id)?.position;
  const intrinsicBy=new Map(c.layers.map((l,index)=>[l.id,intrinsic(l,frame,surfaceOpts,index,c.layers.length,resolveLocalVector,overrides)]));
  const variant=c.layoutVariants?.find(v=>v.aspect===classifyAspect(surface.width,surface.height));
  const constraintsByLayer=new Map(active.map(l=>[l.id,variant?.constraintsByLayer[l.id]??l.layout??[]]));
  const hasLayout=[...constraintsByLayer.values()].some(x=>x.length>0),activeIds=new Set(active.map(l=>l.id));
  const layoutItems:LayoutItem[]=hasLayout?active.map(l=>({id:l.id,intrinsic:{width:intrinsicBy.get(l.id)!.width,height:intrinsicBy.get(l.id)!.height},constraints:constraintsByLayer.get(l.id)!,parentId:l.parentId&&activeIds.has(l.parentId)?l.parentId:undefined})):[];
  const layout=layoutItems.length?solveLayout({width:surface.width,height:surface.height,safeArea:safeAreaForSurface(surface.width,surface.height,.05)},layoutItems):{bounds:{}} as {bounds:Record<string,Rect>};
  const world=new Map<string,Matrix>();
  c.layers.forEach((l,index)=>{
    const p=evalVec3(l.transform.position,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrideFor(overrides,l,'transform.position')),lb=layout.bounds[l.id],parentLayout=l.parentId?layout.bounds[l.parentId]:undefined;
    const layoutX=lb?(l.parentId&&parentLayout?lb.x-parentLayout.x:lb.x):0,layoutY=lb?(l.parentId&&parentLayout?lb.y-parentLayout.y:lb.y):0;
    const position:Vec3=[p[0]+layoutX,p[1]+layoutY,p[2]];
    const anchor=evalVec3(l.transform.anchor,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrideFor(overrides,l,'transform.anchor'));
    const s=evalVec3(l.transform.scale,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrideFor(overrides,l,'transform.scale'));
    const baseRotation=evalVec3(l.transform.rotation,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrideFor(overrides,l,'transform.rotation'));
    const orientation=l.transform.orientation?evalVec3(l.transform.orientation,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrideFor(overrides,l,'transform.orientation')):[0,0,0] as Vec3;
    const r=addVec(baseRotation,orientation);
    const opacity=evalNumber(l.opacity,l,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,0,1,overrideFor(overrides,l,'opacity'));
    local.set(l.id,{position,anchor,scale:s,rotation:r,opacity,matrix:matrixFor(position,anchor,s,r)});
  });
  const worldFor=(id:string):Matrix=>{const cached=world.get(id);if(cached)return cached;const l=by.get(id)!;const own=local.get(id)!.matrix;const m=l.parentId?mul(worldFor(l.parentId),own):own;world.set(id,m);return m;};
  const layers:EvaluatedMotionLayer[]=active.sort((a,b)=>a.zIndex-b.zIndex||a.id.localeCompare(b.id)).map(l=>{
    const index=c.layers.indexOf(l),loc=local.get(l.id)!,m=worldFor(l.id),info=intrinsicBy.get(l.id)!;const bounds=transformedBounds({x:0,y:0,width:info.width,height:info.height},m),weights:Record<string,number[]>={};
    if(info.textLayout)for(const selector of l.textSelectors??[])weights[selector.id]=selectorWeights(l.text??'',info.textLayout,selector as TextSelector);
    const textClusters=info.textLayout?evaluateTextClusters(l,info.textLayout,weights,frame,index,c.layers.length,surfaceOpts,resolveLocalVector,overrides):undefined;
    return{id:l.id,kind:l.kind,localPosition:loc.position,worldPosition:apply(m,[0,0,0]),localScale:loc.scale,localRotation:loc.rotation,opacity:loc.opacity,matrix:m,bounds,...(info.textLayout?{textLayout:info.textLayout}:{}),...(Object.keys(weights).length?{selectorWeights:weights}:{}),...(textClusters?{textClusters}:{}),masks:l.masks,matteSourceId:l.matte?.sourceLayerId,source:l};
  });
  return{compositionId:c.id,frame,width:surface.width,height:surface.height,background:c.background,layers};
}

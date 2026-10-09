import type { FlickProjectV2, V2Clip } from '../../schema/src/v2/project.ts';
import type { FlickProjectV3, MotionComposition, MotionLayer } from '../../schema/src/v3/project.ts';
import type { RenderGraph, RenderNode, RenderNodeKind } from './types.ts';

export type RenderableProject=FlickProjectV2|FlickProjectV3;
const isV3=(project:RenderableProject):project is FlickProjectV3=>project.version===3;

function nodeForClip(project:RenderableProject,trackId:string,clip:V2Clip,assetPath?:string):RenderNode {
 const range={start:clip.start,end:clip.start+clip.duration};
 const kind=clip.compositionId?'composition-source':'visual-source';
 const masks=(clip.maskRefs??[]).map(id=>(project.masks??[]).find(mask=>mask.id===id)).filter((mask):mask is NonNullable<typeof mask>=>Boolean(mask));
 return {id:`clip:${trackId}:${clip.id}`,kind,range,upstream:[],params:{trackId,clipId:clip.id,assetId:clip.assetId,assetPath,compositionId:clip.compositionId,sourceIn:clip.sourceIn,transform:clip.transform,opacity:clip.opacity,blendMode:clip.blendMode,enabled:clip.enabled,speed:clip.speed,speedCurve:clip.speedCurve,masks,effects:clip.effectStack.filter(effect=>effect.enabled),text:clip.text,component:clip.component,props:clip.props}};
}
function motionForClip(project:FlickProjectV3,clip:V2Clip):MotionComposition|undefined {
 const explicit=typeof clip.props?.motionCompositionId==='string'?clip.props.motionCompositionId:undefined;
 if(explicit)return project.motionCompositions.find(c=>c.id===explicit);
 if(clip.component){const component=project.motionComponents.find(c=>c.id===clip.component);if(component)return component.composition;}
 if(clip.compositionId&&!project.compositions.some(c=>c.id===clip.compositionId))return project.motionCompositions.find(c=>c.id===clip.compositionId);
 return undefined;
}
function timelineLayerRange(clip:V2Clip,layer:MotionLayer):{start:number;end:number}|undefined {
 const sourceStart=clip.sourceIn,sourceEnd=clip.sourceIn+clip.duration,layerStart=layer.start,layerEnd=layer.start+layer.duration;
 const start=Math.max(sourceStart,layerStart),end=Math.min(sourceEnd,layerEnd);if(end<=start)return undefined;
 return{start:clip.start+(start-sourceStart),end:clip.start+(end-sourceStart)};
}
function motionKind(layer:MotionLayer):{kind:RenderNodeKind;capabilityId:string} {
 if(layer.kind==='text')return{kind:'text-scene',capabilityId:'motion.text'};
 if(layer.kind==='shape')return{kind:'vector-scene',capabilityId:'motion.vector'};
 if(layer.kind==='camera')return{kind:'camera',capabilityId:'motion.camera'};
 return{kind:'motion-layer',capabilityId:`motion.layer.${layer.kind}`};
}
function layerUsesAudio(layer:MotionLayer):boolean {
 const props:unknown[]=[layer.opacity,layer.transform.position,layer.transform.anchor,layer.transform.scale,layer.transform.rotation];
 const check=(p:unknown)=>typeof p==='object'&&p!==null&&((p as {behaviors?:Array<{type:string}>}).behaviors?.some(b=>b.type==='audio-react')||String((p as {expression?:{source?:string}}).expression?.source??'').includes('audio.'));
 return props.some(check)||Boolean(layer.textStyle&&Object.values(layer.textStyle).some(check));
}
function compileMotionClip(project:FlickProjectV3,trackId:string,clip:V2Clip,composition:MotionComposition,nodes:RenderNode[]):string {
 const clipRange={start:clip.start,end:clip.start+clip.duration};
 const prefix=`motion:${trackId}:${clip.id}:${composition.id}`;
 const analysisIds:string[]=[];
 if(composition.layers.some(layerUsesAudio))for(const analysis of project.audioAnalyses??[]){const id=`${prefix}:analysis:${analysis.id}`;nodes.push({id,kind:'audio-analysis',range:clipRange,upstream:[],params:{analysisId:analysis.id,assetId:analysis.assetId,sourceHash:analysis.sourceHash,algorithm:analysis.algorithm,algorithmVersion:analysis.algorithmVersion},capabilityId:'motion.audio-analysis'});analysisIds.push(id);}
 const baseByLayer=new Map<string,string>();const finalByLayer=new Map<string,string>();
 for(const layer of composition.layers){const range=timelineLayerRange(clip,layer);if(!range)continue;const info=motionKind(layer),id=`${prefix}:layer:${layer.id}`;nodes.push({id,kind:info.kind,range,upstream:[...analysisIds],params:{trackId,clipId:clip.id,motionCompositionId:composition.id,layerId:layer.id,layer:structuredClone(layer),sourceIn:clip.sourceIn},capabilityId:info.capabilityId});baseByLayer.set(layer.id,id);finalByLayer.set(layer.id,id);}
 for(const layer of composition.layers){const child=baseByLayer.get(layer.id),parent=layer.parentId?baseByLayer.get(layer.parentId):undefined;if(child&&parent){const node=nodes.find(n=>n.id===child)!;if(!node.upstream.includes(parent))node.upstream.push(parent);}}
 for(const layer of composition.layers){const range=timelineLayerRange(clip,layer),base=baseByLayer.get(layer.id);if(!range||!base)continue;let prev=base;
   const trackingId=typeof layer.props?.trackingRecordId==='string'?layer.props.trackingRecordId:undefined;if(trackingId){const record=project.trackingData?.find(t=>t.id===trackingId),id=`${prefix}:tracking:${layer.id}`;nodes.push({id,kind:'tracking-transform',range,upstream:[prev],params:{trackingRecordId:trackingId,record},capabilityId:record?.supported?'motion.tracking':'motion.tracking.unsupported'});prev=id;}
   if(composition.motionBlur?.enabled&&layer.motionBlur){const id=`${prefix}:blur:${layer.id}`;nodes.push({id,kind:'motion-blur',range,upstream:[prev],params:{settings:composition.motionBlur,layerId:layer.id},capabilityId:'motion.blur'});prev=id;}
   if(layer.matte&&baseByLayer.has(layer.matte.sourceLayerId)){const id=`${prefix}:matte:${layer.id}`;nodes.push({id,kind:'matte',range,upstream:[prev,baseByLayer.get(layer.matte.sourceLayerId)!],params:{layerId:layer.id,matte:layer.matte},capabilityId:'motion.matte'});prev=id;}
   finalByLayer.set(layer.id,prev);
 }
 let sceneVisuals=composition.layers.filter(l=>!['camera','null','group'].includes(l.kind)).map(l=>finalByLayer.get(l.id)).filter((id):id is string=>Boolean(id));
 if(composition.compositingGraph){const graphMap=new Map(composition.compositingGraph.nodes.map(graphNode=>[graphNode.id,`${prefix}:graph:${graphNode.id}`]));for(const graphNode of composition.compositingGraph.nodes){const id=graphMap.get(graphNode.id)!,upstream=graphNode.inputs.map(input=>{const resolved=graphMap.get(input);if(!resolved)throw new Error(`Compositing node ${graphNode.id} references missing input ${input}`);return resolved;});if(!upstream.length&&graphNode.kind==='layer')upstream.push(...sceneVisuals);nodes.push({id,kind:'compositing-node',range:clipRange,upstream,params:{motionCompositionId:composition.id,node:structuredClone(graphNode)},capabilityId:`motion.composite.${graphNode.kind}`});}const out=graphMap.get(composition.compositingGraph.outputNodeId);if(!out)throw new Error(`Missing compositing output ${composition.compositingGraph.outputNodeId}`);sceneVisuals=[out];}
 for(const transition of composition.sharedTransitions??[]){const start=clip.start+(transition.start-clip.sourceIn),end=start+transition.duration;if(end<=clipRange.start||start>=clipRange.end)continue;const id=`${prefix}:transition:${transition.id}`;nodes.push({id,kind:'shared-transition',range:{start:Math.max(start,clipRange.start),end:Math.min(end,clipRange.end)},upstream:[...sceneVisuals],params:{transition:structuredClone(transition)},capabilityId:`motion.transition.${transition.kind}`});sceneVisuals=[id];}
 const camera=composition.cameraId?finalByLayer.get(composition.cameraId):undefined;
 const id=`${prefix}:output`;nodes.push({id,kind:'motion-source',range:clipRange,upstream:[...sceneVisuals,...(camera?[camera]:[])],params:{trackId,clipId:clip.id,motionCompositionId:composition.id,sourceIn:clip.sourceIn,width:composition.width,height:composition.height,background:composition.background},capabilityId:'motion.scene.v3'});return id;
}
export function compileRenderGraph(project:RenderableProject,compositionId=project.rootCompositionId):RenderGraph {
 const c=project.compositions.find(x=>x.id===compositionId); if(!c) throw new Error(`Unknown composition ${compositionId}`);
 const nodes:RenderNode[]=[]; const visual:string[]=[]; const audioByBus=new Map<string,string[]>();
 for(const t of [...c.tracks].sort((a,b)=>(a.zIndex??0)-(b.zIndex??0)||a.id.localeCompare(b.id))){
   for(const clip of [...t.clips].sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))){
     if(!clip.enabled||t.muted) continue;
     const range={start:clip.start,end:clip.start+clip.duration};
     if(t.kind==='audio'){
       const id=`audio:clip:${t.id}:${clip.id}`; nodes.push({id,kind:'audio-source',range,upstream:[],params:{assetId:clip.assetId,sourceIn:clip.sourceIn,gainDb:clip.gainDb??0,pan:clip.pan??0}}); (audioByBus.get(clip.busId??'master')??audioByBus.set(clip.busId??'master',[]).get(clip.busId??'master')!).push(id);
     } else {
       let prev:string;
       if(isV3(project)){
         const motion=motionForClip(project,clip);
         if(motion)prev=compileMotionClip(project,t.id,clip,motion,nodes);
         else {const source=nodeForClip(project,t.id,clip,clip.assetId?project.assets.find(a=>a.id===clip.assetId)?.path:undefined);nodes.push(source);prev=source.id;}
       } else {
         const source=nodeForClip(project,t.id,clip,clip.assetId?project.assets.find(a=>a.id===clip.assetId)?.path:undefined);nodes.push(source);prev=source.id;
       }
       for(const fx of clip.effectStack.filter(e=>e.enabled)){const id=`effect:${t.id}:${clip.id}:${fx.id}`; nodes.push({id,kind:'effect',range,upstream:[prev],params:{type:fx.type,...fx.params},capabilityId:fx.type}); prev=id;}
       visual.push(prev);
     }
   }
 }
 let prevVisual:string|undefined;
 for(const id of visual){ if(!prevVisual){prevVisual=id;continue;} const n=nodes.find(x=>x.id===id)!; const cid=`composite:${prevVisual}+${id}`; nodes.push({id:cid,kind:'composite',range:{start:Math.min(nodes.find(x=>x.id===prevVisual)!.range.start,n.range.start),end:Math.max(nodes.find(x=>x.id===prevVisual)!.range.end,n.range.end)},upstream:[prevVisual,id],params:{}}); prevVisual=cid; }
 const output='output:'+compositionId; nodes.push({id:output,kind:'output',range:{start:0,end:Math.max(0,...c.tracks.flatMap(t=>t.clips.map(x=>x.start+x.duration)))},upstream:prevVisual?[prevVisual]:[],params:{width:c.width,height:c.height}});
 for(const bus of project.audioBuses){const upstream=audioByBus.get(bus.id)??[]; nodes.push({id:`audio:bus:${bus.id}`,kind:'audio-bus',range:{start:0,end:Math.max(0,...nodes.filter(n=>n.kind==='audio-source').map(n=>n.range.end))},upstream,params:{gainDb:bus.gainDb,pan:bus.pan}});}
 const audioOutput='audio:output'; const master=project.audioBuses.find(b=>b.id==='master'); nodes.push({id:audioOutput,kind:'audio-output',range:{start:0,end:Math.max(0,...nodes.filter(n=>n.kind==='audio-source').map(n=>n.range.end))},upstream:master?['audio:bus:master']:[],params:{}});
 return {compositionId,nodes,outputNodeId:output,audioOutputNodeId:audioOutput};
}

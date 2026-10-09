import { resolve } from 'node:path';
import type { FlickProjectV2, Transform2D, AudioEffectInstance, Keyframe } from '../../../packages/schema/src/v2/project.ts';
import { serializeProjectV2 } from '../../../packages/schema/src/v2/parse.ts';
import { V2ProjectSession, type V2EditOperation } from '../../../packages/timeline/src/v2.ts';
import { validatePermittedPath } from '../../../packages/timeline/src/path-policy.ts';
import { renderProjectV2 } from '../../../packages/render-ffmpeg/src/v2.ts';
import { compileRenderGraph } from '../../../packages/render-graph/src/compile.ts';
import { diagnoseRendererSupport } from '../../../packages/render-graph/src/capabilities.ts';
import type { RendererCapabilitySet } from '../../../packages/render-graph/src/types.ts';
import { selectPreviewBackend, type EnvironmentCapabilities } from '../../../packages/render-preview/src/index.ts';
import { AtomicProjectWrite } from '../../../packages/desktop-runtime/src/index.ts';

export interface V2FlickSmithHostOptions {
  project:FlickProjectV2;
  projectPath?:string;
  permittedRoots?:string[];
  previewEnvironment?:EnvironmentCapabilities;
}
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function str(value:unknown,name:string):string{if(typeof value!=='string'||!value)throw new Error(`${name} must be a non-empty string`);return value;}
function num(value:unknown,name:string):number{if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${name} must be finite`);return value;}
function int(value:unknown,name:string):number{const v=num(value,name);if(!Number.isInteger(v)||v<0)throw new Error(`${name} must be a non-negative integer`);return v;}
function obj<T=Record<string,unknown>>(value:unknown,name:string):T{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${name} must be an object`);return structuredClone(value as T);}
function arr<T>(value:unknown,name:string):T[]{if(!Array.isArray(value))throw new Error(`${name} must be an array`);return structuredClone(value as T[]);}

const ffmpegNativeEffects=new Set(['exposure','contrast','saturation','gamma','temperature','blur','sharpen','transition:cross-dissolve']);
function ffmpegCapabilities(project:FlickProjectV2):RendererCapabilitySet{
  const graph=compileRenderGraph(project),effects:RendererCapabilitySet['effects']={};
  for(const node of graph.nodes)if(node.capabilityId)effects[node.capabilityId]={support:ffmpegNativeEffects.has(node.capabilityId)?'native':'unsupported'};
  return {renderer:'ffmpeg-v2',effects};
}

export class V2FlickSmithHost {
  #session:V2ProjectSession;
  #projectPath?:string;
  #roots:string[];
  #previewEnvironment:EnvironmentCapabilities;
  constructor(options:V2FlickSmithHostOptions){
    this.#session=new V2ProjectSession(options.project);
    this.#projectPath=options.projectPath;
    this.#roots=(options.permittedRoots??[process.cwd()]).map(x=>resolve(x));
    this.#previewEnvironment=options.previewEnvironment??{webGpu:false,webCodecs:false,nativeGpu:false,software:true};
  }
  get project():FlickProjectV2{return this.#session.project;}
  get revision():string{return this.#session.revision;}
  close():void{}
  #persist():void{if(!this.#projectPath)return;const w=AtomicProjectWrite.prepare(this.#projectPath,serializeProjectV2(this.#session.project));w.commit();}
  #apply(expectedRevision:unknown,operation:V2EditOperation){
    const expected=str(expectedRevision,'expectedRevision');const result=this.#session.apply(expected,operation);
    if(result.ok)this.#persist();
    return result.ok?{...result,revision:this.#session.revision}:result;
  }
  async call(name:string,rawArgs:unknown):Promise<unknown>{
    const args=record(rawArgs),intent=typeof args.intent==='string'?args.intent:undefined;
    switch(name){
      case 'get_timeline':return{project:this.#session.project,revision:this.#session.revision};
      case 'set_transform':return this.#apply(args.expectedRevision,{type:'set_transform',compositionId:str(args.compositionId,'compositionId'),clipId:str(args.clipId,'clipId'),transform:obj<Partial<Transform2D>>(args.transform,'transform'),intent});
      case 'set_opacity':return this.#apply(args.expectedRevision,{type:'set_opacity',compositionId:str(args.compositionId,'compositionId'),clipId:str(args.clipId,'clipId'),opacity:num(args.opacity,'opacity'),intent});
      case 'add_effect':return this.#apply(args.expectedRevision,{type:'add_effect',compositionId:str(args.compositionId,'compositionId'),clipId:str(args.clipId,'clipId'),effect:obj<AudioEffectInstance>(args.effect,'effect'),intent});
      case 'reorder_effects':return this.#apply(args.expectedRevision,{type:'reorder_effects',compositionId:str(args.compositionId,'compositionId'),clipId:str(args.clipId,'clipId'),effectIds:arr<string>(args.effectIds,'effectIds'),intent});
      case 'set_keyframes':return this.#apply(args.expectedRevision,{type:'set_keyframes',compositionId:str(args.compositionId,'compositionId'),clipId:str(args.clipId,'clipId'),effectId:str(args.effectId,'effectId'),param:str(args.param,'param'),keyframes:arr<Keyframe<unknown>>(args.keyframes,'keyframes'),intent});
      case 'set_audio_bus_gain':return this.#apply(args.expectedRevision,{type:'set_audio_bus_gain',busId:str(args.busId,'busId'),gainDb:num(args.gainDb,'gainDb'),intent});
      case 'set_audio_bus_effects':return this.#apply(args.expectedRevision,{type:'set_audio_bus_effects',busId:str(args.busId,'busId'),effects:arr<AudioEffectInstance>(args.effects,'effects'),intent});
      case 'switch_multicam_angle':return this.#apply(args.expectedRevision,{type:'switch_multicam_angle',groupId:str(args.groupId,'groupId'),start:int(args.start,'start'),end:int(args.end,'end'),angleId:str(args.angleId,'angleId'),intent});
      case 'materialize_multicam':return this.#apply(args.expectedRevision,{type:'materialize_multicam',groupId:str(args.groupId,'groupId'),compositionId:str(args.compositionId,'compositionId'),trackId:str(args.trackId,'trackId'),intent});
      case 'render_final_v2':{const output=str(args.output,'output');validatePermittedPath(output,this.#roots);return{output:renderProjectV2(this.#session.project,output),revision:this.#session.revision};}
      case 'get_preview_capabilities':{const selected=selectPreviewBackend(this.#previewEnvironment);return{backend:selected.backend,available:selected.backend!=='unavailable',reason:selected.reason,environment:structuredClone(this.#previewEnvironment),quality:this.#session.project.preview.quality};}
      case 'get_render_diagnostics':{const graph=compileRenderGraph(this.#session.project);const diagnostics=diagnoseRendererSupport(graph,ffmpegCapabilities(this.#session.project));return{renderer:'ffmpeg-v2',nodeCount:graph.nodes.length,errors:diagnostics.filter(x=>x.severity==='error'),warnings:diagnostics.filter(x=>x.severity==='warning')};}
      default:throw new Error(`Unknown FlickSmith v2 tool: ${name}`);
    }
  }
}

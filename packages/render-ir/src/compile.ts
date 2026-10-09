import type { FlickProjectV3, MotionLayer, ShapeGeometry } from '../../schema/src/v3/project.ts';
import type { RenderGraph, RenderNode } from '../../render-graph/src/types.ts';
import { DEFAULT_RENDER_PROGRAM_LIMITS, type RenderProgramLimits, type RenderProgramV1 } from './types.ts';

function fpsOf(project:FlickProjectV3):number {
  const f=project.format.fps; return f.denominator===0?0:f.numerator/f.denominator;
}
function finite(value:unknown,path='root'):void {
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error(`RenderProgram requires finite numbers at ${path}`);
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)finite(value[i],`${path}[${i}]`);return;}
  if(value&&typeof value==='object')for(const [k,v] of Object.entries(value as Record<string,unknown>))finite(v,`${path}.${k}`);
}
function countPathPoints(shape:ShapeGeometry|undefined):number {
  if(!shape)return 0;
  if(shape.kind==='path')return shape.points.length;
  if(shape.kind==='polygon')return shape.points.length;
  return 0;
}
function detectNodeCycle(nodes:RenderNode[]):void {
  const byId=new Map(nodes.map(n=>[n.id,n])); const visiting=new Set<string>(),done=new Set<string>();
  const walk=(id:string)=>{if(done.has(id))return;if(visiting.has(id))throw new Error(`RenderProgram graph cycle at ${id}`);visiting.add(id);const n=byId.get(id);if(n)for(const u of n.upstream)if(byId.has(u))walk(u);visiting.delete(id);done.add(id);};
  for(const n of nodes)walk(n.id);
}
function detectCompositingCycle(program:RenderProgramV1):void {
  const graph=program.compositingGraph;if(!graph)return;
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));const visiting=new Set<string>(),done=new Set<string>();
  const walk=(id:string)=>{if(done.has(id))return;if(visiting.has(id))throw new Error(`RenderProgram compositing cycle at ${id}`);visiting.add(id);for(const input of byId.get(id)?.inputs??[])if(byId.has(input))walk(input);visiting.delete(id);done.add(id);};
  for(const n of graph.nodes)walk(n.id);
}
export function validateRenderProgram(program:RenderProgramV1,limits:RenderProgramLimits=program.limits??DEFAULT_RENDER_PROGRAM_LIMITS):RenderProgramV1 {
  if(program.version!==1)throw new Error(`Unsupported RenderProgram major version ${String((program as {version?:unknown}).version)}`);
  if(program.projectVersion!==3)throw new Error(`RenderProgram requires projectVersion 3`);
  finite(program);
  if(program.surface.width<=0||program.surface.height<=0||program.surface.width>limits.maxTextureDimension||program.surface.height>limits.maxTextureDimension)throw new Error('RenderProgram texture dimension limit exceeded');
  if(program.layers.length>limits.maxLayers)throw new Error('RenderProgram layer limit exceeded');
  let points=0,masks=0,effects=0;
  const ids=new Set<string>();
  for(const layer of program.layers){if(ids.has(layer.id))throw new Error(`Duplicate layer ${layer.id}`);ids.add(layer.id);points+=countPathPoints(layer.shape);for(const mask of layer.masks??[])points+=countPathPoints(mask.geometry);masks+=layer.masks?.length??0;effects+=layer.effects?.length??0;}
  effects+=program.compositingGraph?.nodes.length??0;
  if(points>limits.maxPathPoints)throw new Error('RenderProgram path point limit exceeded');
  if(masks>limits.maxMasks)throw new Error('RenderProgram mask limit exceeded');
  if(effects>limits.maxEffectNodes)throw new Error('RenderProgram effect node limit exceeded');
  detectNodeCycle(program.graph.nodes);detectCompositingCycle(program);
  return program;
}
export function compileRenderProgram(project:FlickProjectV3,graph:RenderGraph,target:{compositionId:string}):RenderProgramV1 {
  const composition=project.motionCompositions.find(c=>c.id===target.compositionId);if(!composition)throw new Error(`Unknown motion composition ${target.compositionId}`);
  const fps=fpsOf(project);if(!Number.isFinite(fps)||fps<=0)throw new Error('Invalid project frame rate');
  const program:RenderProgramV1={
    version:1,projectVersion:3,projectId:project.id,target:{compositionId:target.compositionId},
    surface:{width:composition.width,height:composition.height,fps,durationFrames:composition.duration,background:composition.background},
    layers:structuredClone(composition.layers),cameraId:composition.cameraId,compositingGraph:composition.compositingGraph?structuredClone(composition.compositingGraph):undefined,
    layoutVariants:composition.layoutVariants?structuredClone(composition.layoutVariants):undefined,motionBlur:composition.motionBlur?structuredClone(composition.motionBlur):undefined,
    graph:structuredClone(graph),
    assets:project.assets.map(a=>({id:a.id,kind:a.kind,path:a.path,duration:a.duration??0,hash:typeof a.metadata?.hash==='string'?a.metadata.hash:undefined,metadata:a.metadata?structuredClone(a.metadata):undefined})),
    audioAnalyses:structuredClone(project.audioAnalyses??[]),transitions:structuredClone(composition.sharedTransitions??[]),limits:{...DEFAULT_RENDER_PROGRAM_LIMITS},
  };
  return validateRenderProgram(program);
}

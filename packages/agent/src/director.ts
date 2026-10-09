import type { AspectClass, SharedTransition } from '../../schema/src/v3/project.ts';

export interface CreativeBrief {
  id:string; objective:string; audience:string; durationFrames:number; aspect:AspectClass;
  message:string; constraints:string[];
}
export interface MotionGrammar {
  id:string; motionStyleIds:string[]; transitionKinds:SharedTransition['kind'][];
  textEntrances:string[]; cameraLanguage:string[]; rules:string[];
}
export interface StoryboardScene {
  id:string; start:number; duration:number; purpose:string; focus:string;
  componentId?:string; motionStyleId?:string; transitionOut?:SharedTransition['kind'];
  rationale:string; constraints:string[]; props?:Record<string,unknown>;
}
export interface ShotPlanItem { id:string; sceneId:string; start:number; duration:number; compositionId:string; camera?:string; focusLayerIds:string[] }
export interface SoundPlanItem { id:string; sceneId:string; frame:number; event:string; assetId?:string; gainDb?:number }
export interface DirectorPlan { version:1; brief:CreativeBrief; grammar:MotionGrammar; storyboard:StoryboardScene[]; shots:ShotPlanItem[]; sound:SoundPlanItem[] }
export interface DirectorReferenceCatalog { componentIds:Set<string>; motionStyleIds:Set<string>; compositionIds:Set<string> }
export interface DirectorReceipt { sceneId:string; intent:string; purpose:string; focus:string; constraints:string[]; componentId?:string; motionStyleId?:string }

const forbiddenKeys=/^(command|commands|script|scripts|code|javascript|shell|executable|exec|eval|function|module|import|require|process|child_process)$/i;
function scanOpaqueExecutable(value:unknown,path='plan',depth=0):void {
  if(depth>32)throw new Error(`Opaque executable payload nesting exceeds limit at ${path}`);
  if(typeof value==='function')throw new Error(`Opaque executable function is not allowed at ${path}`);
  if(Array.isArray(value)){if(value.length>10_000)throw new Error(`Director array exceeds limit at ${path}`);value.forEach((v,i)=>scanOpaqueExecutable(v,`${path}[${i}]`,depth+1));return;}
  if(value&&typeof value==='object')for(const [key,v] of Object.entries(value as Record<string,unknown>)){if(forbiddenKeys.test(key))throw new Error(`Opaque executable field ${key} is not allowed at ${path}`);scanOpaqueExecutable(v,`${path}.${key}`,depth+1);}
}
function nonEmpty(value:string,name:string):void {if(typeof value!=='string'||!value.trim())throw new Error(`${name} is required`);}
function finiteFrame(value:number,name:string,positive=false):void {if(!Number.isInteger(value)||value<(positive?1:0))throw new Error(`${name} must be an integer frame`);}
function unique<T extends {id:string}>(items:T[],name:string):void {const ids=new Set<string>();for(const item of items){nonEmpty(item.id,`${name}.id`);if(ids.has(item.id))throw new Error(`Duplicate ${name} id ${item.id}`);ids.add(item.id);}}

export function validateDirectorPlan(input:DirectorPlan,catalog:DirectorReferenceCatalog):DirectorPlan {
  scanOpaqueExecutable(input);
  if(input.version!==1)throw new Error(`Unsupported Director plan version ${String((input as {version?:unknown}).version)}`);
  nonEmpty(input.brief.id,'brief.id');nonEmpty(input.brief.objective,'brief.objective');nonEmpty(input.brief.audience,'brief.audience');nonEmpty(input.brief.message,'brief.message');finiteFrame(input.brief.durationFrames,'brief.durationFrames',true);
  nonEmpty(input.grammar.id,'grammar.id');unique(input.storyboard,'storyboard scene');unique(input.shots,'shot');unique(input.sound,'sound cue');
  const sceneIds=new Set(input.storyboard.map(s=>s.id));
  for(const scene of input.storyboard){
    finiteFrame(scene.start,`${scene.id}.start`);finiteFrame(scene.duration,`${scene.id}.duration`,true);if(scene.start+scene.duration>input.brief.durationFrames)throw new Error(`Scene ${scene.id} exceeds brief duration`);
    nonEmpty(scene.purpose,`${scene.id}.purpose`);nonEmpty(scene.focus,`${scene.id}.focus`);nonEmpty(scene.rationale,`${scene.id}.rationale`);
    if(scene.componentId&&!catalog.componentIds.has(scene.componentId))throw new Error(`Unknown component ${scene.componentId}`);
    if(scene.motionStyleId&&!catalog.motionStyleIds.has(scene.motionStyleId))throw new Error(`Unknown motion style ${scene.motionStyleId}`);
    if(scene.transitionOut&&!input.grammar.transitionKinds.includes(scene.transitionOut))throw new Error(`Transition ${scene.transitionOut} is outside motion grammar`);
  }
  for(const styleId of input.grammar.motionStyleIds)if(!catalog.motionStyleIds.has(styleId))throw new Error(`Unknown motion style ${styleId}`);
  for(const shot of input.shots){if(!sceneIds.has(shot.sceneId))throw new Error(`Unknown scene ${shot.sceneId} for shot ${shot.id}`);if(!catalog.compositionIds.has(shot.compositionId))throw new Error(`Unknown composition ${shot.compositionId}`);finiteFrame(shot.start,`${shot.id}.start`);finiteFrame(shot.duration,`${shot.id}.duration`,true);}
  for(const sound of input.sound){if(!sceneIds.has(sound.sceneId))throw new Error(`Unknown scene ${sound.sceneId} for sound ${sound.id}`);finiteFrame(sound.frame,`${sound.id}.frame`);if(sound.frame>=input.brief.durationFrames)throw new Error(`Sound ${sound.id} lies outside brief duration`);}
  return structuredClone(input);
}
export function buildDirectorReceipt(scene:StoryboardScene):DirectorReceipt {
  return {sceneId:scene.id,intent:scene.rationale,purpose:scene.purpose,focus:scene.focus,constraints:[...scene.constraints],...(scene.componentId?{componentId:scene.componentId}:{}),...(scene.motionStyleId?{motionStyleId:scene.motionStyleId}:{})};
}

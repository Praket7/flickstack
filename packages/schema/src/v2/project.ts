import type { Asset, BranchRef, Checkpoint, FrameTick, Marker, ProjectFormat, ProvenanceRecord, SemanticLock, TrackKind } from '../project.ts';

export type BlendMode = 'normal'|'multiply'|'screen'|'overlay'|'darken'|'lighten'|'add'|'difference'|'exclusion'|'soft-light'|'hard-light';
export interface Transform2D { x:number; y:number; scaleX:number; scaleY:number; rotation:number }
export interface CurveHandle { x:number; y:number }
export interface Keyframe<T> { frame:FrameTick; value:T; interpolation:'hold'|'linear'|'bezier'; inTangent?:CurveHandle; outTangent?:CurveHandle }
export interface SpeedPoint { frame:FrameTick; speed:number }
export interface SpeedCurve { points:SpeedPoint[] }
export interface EffectInstance { id:string; type:string; enabled:boolean; params:Record<string,unknown>; keyframes?:Record<string,Keyframe<unknown>[]> }
export interface AudioEffectInstance extends EffectInstance {}
export interface V2Clip {
  id:string; assetId?:string; compositionId?:string; start:FrameTick; duration:FrameTick; sourceIn:FrameTick;
  transform:Transform2D; opacity:number; blendMode:BlendMode; maskRefs:string[]; effectStack:EffectInstance[];
  speed?:number; speedCurve?:SpeedCurve; gainDb?:number; pan?:number; busId?:string;
  text?:string; component?:string; props?:Record<string,unknown>; enabled:boolean; locked?:boolean;
}
export interface V2Track { id:string; kind:TrackKind; name:string; clips:V2Clip[]; locked?:boolean; muted?:boolean; zIndex?:number }
export interface Composition { id:string; name:string; width:number; height:number; tracks:V2Track[] }
export interface RectMaskDefinition { id:string;kind:'rect';x:number;y:number;width:number;height:number;feather:number;invert:boolean }
export interface EllipseMaskDefinition { id:string;kind:'ellipse';x:number;y:number;width:number;height:number;feather:number;invert:boolean }
export interface PolygonMaskDefinition { id:string;kind:'polygon';points:Array<{x:number;y:number}>;feather:number;invert:boolean }
export type MaskDefinition=RectMaskDefinition|EllipseMaskDefinition|PolygonMaskDefinition;
export interface AudioBus { id:string; name:string; effects:AudioEffectInstance[]; gainDb:number; pan:number; outputBusId?:string }
export interface MulticamAngle { id:string; assetId:string; sourceOffset:FrameTick; confidence:number; driftModel?:unknown }
export interface MulticamProgramSegment { start:FrameTick; end:FrameTick; angleId:string }
export interface MulticamGroup { id:string; name:string; angles:MulticamAngle[]; program:MulticamProgramSegment[]; sync?:Record<string,unknown>; audioPolicy?:Record<string,unknown> }
export interface PerceptionManifest { evidenceDbPath?:string; providers:Record<string,unknown>[] }
export interface PreviewSettings { quality:'full'|'half'|'quarter'|'proxy'; preferGpu:boolean }
export interface FlickProjectV2 {
  version:2; id:string; name:string; format:ProjectFormat; assets:Asset[];
  rootCompositionId:string; compositions:Composition[]; masks?:MaskDefinition[]; audioBuses:AudioBus[]; multicamGroups:MulticamGroup[];
  perception:PerceptionManifest; preview:PreviewSettings;
  markers:Marker[]; style:Record<string,unknown>; provenance:ProvenanceRecord[]; checkpoints:Checkpoint[]; branches:BranchRef[]; semanticLocks?:SemanticLock[];
}
export const defaultTransform=():Transform2D=>({x:0,y:0,scaleX:1,scaleY:1,rotation:0});

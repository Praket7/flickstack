import { createHash } from 'node:crypto';
import type { AudioEffectInstance, FlickProjectV2, Keyframe, Transform2D, V2Clip } from '../../schema/src/v2/project.ts';
import { assertNoCredentialFields } from '../../schema/src/secrets.ts';
import { materializeMulticamProgram, switchProgramAngle } from '../../multicam/src/index.ts';

export type V2EditOperation=
 |{type:'set_opacity';compositionId:string;clipId:string;opacity:number;intent?:string}
 |{type:'set_transform';compositionId:string;clipId:string;transform:Partial<Transform2D>;intent?:string}
 |{type:'add_effect';compositionId:string;clipId:string;effect:AudioEffectInstance;intent?:string}
 |{type:'reorder_effects';compositionId:string;clipId:string;effectIds:string[];intent?:string}
 |{type:'set_keyframes';compositionId:string;clipId:string;effectId:string;param:string;keyframes:Keyframe<unknown>[];intent?:string}
 |{type:'set_audio_bus_gain';busId:string;gainDb:number;intent?:string}
 |{type:'set_audio_bus_effects';busId:string;effects:AudioEffectInstance[];intent?:string}
 |{type:'switch_multicam_angle';groupId:string;start:number;end:number;angleId:string;intent?:string}
 |{type:'materialize_multicam';groupId:string;compositionId:string;trackId:string;intent?:string};
export interface V2Receipt{operation:V2EditOperation['type'];intent?:string;checkpointId:string;affectedIds:string[]}
export interface V2EditResult{project:FlickProjectV2;checkpointId:string;receipt:V2Receipt;diff:{beforeRevision:string;afterRevision:string;affectedIds:string[]};warnings:string[]}
export function projectRevision(project:FlickProjectV2):string{return createHash('sha256').update(JSON.stringify(project)).digest('hex').slice(0,16);}
function getClip(p:FlickProjectV2,compositionId:string,clipId:string):V2Clip{const c=p.compositions.find(c=>c.id===compositionId);if(!c)throw new Error(`Unknown composition ${compositionId}`);for(const t of c.tracks){const clip=t.clips.find(x=>x.id===clipId);if(clip){if(t.locked||clip.locked)throw new Error(`Clip ${clipId} is locked`);return clip;}}throw new Error(`Unknown clip ${clipId}`);}
function checkpoint(project:FlickProjectV2,op:V2EditOperation){return 'cp_'+createHash('sha256').update(JSON.stringify([project.id,project.checkpoints.length,op])).digest('hex').slice(0,12);}
export function applyV2Operation(input:FlickProjectV2,op:V2EditOperation):V2EditResult{assertNoCredentialFields(op,'editOperation');const before=projectRevision(input),p=structuredClone(input);const affected:string[]=[];
 switch(op.type){
  case 'set_opacity':{if(!Number.isFinite(op.opacity)||op.opacity<0||op.opacity>1)throw new Error('opacity must be 0..1');const c=getClip(p,op.compositionId,op.clipId);c.opacity=op.opacity;affected.push(c.id);break;}
  case 'set_transform':{const c=getClip(p,op.compositionId,op.clipId);c.transform={...c.transform,...op.transform};affected.push(c.id);break;}
  case 'add_effect':{const c=getClip(p,op.compositionId,op.clipId);if(c.effectStack.some(x=>x.id===op.effect.id))throw new Error(`Duplicate effect ${op.effect.id}`);c.effectStack.push(structuredClone(op.effect));affected.push(c.id,op.effect.id);break;}
  case 'reorder_effects':{const c=getClip(p,op.compositionId,op.clipId);if(op.effectIds.length!==c.effectStack.length||new Set(op.effectIds).size!==op.effectIds.length)throw new Error('effectIds must contain every effect exactly once');const m=new Map(c.effectStack.map(e=>[e.id,e]));if(op.effectIds.some(id=>!m.has(id)))throw new Error('unknown effect id');c.effectStack=op.effectIds.map(id=>m.get(id)!);affected.push(c.id,...op.effectIds);break;}
  case 'set_keyframes':{const c=getClip(p,op.compositionId,op.clipId),e=c.effectStack.find(x=>x.id===op.effectId);if(!e)throw new Error(`Unknown effect ${op.effectId}`);e.keyframes??={};e.keyframes[op.param]=structuredClone(op.keyframes);affected.push(c.id,e.id);break;}
  case 'set_audio_bus_gain':{const b=p.audioBuses.find(x=>x.id===op.busId);if(!b)throw new Error(`Unknown bus ${op.busId}`);if(!Number.isFinite(op.gainDb)||op.gainDb<-120||op.gainDb>60)throw new Error('gain out of range');b.gainDb=op.gainDb;affected.push(b.id);break;}
  case 'set_audio_bus_effects':{const b=p.audioBuses.find(x=>x.id===op.busId);if(!b)throw new Error(`Unknown bus ${op.busId}`);b.effects=structuredClone(op.effects);affected.push(b.id);break;}
  case 'switch_multicam_angle':{const g=p.multicamGroups.find(x=>x.id===op.groupId);if(!g)throw new Error(`Unknown multicam group ${op.groupId}`);if(!g.angles.some(a=>a.id===op.angleId))throw new Error(`Unknown angle ${op.angleId}`);g.program=switchProgramAngle(g.program,op.start,op.end,op.angleId);affected.push(g.id,op.angleId);break;}
  case 'materialize_multicam':{const q=materializeMulticamProgram(p,op.groupId,op.compositionId,op.trackId);p.compositions=q.compositions;affected.push(op.groupId,op.compositionId,op.trackId);break;}
 }
 const checkpointId=checkpoint(input,op);p.checkpoints.push({id:checkpointId,createdAt:new Date().toISOString(),parentId:input.checkpoints.at(-1)?.id,intent:op.intent});const after=projectRevision(p);return{project:p,checkpointId,receipt:{operation:op.type,intent:op.intent,checkpointId,affectedIds:affected},diff:{beforeRevision:before,afterRevision:after,affectedIds:affected},warnings:[]};}
export type SessionApplyResult={ok:true;result:V2EditResult}|{ok:false;conflict:{expectedRevision:string;currentRevision:string;message:string}};
export class V2ProjectSession {project:FlickProjectV2;revision:string;constructor(project:FlickProjectV2){this.project=structuredClone(project);this.revision=projectRevision(this.project);}apply(expectedRevision:string,op:V2EditOperation):SessionApplyResult{if(expectedRevision!==this.revision)return{ok:false,conflict:{expectedRevision,currentRevision:this.revision,message:'Project changed; refresh and retry'}};const result=applyV2Operation(this.project,op);this.project=result.project;this.revision=result.diff.afterRevision;return{ok:true,result};}}

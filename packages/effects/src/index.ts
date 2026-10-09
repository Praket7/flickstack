import type { EffectInstance, Keyframe } from '../../schema/src/v2/project.ts';

export interface EffectDefinition { type:string; params:Record<string,'number'|'string'|'boolean'> }
export class EffectRegistry {
  private readonly defs=new Map<string,EffectDefinition>();
  register(def:EffectDefinition):void { if(this.defs.has(def.type)) throw new Error(`Duplicate effect ${def.type}`); this.defs.set(def.type,structuredClone(def)); }
  get(type:string):EffectDefinition|undefined { const d=this.defs.get(type); return d?structuredClone(d):undefined; }
  validate(effect:EffectInstance):void { const d=this.defs.get(effect.type); if(!d) throw new Error(`Unknown effect ${effect.type}`); for(const [name,kind] of Object.entries(d.params)){const v=effect.params[name]; if(v!==undefined&&typeof v!==kind) throw new Error(`${effect.type}.${name} must be ${kind}`);} }
}

function bezierY(t:number,p1:number,p2:number):number { const u=1-t; return 3*u*u*t*p1+3*u*t*t*p2+t*t*t; }
export function evaluateNumberKeyframes(frames:Keyframe<number>[],at:number):number {
 if(!frames.length) throw new Error('keyframes required'); const sorted=[...frames].sort((a,b)=>a.frame-b.frame);
 if(at<=sorted[0].frame)return sorted[0].value; if(at>=sorted.at(-1)!.frame)return sorted.at(-1)!.value;
 const i=sorted.findIndex((k,n)=>n>0&&at<=k.frame); const a=sorted[i-1],b=sorted[i]; if(a.interpolation==='hold')return a.value;
 const t=(at-a.frame)/(b.frame-a.frame); const e=a.interpolation==='bezier'?bezierY(t,a.outTangent?.y??1/3,b.inTangent?.y??2/3):t; return a.value+(b.value-a.value)*e;
}
export function transitionProgress(frame:number,start:number,duration:number):number { if(duration<=0)return frame>=start?1:0; return Math.max(0,Math.min(1,(frame-start)/duration)); }

export interface RectMask { id:string;kind:'rect';x:number;y:number;width:number;height:number;feather:number;invert:boolean;keyframes?:Partial<Record<'x'|'y'|'width'|'height'|'feather',Keyframe<number>[]>> }
export function maskAtFrame(mask:RectMask,frame:number):RectMask { const value=(k:'x'|'y'|'width'|'height'|'feather')=>mask.keyframes?.[k]?.length?evaluateNumberKeyframes(mask.keyframes[k]!,frame):mask[k]; return {...mask,x:value('x'),y:value('y'),width:value('width'),height:value('height'),feather:value('feather')}; }

function num(params:Record<string,unknown>,key:string,def:number):number { const v=params[key]; if(v===undefined)return def; if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`${key} must be finite number`); return v; }
export function compileColorEffect(effect:EffectInstance):string|undefined {
 if(!effect.enabled)return undefined;
 switch(effect.type){
  case 'exposure': return `eq=brightness=${(num(effect.params,'value',0)/10).toFixed(6)}`;
  case 'contrast': return `eq=contrast=${num(effect.params,'value',1).toFixed(6)}`;
  case 'saturation': return `eq=saturation=${num(effect.params,'value',1).toFixed(6)}`;
  case 'gamma': return `eq=gamma=${num(effect.params,'value',1).toFixed(6)}`;
  case 'temperature': { const v=num(effect.params,'value',0); const r=Math.max(.1,1+v/200),b=Math.max(.1,1-v/200); return `colorchannelmixer=rr=${r.toFixed(5)}:bb=${b.toFixed(5)}`; }
  case 'blur': return `gblur=sigma=${Math.max(0,num(effect.params,'radius',0)).toFixed(4)}`;
  case 'sharpen': { const v=Math.max(0,num(effect.params,'amount',1)); return `unsharp=5:5:${v.toFixed(4)}:5:5:0`; }
  default:return undefined;
 }
}


export interface EffectHostCapability {standard:'openfx'|'builtin';nativeExecution:boolean;processIsolation:boolean;parameterSerialization:boolean;gpuContextSharing:boolean;diagnostic?:string}
export function effectHostCapabilities():EffectHostCapability[]{return[
 {standard:'builtin',nativeExecution:true,processIsolation:true,parameterSerialization:true,gpuContextSharing:false},
 {standard:'openfx',nativeExecution:false,processIsolation:false,parameterSerialization:true,gpuContextSharing:false,diagnostic:'Native OpenFX execution is disabled and not available until an isolated plugin host is implemented'},
];}
export interface ProfessionalEffectCapabilities {openfx:{nativeExecution:false;processIsolation:false;parameterSerialization:true;gpuContextSharing:false};colorManagement:{runtime:'declarative-only';ocioRuntime:false;acesIntent:true}}
export function professionalEffectCapabilities():ProfessionalEffectCapabilities{return{openfx:{nativeExecution:false,processIsolation:false,parameterSerialization:true,gpuContextSharing:false},colorManagement:{runtime:'declarative-only',ocioRuntime:false,acesIntent:true}};}

export type V04EffectName='gaussian-blur'|'directional-blur'|'drop-shadow'|'inner-shadow'|'glow'|'color-matrix'|'sharpen'|'grain'|'vignette'|'displacement'|'chromatic-separation'|'light-sweep';
const V04_EFFECTS:V04EffectName[]=['gaussian-blur','directional-blur','drop-shadow','inner-shadow','glow','color-matrix','sharpen','grain','vignette','displacement','chromatic-separation','light-sweep'];
export function v04EffectCatalog():readonly string[]{return V04_EFFECTS;}
export function effectBoundsExpansion(effect:{type:string;params:Record<string,unknown>}):number{const n=(k:string,d=0)=>typeof effect.params[k]==='number'&&Number.isFinite(effect.params[k])?Math.max(0,effect.params[k] as number):d;switch(effect.type){case'gaussian-blur':case'glow':return n('radius')*2;case'directional-blur':return n('distance',n('radius'))*2;case'drop-shadow':return n('radius')*2+n('distance');case'inner-shadow':return 0;case'displacement':return n('amount')*2;case'chromatic-separation':return n('amount');default:return 0;}}
export function effectRenderPolicy(effectType:string):{backend:'gpu'|'cpu';diagnostic?:string}{return V04_EFFECTS.includes(effectType as V04EffectName)?{backend:'gpu'}:{backend:'cpu',diagnostic:'GPU parity unavailable; using CPU reference renderer'};}
export type TemporalQuality='preview-low'|'preview-full'|'final';
export function temporalSampleCount(quality:TemporalQuality,configured:number):number{return quality==='preview-low'?Math.min(4,Math.max(1,configured)):quality==='preview-full'?Math.min(8,Math.max(1,configured)):Math.min(64,Math.max(1,configured));}

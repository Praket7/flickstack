import type { MotionBehaviorInstance, Vec3 } from '../../schema/src/v3/project.ts';

export interface BehaviorContext {
  frame:number; start:number; duration:number; index:number; count:number; seed:number;
  audio?:Partial<Record<'energy'|'low'|'mid'|'high'|'beat'|'downbeat',number>>;
  resolveVector?:(id:string)=>Vec3|undefined;
}
export interface BehaviorDefinition { domains:Array<'number'|'vec3'|'text'|'camera'>; estimatedCost:number; bakeable:boolean }
export const behaviorRegistry:Record<string,BehaviorDefinition>={
  fade:{domains:['number'],estimatedCost:1,bakeable:true},slide:{domains:['vec3'],estimatedCost:1,bakeable:true},grow:{domains:['vec3'],estimatedCost:1,bakeable:true},spring:{domains:['number','vec3'],estimatedCost:2,bakeable:true},overshoot:{domains:['number','vec3'],estimatedCost:2,bakeable:true},drift:{domains:['number','vec3'],estimatedCost:1,bakeable:true},wiggle:{domains:['number','vec3'],estimatedCost:3,bakeable:true},follow:{domains:['vec3'],estimatedCost:2,bakeable:true},'look-at':{domains:['vec3','camera'],estimatedCost:2,bakeable:true},'follow-path':{domains:['vec3'],estimatedCost:3,bakeable:true},orbit:{domains:['vec3'],estimatedCost:2,bakeable:true},stagger:{domains:['number','vec3','text'],estimatedCost:1,bakeable:true},sequence:{domains:['number','vec3','text'],estimatedCost:1,bakeable:true},'type-on':{domains:['number','text'],estimatedCost:1,bakeable:true},'audio-react':{domains:['number','vec3'],estimatedCost:2,bakeable:true},'auto-focus':{domains:['number','camera'],estimatedCost:2,bakeable:true},
};
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const progress=(c:BehaviorContext)=>c.duration<=0?1:clamp01((c.frame-c.start)/c.duration);
const num=(v:unknown,d=0)=>typeof v==='number'&&Number.isFinite(v)?v:d;
const vec=(v:unknown,d:Vec3=[0,0,0]):Vec3=>Array.isArray(v)&&v.length>=3&&v.every(Number.isFinite)?[Number(v[0]),Number(v[1]),Number(v[2])]:d;
function noise(seed:number,x:number):number{const v=Math.sin((seed+1)*91.17+x*12.9898)*43758.5453;return(v-Math.floor(v))*2-1;}
function spring(t:number){return t<=0?0:t>=1?1:(1-Math.exp(-6*t)*Math.cos(12*t))/(1-Math.exp(-6)*Math.cos(12));}
function overshoot(t:number){return t<=0?0:t>=1?1:(1-Math.exp(-5*t)*(Math.cos(9*t)+.35*Math.sin(9*t)))/(1-Math.exp(-5)*(Math.cos(9)+.35*Math.sin(9)));}
function behaviorProgress(b:MotionBehaviorInstance,c:BehaviorContext):number {
  let p=progress(c);if(b.type==='stagger'||b.type==='sequence'){const step=num(b.params.step,.08);p=clamp01((p-c.index*step)/Math.max(.001,1-step*Math.max(0,c.count-1)));}return p;
}
export function evaluateBehaviorNumber(base:number,b:MotionBehaviorInstance,c:BehaviorContext):number {
  if(!b.enabled)return base;const p=behaviorProgress(b,c),amount=num(b.params.amount,1);
  switch(b.type){
    case 'fade':return num(b.params.from,0)+(num(b.params.to,base)-num(b.params.from,0))*p;
    case 'spring':return base+amount*spring(p);
    case 'overshoot':return base+amount*overshoot(p);
    case 'drift':return base+amount*p;
    case 'wiggle':return base+noise((b.seed??c.seed),c.frame*num(b.params.frequency,.1))*num(b.params.amplitude,amount);
    case 'stagger':case 'sequence':case 'type-on':return base*p;
    case 'audio-react':{const signal=String(b.params.signal??'energy') as keyof NonNullable<BehaviorContext['audio']>;return base+(c.audio?.[signal]??0)*amount;}
    case 'auto-focus':{const target=String(b.params.targetId??'');const v=c.resolveVector?.(target);return v?Math.hypot(v[0],v[1],v[2]):base;}
    default:return base;
  }
}
export function evaluateBehaviorVec3(base:Vec3,b:MotionBehaviorInstance,c:BehaviorContext):Vec3 {
  if(!b.enabled)return [...base] as Vec3;const p=behaviorProgress(b,c);
  switch(b.type){
    case 'slide':{const from=vec(b.params.from);return [base[0]+from[0]*(1-p),base[1]+from[1]*(1-p),base[2]+from[2]*(1-p)];}
    case 'grow':{const from=vec(b.params.from,[0,0,0]);return [from[0]+(base[0]-from[0])*p,from[1]+(base[1]-from[1])*p,from[2]+(base[2]-from[2])*p];}
    case 'drift':{const d=vec(b.params.offset);return[base[0]+d[0]*p,base[1]+d[1]*p,base[2]+d[2]*p];}
    case 'wiggle':{const amp=vec(b.params.amplitude,[10,10,10]),f=num(b.params.frequency,.1),seed=b.seed??c.seed;return[base[0]+noise(seed,c.frame*f)*amp[0],base[1]+noise(seed+1,c.frame*f)*amp[1],base[2]+noise(seed+2,c.frame*f)*amp[2]];}
    case 'follow':{const t=c.resolveVector?.(String(b.params.targetId??''));if(!t)return base;const o=vec(b.params.offset);return[t[0]+o[0],t[1]+o[1],t[2]+o[2]];}
    case 'look-at':{const t=c.resolveVector?.(String(b.params.targetId??''));if(!t)return base;return[base[0],base[1],Math.atan2(t[1]-base[1],t[0]-base[0])*180/Math.PI];}
    case 'follow-path':{const path=(b.params.points as unknown[]|undefined)?.map(x=>vec(x))??[];if(path.length<2)return base;const scaled=p*(path.length-1),i=Math.min(path.length-2,Math.floor(scaled)),t=scaled-i;return[path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t,path[i][2]+(path[i+1][2]-path[i][2])*t];}
    case 'orbit':{const center=b.params.targetId?c.resolveVector?.(String(b.params.targetId)):base;const o=center??base,r=num(b.params.radius,100),speed=num(b.params.speed,1),angle=p*Math.PI*2*speed+num(b.params.phase,0);return[o[0]+Math.cos(angle)*r,o[1]+Math.sin(angle)*r,o[2]+num(b.params.z,0)];}
    case 'spring':case 'overshoot':{const to=vec(b.params.to,base),e=b.type==='spring'?spring(p):overshoot(p);return[base[0]+(to[0]-base[0])*e,base[1]+(to[1]-base[1])*e,base[2]+(to[2]-base[2])*e];}
    case 'stagger':case 'sequence':{const from=vec(b.params.from,[0,0,0]);return[from[0]+(base[0]-from[0])*p,from[1]+(base[1]-from[1])*p,from[2]+(base[2]-from[2])*p];}
    case 'audio-react':{const signal=String(b.params.signal??'energy') as keyof NonNullable<BehaviorContext['audio']>,a=c.audio?.[signal]??0,amount=vec(b.params.amount,[1,1,1]);return[base[0]+a*amount[0],base[1]+a*amount[1],base[2]+a*amount[2]];}
    default:return base;
  }
}

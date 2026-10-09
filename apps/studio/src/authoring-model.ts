import type {MotionKeyframe} from '../../../packages/schema/src/v3/project.ts';
export interface SnapContext{beats:number[];keyframes:number[];threshold:number}
export function snapFrame(frame:number,c:SnapContext):number{const rounded=Math.round(frame),candidates=[...c.beats,...c.keyframes];let best:number|undefined,dist=Number.POSITIVE_INFINITY;for(const n of candidates){const d=Math.abs(frame-n);if(d<=c.threshold&&(d<dist||(d===dist&&(best===undefined||n<best)))){best=n;dist=d;}}return best??rounded;}
export function moveSelectedKeyframes<T>(keys:MotionKeyframe<T>[],selected:Set<number>,delta:number):MotionKeyframe<T>[]{const out=keys.map(k=>selected.has(k.frame)?{...structuredClone(k),frame:Math.max(0,Math.round(k.frame+delta))}:structuredClone(k));out.sort((a,b)=>a.frame-b.frame);if(new Set(out.map(k=>k.frame)).size!==out.length)throw new Error('keyframe move would overlap existing keyframes');return out;}
export interface KeyframeClipboard<T>{origin:number;keyframes:MotionKeyframe<T>[]}
export function copyKeyframes<T>(keys:MotionKeyframe<T>[],selected:Set<number>):KeyframeClipboard<T>{const chosen=keys.filter(k=>selected.has(k.frame)).map(k=>structuredClone(k));if(!chosen.length)return{origin:0,keyframes:[]};return{origin:Math.min(...chosen.map(k=>k.frame)),keyframes:chosen};}
export function pasteKeyframes<T>(clipboard:KeyframeClipboard<T>,at:number):MotionKeyframe<T>[]{return clipboard.keyframes.map(k=>({...structuredClone(k),frame:Math.max(0,Math.round(at+k.frame-clipboard.origin))})).sort((a,b)=>a.frame-b.frame);}

export function selectLayerIds(current:Set<string>,id:string,additive:boolean):Set<string>{
 if(!additive)return new Set([id]);
 const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;
}
export function resizeLayerTiming(value:{start:number;duration:number},edge:'start'|'end',delta:number):{start:number;duration:number}{
 const start=Math.max(0,Math.round(value.start));const end=start+Math.max(1,Math.round(value.duration));
 if(edge==='start'){const nextStart=Math.max(0,Math.min(end-1,Math.round(start+delta)));return{start:nextStart,duration:end-nextStart};}
 const nextEnd=Math.max(start+1,Math.round(end+delta));return{start,duration:nextEnd-start};
}
export type PropertyAnimationState='static'|'keyframed'|'expression'|'behavior'|'rig-linked';
export function animationState(prop:{baseValue?:unknown;keyframes?:unknown[];expression?:unknown;behaviors?:unknown[];rigBinding?:unknown}):PropertyAnimationState{
 if(prop.rigBinding)return'rig-linked';if(prop.expression)return'expression';if(prop.behaviors?.length)return'behavior';if(prop.keyframes?.length)return'keyframed';return'static';
}

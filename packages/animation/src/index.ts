import type {
  AnimatedProperty,
  MotionInterpolation,
  MotionKeyframe,
  MotionStyleDefinition,
  Vec2,
  Vec3,
} from '../../schema/src/v3/project.ts';

const EPS=1e-9;
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

function cubic(a:number,b:number,c:number,d:number,t:number):number {
  const u=1-t;
  return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
}
function cubicDerivative(a:number,b:number,c:number,d:number,t:number):number {
  const u=1-t;
  return 3*u*u*(b-a)+6*u*t*(c-b)+3*t*t*(d-c);
}
function bezierProgress(x:number,x1:number,y1:number,x2:number,y2:number):number {
  x=clamp01(x); if(x<=0)return 0;if(x>=1)return 1;
  let t=x;
  for(let i=0;i<8;i++){
    const bx=cubic(0,x1,x2,1,t),d=cubicDerivative(0,x1,x2,1,t);
    if(Math.abs(d)<1e-7)break;
    t=clamp01(t-(bx-x)/d);
  }
  let lo=0,hi=1;
  for(let i=0;i<16;i++){
    const bx=cubic(0,x1,x2,1,t);
    if(Math.abs(bx-x)<1e-7)break;
    if(bx<x)lo=t;else hi=t;
    t=(lo+hi)/2;
  }
  return cubic(0,y1,y2,1,t);
}

function easing(kind:MotionInterpolation,t:number,a?:MotionKeyframe<number>,b?:MotionKeyframe<number>):number {
  t=clamp01(t); if(t===0||t===1)return t;
  switch(kind){
    case 'hold': return 0;
    case 'linear': return t;
    case 'bezier': {
      const out=a?.outTangent??{x:.33,y:.33};
      const incoming=b?.inTangent??{x:.67,y:.67};
      return bezierProgress(t,clamp01(out.x),out.y,clamp01(incoming.x),incoming.y);
    }
    case 'auto-bezier': return t*t*(3-2*t);
    case 'continuous-bezier': return bezierProgress(t,.42,0,.58,1);
    case 'ease': return bezierProgress(t,.25,.1,.25,1);
    case 'expo-in': return Math.pow(2,10*(t-1));
    case 'expo-out': return 1-Math.pow(2,-10*t);
    case 'expo-in-out': return t<.5 ? Math.pow(2,20*t-10)/2 : (2-Math.pow(2,-20*t+10))/2;
    case 'spring': {
      const raw=1-Math.exp(-6*t)*Math.cos(12*t);
      const end=1-Math.exp(-6)*Math.cos(12);
      return raw/end;
    }
    case 'damped-overshoot': {
      const raw=1-Math.exp(-5*t)*(Math.cos(9*t)+.35*Math.sin(9*t));
      const end=1-Math.exp(-5)*(Math.cos(9)+.35*Math.sin(9));
      return raw/end;
    }
  }
}

function sorted<T>(property:AnimatedProperty<T>):MotionKeyframe<T>[] {
  return [...(property.keyframes??[])].sort((a,b)=>a.frame-b.frame);
}
function segment<T>(frames:MotionKeyframe<T>[],frame:number):{a:MotionKeyframe<T>;b:MotionKeyframe<T>;t:number}|undefined {
  if(frames.length<2)return undefined;
  for(let i=1;i<frames.length;i++) if(frame<=frames[i].frame){
    const a=frames[i-1],b=frames[i]; const span=b.frame-a.frame;
    return {a,b,t:span<=0?1:(frame-a.frame)/span};
  }
  return undefined;
}

export function evaluateAnimatedNumber(property:AnimatedProperty<number>,frame:number):number {
  const frames=sorted(property);
  if(!frames.length)return property.baseValue;
  if(frame<=frames[0].frame)return frames[0].value;
  const last=frames.at(-1)!; if(frame>=last.frame)return last.value;
  const s=segment(frames,frame)!;
  const progress=easing(s.a.interpolation,s.t,s.a,s.b);
  return lerp(s.a.value,s.b.value,progress);
}

function evaluateVector<T extends readonly number[]>(property:AnimatedProperty<T>,frame:number,framesOverride?:MotionKeyframe<T>[]):number[] {
  const frames=framesOverride??sorted(property);
  if(!frames.length)return [...property.baseValue];
  if(frame<=frames[0].frame)return [...frames[0].value];
  const last=frames.at(-1)!;if(frame>=last.frame)return [...last.value];
  const s=segment(frames,frame)!;
  const dims=s.a.value.length;
  const out:number[]=[];const axes=['x','y','z'] as const;
  for(let i=0;i<dims;i++){
    const axis=axes[i];const ad=s.a.dimensionTangents?.[axis],bd=s.b.dimensionTangents?.[axis];
    const ak={...s.a,value:s.a.value[i],inTangent:ad?.inTangent??s.a.inTangent,outTangent:ad?.outTangent??s.a.outTangent} as MotionKeyframe<number>;
    const bk={...s.b,value:s.b.value[i],inTangent:bd?.inTangent??s.b.inTangent,outTangent:bd?.outTangent??s.b.outTangent} as MotionKeyframe<number>;
    const progress=easing(s.a.interpolation,s.t,ak,bk);
    out.push(lerp(s.a.value[i],s.b.value[i],progress));
  }
  return out;
}
export function evaluateAnimatedVec2(property:AnimatedProperty<Vec2>,frame:number):Vec2 { const v=evaluateVector(property,frame);return [v[0],v[1]]; }
export function resolveRovingVec3Keyframes(input:MotionKeyframe<Vec3>[]):MotionKeyframe<Vec3>[] {
 const keys=[...input].sort((a,b)=>a.frame-b.frame).map(k=>structuredClone(k));if(keys.length<3)return keys;const distance=(a:Vec3,b:Vec3)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 let left=0;while(left<keys.length-1){let right=left+1;while(right<keys.length-1&&keys[right].roving)right++;if(right-left>1){let total=0;const cumulative=[0];for(let i=left+1;i<=right;i++){total+=distance(keys[i-1].value,keys[i].value);cumulative.push(total);}const span=keys[right].frame-keys[left].frame;for(let i=left+1;i<right;i++){const raw=total>EPS?keys[left].frame+span*(cumulative[i-left]/total):keys[left].frame+span*((i-left)/(right-left));const min=keys[i-1].frame+1,max=keys[right].frame-(right-i);keys[i].frame=Math.max(min,Math.min(max,Math.round(raw)));}}left=right;}return keys;
}
export function evaluateAnimatedVec3(property:AnimatedProperty<Vec3>,frame:number):Vec3 { const frames=resolveRovingVec3Keyframes(sorted(property));const v=evaluateVector(property,frame,frames);return [v[0],v[1],v[2]]; }

export function sampleVelocity(property:AnimatedProperty<number>,frame:number):number {
  const frames=sorted(property);
  if(frames.length>=2){
    for(let i=1;i<frames.length;i++) if(frame>=frames[i-1].frame&&frame<=frames[i].frame&&frames[i-1].interpolation==='linear') return (frames[i].value-frames[i-1].value)/(frames[i].frame-frames[i-1].frame);
  }
  const h=.01;
  return (evaluateAnimatedNumber(property,frame+h)-evaluateAnimatedNumber(property,frame-h))/(2*h);
}

export const motionStylePresets:Record<string,MotionStyleDefinition>={
  'ui-native':{id:'ui-native',name:'UI Native',durationFrames:8,curve:{type:'bezier',inTangent:{x:.7,y:1},outTangent:{x:.16,y:1}}},
  mechanical:{id:'mechanical',name:'Mechanical',durationFrames:7,curve:{type:'bezier',inTangent:{x:.8,y:1},outTangent:{x:.2,y:0}}},
  soft:{id:'soft',name:'Soft',durationFrames:16,curve:{type:'ease'}},
  cinematic:{id:'cinematic',name:'Cinematic',durationFrames:24,curve:{type:'bezier',inTangent:{x:.8,y:1},outTangent:{x:.16,y:.1}}},
  snappy:{id:'snappy',name:'Snappy',durationFrames:6,curve:{type:'damped-overshoot'}},
  heavy:{id:'heavy',name:'Heavy',durationFrames:18,curve:{type:'expo-out'}},
};

export function applyMotionStyle(startFrame:number,endFrame:number,from:number,to:number,styleId:string):AnimatedProperty<number> {
  if(!Number.isInteger(startFrame)||!Number.isInteger(endFrame)||endFrame<=startFrame)throw new Error('motion style frame range is invalid');
  const style=motionStylePresets[styleId];if(!style)throw new Error(`Unknown motion style ${styleId}`);
  return {baseValue:from,keyframes:[
    {frame:startFrame,value:from,interpolation:style.curve.type,outTangent:style.curve.outTangent},
    {frame:endFrame,value:to,interpolation:style.curve.type,inTangent:style.curve.inTangent},
  ]};
}

export function sampleCurve(styleId:string,normalizedTime:number):{value:number;velocity:number} {
  const style=motionStylePresets[styleId];if(!style)throw new Error(`Unknown motion style ${styleId}`);
  const p=applyMotionStyle(0,1000,0,1,styleId);
  const frame=clamp01(normalizedTime)*1000;
  const value=evaluateAnimatedNumber(p,frame);
  const velocity=sampleVelocity(p,frame)*1000;
  if(!Number.isFinite(value)||!Number.isFinite(velocity)||Math.abs(value)>1e6)throw new Error('curve produced non-finite result');
  return {value:Math.abs(value)<EPS?0:value,velocity:Math.abs(velocity)<EPS?0:velocity};
}

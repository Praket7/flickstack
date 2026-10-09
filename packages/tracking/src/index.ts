import type { TrackingRecord, Vec2, Vec3 } from '../../schema/src/v3/project.ts';

export interface TrackingCapability { supported:boolean; reason?:string }
const IMPLEMENTED_RECORDS=new Set<TrackingRecord['kind']>(['point','planar','corner-pin','stabilization','mask']);
export function trackingCapability(kind:TrackingRecord['kind']):TrackingCapability{return IMPLEMENTED_RECORDS.has(kind)?{supported:true}:{supported:false,reason:`${kind} tracking is schema-reserved and capability-gated`};}

export type NativeSolverKind='point'|'planar';
export interface SolverEnvironment { opencv:boolean; detail?:string }
export function solverCapability(kind:TrackingRecord['kind'],environment:SolverEnvironment):TrackingCapability{
  if(kind!=='point'&&kind!=='planar')return {supported:false,reason:`${kind} has no native v0.4 solver`};
  if(!environment.opencv)return {supported:false,reason:environment.detail??'native OpenCV tracking backend is unavailable'};
  return {supported:true};
}

export type TrackStatus='tracked'|'redetected'|'occluded'|'lost';
export interface PointTrackFrame {frame:number;point:Vec2;status:TrackStatus;forwardBackwardError:number;confidence:number}
export interface PointTrackResult {kind:'point';algorithm:'opencv-pyr-lk'|string;algorithmVersion:string;seed:Vec2;frames:PointTrackFrame[]}
export interface PlanarTrackFrame {frame:number;quad:[Vec2,Vec2,Vec2,Vec2];homography:[number,number,number,number,number,number,number,number,number];status:TrackStatus;reprojectionError:number;inlierRatio:number;confidence:number}
export interface PlanarTrackResult {kind:'planar';algorithm:'opencv-orb-ransac'|string;algorithmVersion:string;referenceQuad:[Vec2,Vec2,Vec2,Vec2];frames:PlanarTrackFrame[]}
export interface PointTrackOptions {windowSize?:number;pyramidLevels?:number;redetectEvery?:number;maxForwardBackwardError?:number;minConfidence?:number}
export interface PlanarTrackOptions {maxFeatures?:number;ratioTest?:number;ransacThreshold?:number;minInlierRatio?:number;minConfidence?:number}
export interface TrackRange {start:number;end:number}

function finiteConfidence(value:number):number{return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;}
export function trackingRecordFromPointResult(id:string,result:PointTrackResult):TrackingRecord{
  return {id,algorithm:result.algorithm,algorithmVersion:result.algorithmVersion,kind:'point',supported:true,confidence:result.frames.length?result.frames.reduce((s,f)=>s+finiteConfidence(f.confidence),0)/result.frames.length:0,keyframes:result.frames.map(f=>({frame:f.frame,value:[f.point[0],f.point[1]],confidence:finiteConfidence(f.confidence)})),diagnostics:result.frames.map(f=>`frame ${f.frame}: ${f.status}; forward/backward error ${f.forwardBackwardError.toFixed(3)}; confidence ${finiteConfidence(f.confidence).toFixed(3)}`)};
}
export function trackingRecordFromPlanarResult(id:string,result:PlanarTrackResult):TrackingRecord{
  return {id,algorithm:result.algorithm,algorithmVersion:result.algorithmVersion,kind:'planar',supported:true,confidence:result.frames.length?result.frames.reduce((s,f)=>s+finiteConfidence(f.confidence),0)/result.frames.length:0,keyframes:result.frames.map(f=>({frame:f.frame,value:{quad:structuredClone(f.quad),homography:[...f.homography],reprojectionError:f.reprojectionError,inlierRatio:f.inlierRatio},confidence:finiteConfidence(f.confidence)})),diagnostics:result.frames.map(f=>`frame ${f.frame}: ${f.status}; reprojection error ${f.reprojectionError.toFixed(3)}; inlier ratio ${f.inlierRatio.toFixed(3)}; confidence ${finiteConfidence(f.confidence).toFixed(3)}`)};
}
function quadCenter(quad:[Vec2,Vec2,Vec2,Vec2]):Vec2{return [(quad[0][0]+quad[1][0]+quad[2][0]+quad[3][0])/4,(quad[0][1]+quad[1][1]+quad[2][1]+quad[3][1])/4];}
function topEdge(quad:[Vec2,Vec2,Vec2,Vec2]){const dx=quad[1][0]-quad[0][0],dy=quad[1][1]-quad[0][1];return {length:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)*180/Math.PI};}
export function deriveStabilizationTrack(id:string,result:PlanarTrackResult):TrackingRecord{
  const refCenter=quadCenter(result.referenceQuad),refEdge=topEdge(result.referenceQuad);
  return {id,algorithm:`${result.algorithm}-inverse`,algorithmVersion:result.algorithmVersion,kind:'stabilization',supported:true,confidence:result.frames.length?result.frames.reduce((s,f)=>s+finiteConfidence(f.confidence),0)/result.frames.length:0,keyframes:result.frames.map(frame=>{const c=quadCenter(frame.quad),edge=topEdge(frame.quad);return {frame:frame.frame,value:{x:refCenter[0]-c[0],y:refCenter[1]-c[1],rotation:refEdge.angle-edge.angle,scale:edge.length>1e-9?refEdge.length/edge.length:1},confidence:finiteConfidence(frame.confidence)};}),diagnostics:result.frames.map(f=>`frame ${f.frame}: stabilization confidence ${finiteConfidence(f.confidence).toFixed(3)}`)};
}

function interpolate(a:unknown,b:unknown,t:number):unknown {
  if(typeof a==='number'&&typeof b==='number')return a+(b-a)*t;
  if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return a.map((v,i)=>interpolate(v,b[i],t));
  if(typeof a==='object'&&a!==null&&!Array.isArray(a)&&typeof b==='object'&&b!==null&&!Array.isArray(b)){
    const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>,keys=Object.keys(aa);if(keys.length===Object.keys(bb).length&&keys.every(k=>k in bb)){const out:Record<string,unknown>={};for(const k of keys)out[k]=interpolate(aa[k],bb[k],t);return out;}
  }
  return t<1?a:b;
}
export function sampleTrackingRecord(record:TrackingRecord,frame:number):unknown {
  if(!record.supported||!trackingCapability(record.kind).supported)throw new Error(`unsupported tracking record kind ${record.kind}`);
  const keys=[...record.keyframes].sort((a,b)=>a.frame-b.frame);if(!keys.length)throw new Error(`tracking record ${record.id} has no keyframes`);
  if(frame<=keys[0].frame)return structuredClone(keys[0].value);const last=keys.at(-1)!;if(frame>=last.frame)return structuredClone(last.value);
  for(let i=1;i<keys.length;i++)if(frame<=keys[i].frame){const a=keys[i-1],b=keys[i],t=(frame-a.frame)/(b.frame-a.frame);return interpolate(a.value,b.value,t);}
  return structuredClone(last.value);
}
export function attachPointTrack(base:Vec3,record:TrackingRecord,frame:number,weight=1):Vec3 {
  if(record.kind!=='point')throw new Error('point attachment requires point tracking record');const p=sampleTrackingRecord(record,frame);if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite))throw new Error('point track sample is invalid');return[base[0]+Number(p[0])*weight,base[1]+Number(p[1])*weight,base[2]];
}

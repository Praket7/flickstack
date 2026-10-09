import React,{useMemo,useState} from 'react';
import {solverCapability,type NativeSolverKind,type SolverEnvironment,type PointTrackResult,type PlanarTrackResult} from '../../../../packages/tracking/src/index.ts';
import type {Vec2} from '../../../../packages/schema/src/v3/project.ts';

export interface TrackingRegion {kind:'point'|'planar';point?:Vec2;quad?:[Vec2,Vec2,Vec2,Vec2]}
export interface TrackingPanelState {environment:SolverEnvironment;region?:TrackingRegion;solving?:boolean;progress?:number;result?:PointTrackResult|PlanarTrackResult;message?:string}
export interface TrackingPanelProps {state:TrackingPanelState;onRegionChange?:(region:TrackingRegion)=>void;onSolve?:(kind:NativeSolverKind,region:TrackingRegion)=>void;onCorrect?:(frame:number,value:Vec2|[Vec2,Vec2,Vec2,Vec2])=>void;onApply?:()=>void;onBake?:()=>void}

export function TrackingPanel({state,onRegionChange,onSolve,onCorrect,onApply,onBake}:TrackingPanelProps){
 const[kind,setKind]=useState<NativeSolverKind>(state.region?.kind??'point');const cap=solverCapability(kind,state.environment);const result=state.result;
 const avg=useMemo(()=>{if(!result?.frames.length)return 0;return result.frames.reduce((s,f)=>s+f.confidence,0)/result.frames.length;},[result]);
 const worst=useMemo(()=>result?.frames.reduce((a,b)=>a.confidence<=b.confidence?a:b,result.frames[0]),[result]);
 const region=state.region??(kind==='point'?{kind:'point' as const,point:[960,540] as Vec2}:{kind:'planar' as const,quad:[[640,360],[1280,360],[1280,720],[640,720]] as [Vec2,Vec2,Vec2,Vec2]});
 const select=(next:NativeSolverKind)=>{setKind(next);onRegionChange?.(next==='point'?{kind:'point',point:[960,540]}:{kind:'planar',quad:[[640,360],[1280,360],[1280,720],[640,720]]});};
 return <section className="fs-section fs-tracking-panel" aria-label="Tracking">
  <div className="fs-panel-title"><h3>Tracking</h3><span className="fs-muted">Point and planar match move</span></div>
  <div className="fs-segmented"><button data-active={kind==='point'} onClick={()=>select('point')}>Point track</button><button data-active={kind==='planar'} onClick={()=>select('planar')}>Planar track</button></div>
  <div className="fs-row"><span>Region</span><span className="fs-muted">{region.kind==='point'?`${Math.round(region.point?.[0]??0)}, ${Math.round(region.point?.[1]??0)}`:'4-corner plane'}</span></div>
  {!cap.supported?<div className="fs-callout warning">Native OpenCV solver unavailable. {cap.reason}</div>:<button className="fs-primary" disabled={state.solving} onClick={()=>onSolve?.(kind,region)}>{state.solving?'Solving…':'Solve'}</button>}
  {state.solving&&<label className="fs-progress"><span>Solve progress</span><progress value={state.progress??0} max={1}/></label>}
  {result&&<><div className="fs-metric-grid"><div><strong>{Math.round(avg*100)}%</strong><span>Confidence</span></div><div><strong>{result.frames.length}</strong><span>Frames</span></div></div>
   <div className="fs-row"><span>Forward/backward + RANSAC diagnostics</span><span className="fs-muted">{worst?`worst f${worst.frame} ${Math.round(worst.confidence*100)}%`:'—'}</span></div>
   <div className="fs-confidence-strip" aria-label="Confidence graph">{result.frames.map(f=><i key={f.frame} title={`f${f.frame} ${Math.round(f.confidence*100)}%`} style={{height:`${Math.max(4,f.confidence*42)}px`}}/>)}</div>
   {worst&&<button onClick={()=>{const value=result.kind==='point'?(worst as any).point:(worst as any).quad;onCorrect?.(worst.frame,value);}}>Manual correction</button>}
   <div className="fs-button-row"><button onClick={onApply}>Apply</button><button onClick={onBake}>Bake</button></div></>}
  {state.message&&<p className="fs-muted">{state.message}</p>}
 </section>;
}

import React,{useMemo,useReducer,useState} from 'react';import type {AnimatedProperty,MotionCompositingGraph,MotionKeyframe,Vec3} from '../../../packages/schema/src/v3/project.ts';import type {CurveViewport} from './math/curves.ts';import type {NodePreview} from './panels/NodeGraph.tsx';
import {createStudioState,studioReducer} from './view-model.ts';
import {selectLayerIds} from './authoring-model.ts';
import {EditWorkspace} from './workspaces/EditWorkspace.tsx';
import {MotionWorkspace} from './workspaces/MotionWorkspace.tsx';
import {GraphWorkspace} from './workspaces/GraphWorkspace.tsx';
import {AudioWorkspace} from './workspaces/AudioWorkspace.tsx';
import {DirectorWorkspace} from './workspaces/DirectorWorkspace.tsx';
import type {MotionQCIssue} from '../../../packages/design-qc/src/motion-analysis.ts';
import type {ViewerProps} from './panels/Viewer.tsx';
import {LayerTree} from './panels/LayerTree.tsx';
import {Timeline} from './panels/Timeline.tsx';
import {DopeSheet,type DopeKey} from './panels/DopeSheet.tsx';
import {PropertyInspector,type InspectorProperty} from './panels/PropertyInspector.tsx';
import type {TrackingPanelProps} from './panels/TrackingPanel.tsx';

export interface StudioLayerSummary{
 id:string;name:string;kind:string;start?:number;duration?:number;locked?:boolean;enabled?:boolean;zIndex?:number;parentId?:string;
}
export interface StudioProjectModel{
 name:string;revision:string;layers:StudioLayerSummary[];duration?:number;frame?:number;beats?:number[];
 markers:Array<{id:string;frame:number;label?:string}>;motionQCIssues?:MotionQCIssue[];qcIssues:Array<{id:string;frame:number;message:string}>;receipts:Array<{id:string;intent:string}>;
 keyframes?:DopeKey[];properties?:InspectorProperty[];tracking?:TrackingPanelProps['state'];curveProperty?:AnimatedProperty<number>;curveViewport?:CurveViewport;motionPath?:MotionKeyframe<Vec3>[];compositingGraph?:MotionCompositingGraph;renderNodePreview?:(nodeId:string)=>NodePreview|undefined;viewer?:Omit<ViewerProps,'onTransformTransient'|'onTransformCommit'|'onMaskTransient'|'onMaskCommit'|'onCameraCommit'>;
}
export interface StudioEditCallbacks{
 onRenameLayer?:(id:string,name:string)=>void;onToggleLayerLock?:(id:string,locked:boolean)=>void;onReparentLayer?:(id:string,parentId?:string)=>void;
 onLayerTiming?:(id:string,start:number,duration:number)=>void;onSeek?:(frame:number)=>void;onMoveKeyframes?:(frames:Set<number>,delta:number)=>void;
 onCopyKeyframes?:()=>void;onPasteKeyframes?:(at:number)=>void;onPropertyChange?:(id:string,value:string|number|boolean)=>void;
 onToggleKeyframe?:(id:string)=>void;onEditExpression?:(id:string)=>void;onAddBehavior?:(id:string)=>void;onCurveKeyframeChange?:(frame:number,key:MotionKeyframe<number>)=>void;onCurveInterpolationChange?:(frame:number,kind:MotionKeyframe<number>['interpolation'])=>void;onRoveChange?:(frame:number,roving:boolean)=>void;onGraphChange?:(graph:MotionCompositingGraph)=>void;onTransformTransient?:ViewerProps['onTransformTransient'];onTransformCommit?:ViewerProps['onTransformCommit'];onMaskTransient?:ViewerProps['onMaskTransient'];onMaskCommit?:ViewerProps['onMaskCommit'];onCameraCommit?:ViewerProps['onCameraCommit'];onTrackingRegionChange?:TrackingPanelProps['onRegionChange'];onTrackingSolve?:TrackingPanelProps['onSolve'];onTrackingCorrect?:TrackingPanelProps['onCorrect'];onTrackingApply?:TrackingPanelProps['onApply'];onTrackingBake?:TrackingPanelProps['onBake'];onDirectorJump?:(frame:number,layerId?:string)=>void;onRender?:()=>void;
}
const workspaces={edit:EditWorkspace,motion:MotionWorkspace,graph:GraphWorkspace,audio:AudioWorkspace,director:DirectorWorkspace} as const;
export function FlickSmithStudio({model,edits={}}:{model:StudioProjectModel;edits?:StudioEditCallbacks}){
 const[s,dispatch]=useReducer(studioReducer,undefined,createStudioState);const Workspace=workspaces[s.workspace];
 const[selected,setSelected]=useState<Set<string>>(()=>new Set());const[selectedKeys,setSelectedKeys]=useState<Set<number>>(()=>new Set());const[zoom,setZoom]=useState(1);
 const duration=model.duration??Math.max(300,...model.layers.map(l=>(l.start??0)+(l.duration??0)),...model.markers.map(m=>m.frame+1));const frame=Math.max(0,Math.min(duration-1,model.frame??0));
 const keyframes=model.keyframes??[];const properties=model.properties??[];
 const selectedName=useMemo(()=>model.layers.find(l=>selected.has(l.id))?.name,[model.layers,selected]);
 const onSelect=(id:string,additive:boolean)=>{const next=selectLayerIds(selected,id,additive);setSelected(next);dispatch({type:'select_project_item',id:next.size===1?[...next][0]:undefined});};
 return <div className="fs-shell">
  <header className="fs-topbar"><span className="fs-brand">FlickSmith</span><span className="fs-pill">v0.4 motion</span><span className="fs-muted">{model.name} · {model.revision}</span><span style={{marginLeft:'auto'}} className="fs-muted">{model.qcIssues.length} QC issues</span><button onClick={edits.onRender}>Render</button></header>
  <nav className="fs-workspaces">{(Object.keys(workspaces) as Array<keyof typeof workspaces>).map(w=><button key={w} data-active={s.workspace===w} onClick={()=>dispatch({type:'workspace',workspace:w})}>{w}</button>)}</nav>
  <div className="fs-main">
   <aside className="fs-panel"><LayerTree layers={model.layers} selected={selected} onSelect={onSelect} onRename={edits.onRenameLayer} onToggleLock={edits.onToggleLayerLock} onReparent={edits.onReparentLayer}/></aside>
   <main className="fs-stage"><section className="fs-viewer"><div className="fs-surface">{s.workspace==='graph'?<GraphWorkspace label={`${model.layers.length} editable layers${selectedName?` · ${selectedName}`:''}`} curveProperty={model.curveProperty} viewport={model.curveViewport} motionPath={model.motionPath} compositingGraph={model.compositingGraph} renderNodePreview={model.renderNodePreview} onGraphChange={edits.onGraphChange} onCurveChange={edits.onCurveKeyframeChange} onInterpolationChange={edits.onCurveInterpolationChange} onRoveChange={edits.onRoveChange}/>:s.workspace==='motion'?<MotionWorkspace label={`${model.layers.length} editable layers${selectedName?` · ${selectedName}`:''}`} {...(model.viewer??{})} onTransformTransient={edits.onTransformTransient} onTransformCommit={edits.onTransformCommit} onMaskTransient={edits.onMaskTransient} onMaskCommit={edits.onMaskCommit} onCameraCommit={edits.onCameraCommit} tracking={model.tracking} onTrackingRegionChange={edits.onTrackingRegionChange} onTrackingSolve={edits.onTrackingSolve} onTrackingCorrect={edits.onTrackingCorrect} onTrackingApply={edits.onTrackingApply} onTrackingBake={edits.onTrackingBake}/>:s.workspace==='director'?<DirectorWorkspace label={`${model.layers.length} editable layers${selectedName?` · ${selectedName}`:''}`} motionQCIssues={model.motionQCIssues} onJump={edits.onDirectorJump}/>:<Workspace label={`${model.layers.length} editable layers${selectedName?` · ${selectedName}`:''}`}/>}</div></section><section className="fs-timeline"><Timeline layers={model.layers} frame={frame} duration={duration} markers={model.markers} beats={model.beats} zoom={zoom} selected={selected} onSeek={edits.onSeek??(()=>{})} onTiming={edits.onLayerTiming} onZoom={setZoom}/><DopeSheet keys={keyframes} duration={duration} selected={selectedKeys} onSelectionChange={setSelectedKeys} onMove={edits.onMoveKeyframes} onCopy={edits.onCopyKeyframes} onPaste={edits.onPasteKeyframes} playhead={frame}/></section></main>
   <aside className="fs-panel right"><PropertyInspector properties={properties} onChange={edits.onPropertyChange} onToggleKeyframe={edits.onToggleKeyframe} onEditExpression={edits.onEditExpression} onAddBehavior={edits.onAddBehavior}/><section className="fs-section"><h3>QC</h3>{model.qcIssues.map(i=><button className="fs-row" key={i.id} onClick={()=>dispatch({type:'qc_focus',issueId:i.id})}>f{i.frame} · {i.message}</button>)}</section></aside>
  </div>
 </div>;
}

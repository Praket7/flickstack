import type { MotionBlurSettings, MotionCompositingGraph, Rect, SharedTransition, Vec3 } from '../../schema/src/v3/project.ts';

export interface CompositingDiagnostic { code:string; severity:'warning'|'error'; message:string; nodeId?:string }
export interface SharedElementState { bounds:Rect; opacity:number; cornerRadius:number; position:Vec3; scale:Vec3; rotation:Vec3 }
export interface CameraState { position:Vec3; rotation:Vec3; focalLength:number; sensorHeight?:number; nearClip?:number; farClip?:number }

export function validateCompositingGraph(graph:MotionCompositingGraph):CompositingDiagnostic[] {
  const out:CompositingDiagnostic[]=[];
  if(graph.nodes.length>2048)out.push({code:'graph_too_large',severity:'error',message:'Compositing graph exceeds 2048 nodes'});
  const by=new Map<string,(typeof graph.nodes)[number]>();
  for(const n of graph.nodes){if(by.has(n.id))out.push({code:'duplicate_node',severity:'error',message:`Duplicate node ${n.id}`,nodeId:n.id});else by.set(n.id,n);}
  if(!by.has(graph.outputNodeId))out.push({code:'missing_output',severity:'error',message:`Missing output node ${graph.outputNodeId}`});
  for(const n of graph.nodes)for(const input of n.inputs)if(!by.has(input))out.push({code:'missing_input',severity:'error',message:`Node ${n.id} references missing input ${input}`,nodeId:n.id});
  const visiting=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{if(done.has(id)||!by.has(id))return;if(visiting.has(id)){out.push({code:'cycle',severity:'error',message:`Compositing cycle involving ${id}`,nodeId:id});return;}visiting.add(id);for(const input of by.get(id)!.inputs)visit(input);visiting.delete(id);done.add(id);};
  for(const n of graph.nodes)visit(n.id);
  return out;
}

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(t:number)=>t*t*(3-2*t);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const vecLerp=(a:Vec3,b:Vec3,t:number):Vec3=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
export function transitionProgress(transition:SharedTransition,frame:number):number {
  if(transition.duration<=0)return frame<transition.start?0:1;return clamp01((frame-transition.start)/transition.duration);
}
export function interpolateSharedElement(source:SharedElementState,destination:SharedElementState,transition:SharedTransition,frame:number):{progress:number;state:SharedElementState} {
  const raw=transitionProgress(transition,frame);if(raw<=0)return{progress:0,state:structuredClone(source)};if(raw>=1)return{progress:1,state:structuredClone(destination)};
  const t=transition.kind==='hard-cut'?(raw<1?0:1):smooth(raw);
  return{progress:raw,state:{
    bounds:{x:lerp(source.bounds.x,destination.bounds.x,t),y:lerp(source.bounds.y,destination.bounds.y,t),width:lerp(source.bounds.width,destination.bounds.width,t),height:lerp(source.bounds.height,destination.bounds.height,t)},
    opacity:lerp(source.opacity,destination.opacity,t),cornerRadius:lerp(source.cornerRadius,destination.cornerRadius,t),position:vecLerp(source.position,destination.position,t),scale:vecLerp(source.scale,destination.scale,t),rotation:vecLerp(source.rotation,destination.rotation,t),
  }};
}

function rotateX(v:Vec3,degrees:number):Vec3{const r=degrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c];}
function rotateY(v:Vec3,degrees:number):Vec3{const r=degrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c];}
function rotateZ(v:Vec3,degrees:number):Vec3{const r=degrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]];}
export function projectPoint(point:Vec3,camera:CameraState,surface:{width:number;height:number}):Vec3 {
  let v:Vec3=[point[0]-camera.position[0],point[1]-camera.position[1],point[2]-camera.position[2]];
  v=rotateZ(v,-camera.rotation[2]);v=rotateY(v,-camera.rotation[1]);v=rotateX(v,-camera.rotation[0]);
  const depth=-v[2],near=camera.nearClip??.01,far=camera.farClip??1e9;if(!(depth>near&&depth<far))throw new Error('point is outside camera clipping range');
  const focalPixels=camera.focalLength*surface.height/(camera.sensorHeight??24);
  return[surface.width/2+v[0]*focalPixels/depth,surface.height/2-v[1]*focalPixels/depth,depth];
}
export function motionBlurSampleFrames(frame:number,settings:MotionBlurSettings):number[] {
  if(!settings.enabled||settings.samples<=1||settings.shutterAngle<=0)return[frame];
  const samples=Math.max(1,Math.min(64,Math.floor(settings.samples))),span=Math.max(0,Math.min(720,settings.shutterAngle))/360,center=frame+settings.shutterPhase/360,start=center-span/2;
  return Array.from({length:samples},(_,i)=>samples===1?center:start+span*i/(samples-1));
}

export type CoverageShape=
  | {kind:'rect';x:number;y:number;width:number;height:number;radius?:number}
  | {kind:'ellipse';cx:number;cy:number;rx:number;ry:number};
function sdRect(shape:Extract<CoverageShape,{kind:'rect'}>,p:readonly[number,number]):number{const cx=shape.x+shape.width/2,cy=shape.y+shape.height/2;const qx=Math.abs(p[0]-cx)-Math.max(0,shape.width/2+(0));const qy=Math.abs(p[1]-cy)-Math.max(0,shape.height/2+(0));return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);}
function sdEllipse(shape:Extract<CoverageShape,{kind:'ellipse'}>,p:readonly[number,number]):number{const dx=(p[0]-shape.cx)/Math.max(1e-9,shape.rx),dy=(p[1]-shape.cy)/Math.max(1e-9,shape.ry);return(Math.hypot(dx,dy)-1)*Math.min(shape.rx,shape.ry);}
export function maskCoverage(shape:CoverageShape,point:readonly[number,number],feather:number,expansion:number,invert:boolean):number{
  const d=(shape.kind==='rect'?sdRect(shape,point):sdEllipse(shape,point))-expansion;let coverage:number;if(feather<=0)coverage=d<=0?1:0;else{const t=Math.max(0,Math.min(1,.5-d/Math.max(1e-9,feather)));coverage=t*t*(3-2*t);}return invert?1-coverage:coverage;
}
export function applyMatte(sourceAlpha:number,matte:number,mode:'alpha'|'alpha-inverted'|'luma'|'luma-inverted'):number{const m=Math.max(0,Math.min(1,matte));const factor=mode==='alpha-inverted'||mode==='luma-inverted'?1-m:m;return Math.max(0,Math.min(1,sourceAlpha))*factor;}

export type CompositingPortType='image'|'mask';
const outputType=(kind:import('../../schema/src/v3/project.ts').CompositingNodeKind):CompositingPortType=>kind==='mask'?'mask':'image';
const inputType=(kind:import('../../schema/src/v3/project.ts').CompositingNodeKind,index:number):CompositingPortType|undefined=>{
  if(kind==='source'||kind==='layer'||kind==='mask')return undefined;
  if(kind==='matte')return index===0?'image':index===1?'mask':undefined;
  if(kind==='blend'||kind==='composite')return index<2?'image':undefined;
  return index===0?'image':undefined;
};
function cloneGraph(graph:MotionCompositingGraph):MotionCompositingGraph{return structuredClone(graph)}
function graphNode(graph:MotionCompositingGraph,id:string){const n=graph.nodes.find(n=>n.id===id);if(!n)throw new Error(`Unknown compositing node ${id}`);return n}
function assertGraphValid(graph:MotionCompositingGraph){const errors=validateCompositingGraph(graph).filter(d=>d.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.message).join('; '));}
export function addCompositingNode(graph:MotionCompositingGraph,node:MotionCompositingGraph['nodes'][number]):MotionCompositingGraph{const g=cloneGraph(graph);if(g.nodes.some(n=>n.id===node.id))throw new Error(`Duplicate node ${node.id}`);g.nodes.push(structuredClone(node));assertGraphValid(g);return g}
export function connectCompositingNodes(graph:MotionCompositingGraph,fromId:string,toId:string,inputIndex?:number):MotionCompositingGraph{const g=cloneGraph(graph),from=graphNode(g,fromId),to=graphNode(g,toId);if(from.id===to.id)throw new Error('Compositing cycle');if(to.kind==='source'||to.kind==='layer'||to.kind==='mask')throw new Error(`Node ${to.id} has no compatible input port`);const index=inputIndex??to.inputs.length,expected=inputType(to.kind,index);if(!expected)throw new Error(`No input port ${index} on ${to.kind}`);const actual=outputType(from.kind);if(actual!==expected)throw new Error(`Incompatible port type: ${actual} -> ${expected}`);if(index>to.inputs.length)throw new Error('Cannot leave sparse compositing inputs');if(index===to.inputs.length)to.inputs.push(fromId);else to.inputs[index]=fromId;const errors=validateCompositingGraph(g).filter(d=>d.code==='cycle');if(errors.length)throw new Error(`Compositing cycle involving ${errors[0].nodeId??toId}`);return g}
export function disconnectCompositingNodes(graph:MotionCompositingGraph,fromId:string,toId:string):MotionCompositingGraph{const g=cloneGraph(graph),to=graphNode(g,toId);to.inputs=to.inputs.filter(id=>id!==fromId);return g}
export function deleteCompositingNode(graph:MotionCompositingGraph,nodeId:string):MotionCompositingGraph{if(nodeId===graph.outputNodeId)throw new Error('Cannot delete output node');const g=cloneGraph(graph);graphNode(g,nodeId);g.nodes=g.nodes.filter(n=>n.id!==nodeId);for(const n of g.nodes)n.inputs=n.inputs.filter(i=>i!==nodeId);if(g.groups)for(const group of g.groups)group.nodeIds=group.nodeIds.filter(id=>id!==nodeId);return g}
export function duplicateCompositingNode(graph:MotionCompositingGraph,nodeId:string,newId:string):MotionCompositingGraph{const source=graphNode(graph,nodeId);return addCompositingNode(graph,{...structuredClone(source),id:newId,inputs:[]})}
export function groupCompositingNodes(graph:MotionCompositingGraph,nodeIds:string[],groupId:string,name:string):MotionCompositingGraph{const g=cloneGraph(graph),unique=[...new Set(nodeIds)];if(!unique.length)throw new Error('Group must contain nodes');for(const id of unique)graphNode(g,id);g.groups??=[];if(g.groups.some(x=>x.id===groupId))throw new Error(`Duplicate compositing group ${groupId}`);g.groups.push({id:groupId,name,nodeIds:unique});return g}
export function ungroupCompositingNodes(graph:MotionCompositingGraph,groupId:string):MotionCompositingGraph{const g=cloneGraph(graph);g.groups=(g.groups??[]).filter(x=>x.id!==groupId);return g}

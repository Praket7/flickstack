import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCompositingGraph,
  interpolateSharedElement,
  projectPoint,
  motionBlurSampleFrames,
  maskCoverage,
  applyMatte,
  type SharedElementState,
} from '../src/index.ts';
import type { MotionCompositingGraph, MotionBlurSettings, SharedTransition } from '../../schema/src/v3/project.ts';

test('compositing graph validates DAG/output and rejects cycles',()=>{
  const good:MotionCompositingGraph={nodes:[{id:'a',kind:'layer',inputs:[],params:{}},{id:'blur',kind:'blur',inputs:['a'],params:{radius:8}},{id:'out',kind:'output',inputs:['blur'],params:{}}],outputNodeId:'out'};
  assert.deepEqual(validateCompositingGraph(good),[]);
  const cyclic:MotionCompositingGraph={nodes:[{id:'a',kind:'blend',inputs:['b'],params:{}},{id:'b',kind:'blend',inputs:['a'],params:{}}],outputNodeId:'a'};
  assert.ok(validateCompositingGraph(cyclic).some(d=>d.code==='cycle'));
});

test('shared-element transition is endpoint-exact and continuous without a one-frame jump',()=>{
  const transition:SharedTransition={id:'t',kind:'shared-element',start:10,duration:10,bindings:[]};
  const a:SharedElementState={bounds:{x:0,y:0,width:100,height:50},opacity:1,cornerRadius:8,position:[0,0,0],scale:[1,1,1],rotation:[0,0,0]};
  const b:SharedElementState={bounds:{x:400,y:200,width:500,height:300},opacity:.7,cornerRadius:30,position:[400,200,0],scale:[2,2,1],rotation:[0,0,15]};
  assert.deepEqual(interpolateSharedElement(a,b,transition,10).state,a);
  assert.deepEqual(interpolateSharedElement(a,b,transition,20).state,b);
  const f18=interpolateSharedElement(a,b,transition,18).state.bounds.x;
  const f19=interpolateSharedElement(a,b,transition,19).state.bounds.x;
  assert.ok(f19>=f18&&f19-f18<100);
});

test('camera projection gives centered origin and deterministic perspective',()=>{
  const camera={position:[0,0,1000] as const,rotation:[0,0,0] as const,focalLength:50,sensorHeight:24};
  assert.deepEqual(projectPoint([0,0,0],camera,{width:1920,height:1080}).slice(0,2),[960,540]);
  const p=projectPoint([100,0,0],camera,{width:1920,height:1080});
  assert.ok(p[0]>960);assert.ok(p[2]>0);
  assert.deepEqual(p,projectPoint([100,0,0],camera,{width:1920,height:1080}));
});

test('motion blur produces a deterministic shutter sample schedule around the frame',()=>{
  const s:MotionBlurSettings={enabled:true,shutterAngle:180,shutterPhase:0,samples:5,quality:'final'};
  const frames=motionBlurSampleFrames(20,s);
  assert.equal(frames.length,5);
  assert.ok(Math.abs((frames[0]+frames.at(-1)!)/2-20)<1e-9);
  assert.deepEqual(frames,motionBlurSampleFrames(20,s));
  assert.deepEqual(motionBlurSampleFrames(20,{...s,enabled:false}),[20]);
});

test('vector mask coverage supports feather expansion inversion and matte modes',()=>{
  assert.equal(maskCoverage({kind:'rect',x:0,y:0,width:100,height:100},[50,50],0,0,false),1);
  assert.equal(maskCoverage({kind:'rect',x:0,y:0,width:100,height:100},[150,50],0,0,false),0);
  assert.equal(maskCoverage({kind:'rect',x:0,y:0,width:100,height:100},[50,50],0,0,true),0);
  assert.equal(applyMatte(.8,.5,'alpha'),.4);
  assert.equal(applyMatte(.8,.5,'alpha-inverted'),.4);
});

test('compositing graph mutations add connect disconnect duplicate group and delete deterministically',async()=>{
 const {addCompositingNode,connectCompositingNodes,disconnectCompositingNodes,duplicateCompositingNode,groupCompositingNodes,deleteCompositingNode}=await import('../src/index.ts');
 let g:any={nodes:[{id:'src',kind:'source',inputs:[],params:{}},{id:'out',kind:'output',inputs:['src'],params:{}}],outputNodeId:'out',groups:[]};
 g=addCompositingNode(g,{id:'blur',kind:'blur',inputs:[],params:{radius:10}});g=disconnectCompositingNodes(g,'src','out');g=connectCompositingNodes(g,'src','blur');g=connectCompositingNodes(g,'blur','out');assert.deepEqual(g.nodes.find((n:any)=>n.id==='out').inputs,['blur']);
 g=duplicateCompositingNode(g,'blur','blur-copy');assert.equal(g.nodes.find((n:any)=>n.id==='blur-copy').kind,'blur');assert.deepEqual(g.nodes.find((n:any)=>n.id==='blur-copy').inputs,[]);
 g=groupCompositingNodes(g,['blur','blur-copy'],'fx','Effects');assert.deepEqual(g.groups,[{id:'fx',name:'Effects',nodeIds:['blur','blur-copy']}]);g=deleteCompositingNode(g,'blur-copy');assert.equal(g.nodes.some((n:any)=>n.id==='blur-copy'),false);assert.deepEqual(g.groups[0].nodeIds,['blur']);
});

test('compositing connections reject cycles and incompatible mask image ports',async()=>{
 const {connectCompositingNodes}=await import('../src/index.ts');
 const cycle:any={nodes:[{id:'a',kind:'transform',inputs:[],params:{}},{id:'b',kind:'blur',inputs:['a'],params:{}},{id:'out',kind:'output',inputs:['b'],params:{}}],outputNodeId:'out'};assert.throws(()=>connectCompositingNodes(cycle,'b','a'),/cycle/i);
 const types:any={nodes:[{id:'mask',kind:'mask',inputs:[],params:{}},{id:'blur',kind:'blur',inputs:[],params:{}},{id:'out',kind:'output',inputs:['blur'],params:{}}],outputNodeId:'out'};assert.throws(()=>connectCompositingNodes(types,'mask','blur'),/port|type|incompatible/i);
});

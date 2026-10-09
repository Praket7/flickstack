import test from 'node:test';
import assert from 'node:assert/strict';
import { applyV3Operation, V3ProjectSession, projectRevisionV3 } from './v3.ts';
import { migrateV2ToV3, migrateV1ToV2, animated, defaultMotionTransform, type FlickProject } from '../../schema/src/index.ts';

function project(){
  const v1:FlickProject={version:1,id:'p',name:'P',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
  return migrateV2ToV3(migrateV1ToV2(v1));
}
const layer:any={id:'title',kind:'text',name:'Title',start:0,duration:60,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,text:'Hello',textStyle:{fontSize:animated(48)}};
const cameraLayer:any={id:'camera',kind:'camera',name:'Camera',start:0,duration:60,enabled:true,locked:false,zIndex:10,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,camera:{focalLength:animated(50)}};

test('v3 operations are serializable/replayable and create receipts/checkpoints with affected ranges',()=>{
  let p=project();
  const ops:any[]=[
    {type:'create_motion_composition',composition:{id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',layers:[]}},
    {type:'add_motion_layer',compositionId:'mc',layer},
    {type:'add_motion_layer',compositionId:'mc',layer:cameraLayer},
    {type:'set_motion_property',compositionId:'mc',layerId:'title',path:'opacity',value:.8},
    {type:'set_motion_keyframes',compositionId:'mc',layerId:'title',path:'transform.position',keyframes:[{frame:0,value:[0,0,0],interpolation:'linear'},{frame:20,value:[100,0,0],interpolation:'ease'}]},
    {type:'set_motion_expression',compositionId:'mc',layerId:'title',path:'opacity',expression:{source:'value * .9',mode:'replace'}},
    {type:'add_motion_behavior',compositionId:'mc',layerId:'title',path:'opacity',behavior:{id:'fade',type:'fade',enabled:true,params:{from:0,to:1}}},
    {type:'reorder_motion_behaviors',compositionId:'mc',layerId:'title',path:'opacity',behaviorIds:['fade']},
    {type:'set_text_style',compositionId:'mc',layerId:'title',style:{horizontalAlign:'center'}},
    {type:'set_text_selector',compositionId:'mc',layerId:'title',selector:{id:'words',type:'words',start:0,end:1}},
    {type:'set_layout_constraints',compositionId:'mc',layerId:'title',constraints:[{id:'cx',type:'center-x'}]},
    {type:'add_mask',compositionId:'mc',layerId:'title',mask:{id:'mask',kind:'rect',geometry:{kind:'rect',width:100,height:50},feather:animated(0),expansion:animated(0),invert:false,combine:'add'}},
    {type:'set_camera',compositionId:'mc',layerId:'camera',camera:{focalLength:animated(50)}},
    {type:'add_shared_transition',compositionId:'mc',transition:{id:'t',kind:'crossfade',start:0,duration:10}},
    {type:'set_motion_graph',compositionId:'mc',graph:{nodes:[{id:'out',kind:'output',inputs:[],params:{}}],outputNodeId:'out'}},
    {type:'attach_tracking_data',record:{id:'tr',algorithm:'local',algorithmVersion:'1',kind:'point',supported:true,keyframes:[{frame:0,value:[0,0]}]}},
    {type:'analyze_audio',analysis:{id:'aa',assetId:'music',sourceHash:'h',algorithm:'local',algorithmVersion:'1',fps:30,beats:[0],downbeats:[0]}},
    {type:'set_motion_style',style:{id:'snappy',name:'Snappy',curve:{type:'ease'}}},
  ];
  for(const op of ops){const before=projectRevisionV3(p);const result=applyV3Operation(p,{...op,intent:`test ${op.type}`});assert.equal(result.diff.beforeRevision,before);assert.equal(result.receipt.operation,op.type);assert.ok(result.receipt.affectedIds.length>0);assert.ok(result.checkpointId);p=result.project;}
  assert.equal(p.motionCompositions[0].layers[0].opacity.baseValue,.8);
  assert.equal(p.motionCompositions[0].layers[0].textStyle?.horizontalAlign,'center');
  assert.equal(p.trackingData?.[0].id,'tr');assert.equal(p.audioAnalyses?.[0].id,'aa');assert.equal(p.motionStyles[0].id,'snappy');
});

test('reparent/matte operations reject cycles and locked layers reject mutations',()=>{
  let p=project();p=applyV3Operation(p,{type:'create_motion_composition',composition:{id:'mc',name:'M',width:640,height:360,duration:60,background:'transparent',layers:[]}}).project;
  p=applyV3Operation(p,{type:'add_motion_layer',compositionId:'mc',layer:{...structuredClone(layer),id:'a'}}).project;
  p=applyV3Operation(p,{type:'add_motion_layer',compositionId:'mc',layer:{...structuredClone(layer),id:'b'}}).project;
  p=applyV3Operation(p,{type:'reparent_motion_layer',compositionId:'mc',layerId:'b',parentId:'a'}).project;
  assert.throws(()=>applyV3Operation(p,{type:'reparent_motion_layer',compositionId:'mc',layerId:'a',parentId:'b'}),/cycle/i);
  p.motionCompositions[0].layers[0].locked=true;
  assert.throws(()=>applyV3Operation(p,{type:'set_motion_property',compositionId:'mc',layerId:'a',path:'opacity',value:.5}),/locked/i);
});

test('v3 project session detects revision conflicts',()=>{
  const session=new V3ProjectSession(project());const stale=session.revision;
  const first=session.apply(stale,{type:'create_motion_composition',composition:{id:'mc',name:'M',width:640,height:360,duration:60,background:'transparent',layers:[]}});assert.equal(first.ok,true);
  const conflict=session.apply(stale,{type:'set_motion_style',style:{id:'x',name:'X',curve:{type:'linear'}}});assert.equal(conflict.ok,false);
});

test('camera edits reject non-camera layers',()=>{
  let p=project();p=applyV3Operation(p,{type:'create_motion_composition',composition:{id:'mc',name:'M',width:640,height:360,duration:60,background:'transparent',layers:[]}}).project;
  p=applyV3Operation(p,{type:'add_motion_layer',compositionId:'mc',layer:structuredClone(layer)}).project;
  assert.throws(()=>applyV3Operation(p,{type:'set_camera',compositionId:'mc',layerId:'title',camera:{focalLength:animated(35)}}),/camera layer/i);
});

test('rig binding resolves only inside compositions that declare the rig',()=>{
  let p=project();
  p.motionRigs.push({id:'rig',name:'Rig',version:1,controls:[{id:'amount',name:'Amount',type:'number',defaultValue:1}],bindings:[]});
  const unbound={id:'unbound',name:'Unbound',width:640,height:360,duration:60,background:'transparent' as const,layers:[{...structuredClone(layer),id:'shared'}]};
  const bound={id:'bound',name:'Bound',width:640,height:360,duration:60,background:'transparent' as const,rigId:'rig',layers:[{...structuredClone(layer),id:'shared'}]};
  p.motionCompositions.push(unbound,bound);
  const result=applyV3Operation(p,{type:'bind_rig_control',rigId:'rig',binding:{controlId:'amount',layerId:'shared',propertyPath:'opacity'}});
  assert.equal(result.receipt.affectedRanges[0]?.compositionId,'bound');
});

test('rig binding rejects ambiguous layer targets across compositions sharing the rig',()=>{
  let p=project();
  p.motionRigs.push({id:'rig',name:'Rig',version:1,controls:[{id:'amount',name:'Amount',type:'number',defaultValue:1}],bindings:[]});
  const make=(id:string)=>({id,name:id,width:640,height:360,duration:60,background:'transparent' as const,rigId:'rig',layers:[{...structuredClone(layer),id:'shared'}]});
  p.motionCompositions.push(make('one'),make('two'));
  assert.throws(()=>applyV3Operation(p,{type:'bind_rig_control',rigId:'rig',binding:{controlId:'amount',layerId:'shared',propertyPath:'opacity'}}),/ambiguous.*rig layer/i);
});

test('v3 creates and removes motion rigs only when they are unreferenced',()=>{
  let p=project();
  p=applyV3Operation(p,{type:'create_motion_rig',rig:{id:'rig',name:'Rig',version:1,controls:[{id:'amount',name:'Amount',type:'number',defaultValue:1}],bindings:[]}}).project;
  assert.equal(p.motionRigs[0].id,'rig');
  p=applyV3Operation(p,{type:'create_motion_composition',composition:{id:'mc',name:'M',width:640,height:360,duration:60,background:'transparent',rigId:'rig',layers:[]}}).project;
  assert.throws(()=>applyV3Operation(p,{type:'remove_motion_rig',rigId:'rig'}),/referenced/i);
  p.motionCompositions[0].rigId=undefined;
  const removed=applyV3Operation(p,{type:'remove_motion_rig',rigId:'rig'});
  assert.equal(removed.project.motionRigs.length,0);
});

test('v3 upserts responsive variants and removes shared transitions',()=>{
  let p=project();
  p=applyV3Operation(p,{type:'create_motion_composition',composition:{id:'mc',name:'M',width:640,height:360,duration:60,background:'transparent',layers:[structuredClone(layer)]}}).project;
  p=applyV3Operation(p,{type:'set_responsive_variant',compositionId:'mc',variant:{aspect:'portrait',constraintsByLayer:{title:[{id:'center',type:'center-x'}]}}}).project;
  assert.equal(p.motionCompositions[0].layoutVariants?.length,1);
  p=applyV3Operation(p,{type:'set_responsive_variant',compositionId:'mc',variant:{aspect:'portrait',constraintsByLayer:{title:[{id:'safe',type:'safe-area'}]}}}).project;
  assert.equal(p.motionCompositions[0].layoutVariants?.length,1);assert.equal(p.motionCompositions[0].layoutVariants?.[0].constraintsByLayer.title[0].id,'safe');
  p=applyV3Operation(p,{type:'add_shared_transition',compositionId:'mc',transition:{id:'fade',kind:'crossfade',start:0,duration:10}}).project;
  const removed=applyV3Operation(p,{type:'remove_shared_transition',compositionId:'mc',transitionId:'fade'});
  assert.equal(removed.project.motionCompositions[0].sharedTransitions?.length,0);
});

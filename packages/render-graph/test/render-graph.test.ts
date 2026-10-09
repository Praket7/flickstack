import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRenderGraph, validateCompositionGraph, computeInvalidation, diagnoseRendererSupport } from '../src/index.ts';
import { migrateV1ToV2 } from '../../schema/src/index.ts';
import type { FlickProject } from '../../schema/src/project.ts';

function project(): ReturnType<typeof migrateV1ToV2> {
 const v1: FlickProject = { version:1,id:'p',name:'P',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:'/tmp/a.mp4',kind:'video'}],tracks:[{id:'v',kind:'video',name:'V',clips:[{id:'c',assetId:'a',start:0,duration:60,sourceIn:0}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[] };
 return migrateV1ToV2(v1);
}

test('validates composition cycles with path', () => {
  const p = project();
  p.compositions.push({ id:'b', name:'B', width:640, height:360, tracks:[{id:'tb',kind:'video',name:'B',clips:[]} ] });
  p.compositions[0].tracks[0].clips[0].compositionId='b'; delete p.compositions[0].tracks[0].clips[0].assetId;
  p.compositions[1].tracks[0].clips.push({ id:'bc', compositionId:p.compositions[0].id, start:0,duration:20,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true });
  const d=validateCompositionGraph(p);
  assert.equal(d[0].code,'composition_cycle');
  assert.match(d[0].message,/root.*b.*root/);
});

test('compiles deterministically with explicit visual and audio topology', () => {
  const p=project();
  const a=compileRenderGraph(p);
  const b=compileRenderGraph(structuredClone(p));
  assert.deepEqual(a,b);
  assert.ok(a.nodes.some(n=>n.kind==='visual-source' && n.range.start===0 && n.range.end===60));
  assert.ok(a.nodes.some(n=>n.kind==='audio-bus' && n.id==='audio:bus:master'));
});

test('range invalidation stays bounded while propagating downstream node ids', () => {
  const p=project();
  const before=compileRenderGraph(p);
  p.compositions[0].tracks[0].clips[0].opacity=.5;
  const after=compileRenderGraph(p);
  const inv=computeInvalidation(before,after);
  assert.deepEqual(inv.ranges,[{start:0,end:60}]);
  assert.ok(inv.changedNodeIds.length>0);
  assert.ok(inv.downstreamNodeIds.includes('output:root'));
});

test('renderer support is explicit and approximation requires tolerance', () => {
  const p=project();
  p.compositions[0].tracks[0].clips[0].effectStack.push({id:'fx',type:'blur',enabled:true,params:{radius:2}});
  const g=compileRenderGraph(p);
  const no=diagnoseRendererSupport(g,{renderer:'x',effects:{}});
  assert.ok(no.some(x=>x.severity==='error' && x.message.includes('blur')));
  const approx=diagnoseRendererSupport(g,{renderer:'x',effects:{blur:{support:'approximate',tolerance:{pixelRmse:0.02}}}});
  assert.ok(approx.some(x=>x.severity==='warning'));
});

import { migrateV2ToV3, animated, defaultMotionTransform } from '../../schema/src/index.ts';

test('v3 compiler expands an editorial motion clip into structured motion/text/vector/camera nodes',()=>{
  const p=migrateV2ToV3(project());
  p.motionCompositions.push({id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',cameraId:'cam',layers:[
    {id:'cam',kind:'camera',name:'Camera',start:0,duration:60,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,camera:{focalLength:animated(50)}},
    {id:'title',kind:'text',name:'Title',start:5,duration:30,enabled:true,locked:false,zIndex:1,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,text:'Hello',textStyle:{fontSize:animated(48)}},
    {id:'box',kind:'shape',name:'Box',start:10,duration:20,enabled:true,locked:false,zIndex:2,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,shape:{kind:'rect',width:100,height:50}},
  ],motionBlur:{enabled:true,shutterAngle:180,shutterPhase:0,samples:5,quality:'final'},compositingGraph:{nodes:[{id:'layer',kind:'layer',inputs:[],params:{}},{id:'out',kind:'output',inputs:['layer'],params:{}}],outputNodeId:'out'}});
  p.compositions[0].tracks.push({id:'m',kind:'motion',name:'Motion',clips:[{id:'mc-clip',start:20,duration:40,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,props:{motionCompositionId:'mc'}}]});
  const g=compileRenderGraph(p);
  assert.ok(g.nodes.some(n=>n.kind==='motion-source'&&n.params.motionCompositionId==='mc'));
  assert.ok(g.nodes.some(n=>n.kind==='text-scene'&&n.params.layerId==='title'));
  assert.ok(g.nodes.some(n=>n.kind==='vector-scene'&&n.params.layerId==='box'));
  assert.ok(g.nodes.some(n=>n.kind==='camera'&&n.params.layerId==='cam'));
  assert.ok(g.nodes.some(n=>n.kind==='motion-blur'));
  assert.ok(g.nodes.some(n=>n.kind==='compositing-node'));
});

test('v3 motion property changes invalidate only the affected layer time range before downstream propagation',()=>{
  const p=migrateV2ToV3(project());
  p.motionCompositions.push({id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',layers:[{id:'title',kind:'text',name:'Title',start:10,duration:20,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,text:'Hi',textStyle:{fontSize:animated(40)}}]});
  p.compositions[0].tracks.push({id:'m',kind:'motion',name:'Motion',clips:[{id:'mc-clip',start:100,duration:60,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,props:{motionCompositionId:'mc'}}]});
  const before=compileRenderGraph(p);
  p.motionCompositions[0].layers[0].opacity.baseValue=.5;
  const after=compileRenderGraph(p);
  const inv=computeInvalidation(before,after);
  assert.ok(inv.ranges.some(r=>r.start===110&&r.end===130),JSON.stringify(inv.ranges));
  assert.ok(inv.changedNodeIds.some(id=>id.includes('title')));
  assert.ok(inv.downstreamNodeIds.includes('output:root'));
});

test('v3 motion nodes advertise explicit renderer capabilities',()=>{
  const p=migrateV2ToV3(project());
  p.motionCompositions.push({id:'mc',name:'M',width:640,height:360,duration:30,background:'transparent',layers:[{id:'t',kind:'text',name:'T',start:0,duration:30,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,text:'T',textStyle:{fontSize:animated(40)}}]});
  p.compositions[0].tracks.push({id:'m',kind:'motion',name:'M',clips:[{id:'x',start:0,duration:30,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,props:{motionCompositionId:'mc'}}]});
  const g=compileRenderGraph(p);
  const d=diagnoseRendererSupport(g,{renderer:'reference',effects:{}});
  assert.ok(d.some(x=>x.severity==='error'&&x.message.includes('motion.text')));
});

test('v3 motion graph dependencies are independent of layer and compositing declaration order',()=>{
  const p=migrateV2ToV3(project());
  const child={id:'child',kind:'shape' as const,name:'Child',start:0,duration:30,parentId:'parent',enabled:true,locked:false,zIndex:1,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,shape:{kind:'rect' as const,width:20,height:20}};
  const parent={id:'parent',kind:'group' as const,name:'Parent',start:0,duration:30,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false};
  p.motionCompositions.push({id:'mc-order',name:'Ordered',width:100,height:100,duration:30,background:'transparent',layers:[child,parent],compositingGraph:{nodes:[{id:'out',kind:'output',inputs:['fx'],params:{}},{id:'fx',kind:'glow',inputs:['layers'],params:{}},{id:'layers',kind:'layer',inputs:[],params:{}}],outputNodeId:'out'}});
  p.compositions[0].tracks.push({id:'m-order',kind:'motion',name:'Motion',clips:[{id:'x-order',start:0,duration:30,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,props:{motionCompositionId:'mc-order'}}]});
  const g=compileRenderGraph(p);
  const childNode=g.nodes.find(n=>n.params.layerId==='child'&&n.kind==='vector-scene')!;
  const parentNode=g.nodes.find(n=>n.params.layerId==='parent'&&n.kind==='motion-layer')!;
  assert.ok(childNode.upstream.includes(parentNode.id),'child must depend on parent even when parent is declared later');
  const graphOut=g.nodes.find(n=>n.id.endsWith(':graph:out'))!,graphFx=g.nodes.find(n=>n.id.endsWith(':graph:fx'))!,graphLayers=g.nodes.find(n=>n.id.endsWith(':graph:layers'))!;
  assert.deepEqual(graphOut.upstream,[graphFx.id]);
  assert.deepEqual(graphFx.upstream,[graphLayers.id]);
});

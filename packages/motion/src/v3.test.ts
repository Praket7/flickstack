import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMotionComposition, validateMotionComposition } from './index.ts';
import { animated, defaultMotionTransform, type MotionComposition, type MotionLayer } from '../../schema/src/v3/project.ts';

const layer=(id:string,kind:MotionLayer['kind']='group'):MotionLayer=>({
  id,kind,name:id,start:0,duration:60,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,
});

test('motion scene evaluator resolves hierarchical world transforms deterministically',()=>{
  const parent=layer('parent');parent.transform.position={baseValue:[100,50,0]};
  const child=layer('child','shape');child.parentId='parent';child.transform.position={baseValue:[20,10,0]};child.shape={kind:'rect',width:100,height:50};
  const c:MotionComposition={id:'m',name:'M',width:1920,height:1080,duration:60,background:'#000',layers:[parent,child]};
  validateMotionComposition(c);
  const a=evaluateMotionComposition(c,20),b=evaluateMotionComposition(c,20);
  assert.deepEqual(a,b);
  const evaluated=a.layers.find(x=>x.id==='child')!;
  assert.deepEqual(evaluated.worldPosition,[120,60,0]);
  assert.deepEqual(evaluated.bounds,{x:120,y:60,width:100,height:50});
});

test('property order is keyframes then behaviors then expression with domain clamp',()=>{
  const l=layer('x','shape');l.shape={kind:'rect',width:10,height:10};
  l.opacity={baseValue:0,keyframes:[{frame:0,value:0,interpolation:'linear'},{frame:10,value:1,interpolation:'linear'}],behaviors:[{id:'a',type:'audio-react',enabled:true,params:{signal:'energy',amount:.2}}],expression:{source:'value + 0.1',mode:'replace'}};
  const c:MotionComposition={id:'m',name:'M',width:100,height:100,duration:60,background:'transparent',layers:[l]};
  const e=evaluateMotionComposition(c,5,{audio:{energy:.5}}).layers[0];
  assert.ok(Math.abs(e.opacity-.7)<1e-9);
  l.opacity.expression={source:'2',mode:'replace'};
  assert.equal(evaluateMotionComposition(c,5).layers[0].opacity,1);
});

test('layout resolves before transform animation and text selector data stays editable',()=>{
  const text=layer('title','text');text.text='Build 👨‍🚀 faster';text.textStyle={fontSize:animated(50),lineHeight:animated(60),tracking:animated(0),horizontalAlign:'left',fill:animated('#fff'),paragraphBox:{x:0,y:0,width:500,height:200}};
  text.layout=[{id:'cx',type:'center-x'},{id:'top',type:'pin-top',value:40},{id:'safe',type:'safe-area',value:'inside'}];
  text.textSelectors=[{id:'words',type:'words',start:0,end:1}];
  const c:MotionComposition={id:'m',name:'M',width:1000,height:600,duration:60,background:'#000',layers:[text]};
  const e=evaluateMotionComposition(c,1).layers[0];
  assert.ok(e.textLayout?.clusters.some(x=>x.text==='👨‍🚀'));
  assert.ok(e.selectorWeights?.words.some(x=>x===1));
  assert.ok(e.bounds.x>0);
});

test('validation rejects parent/matte cycles and invalid lifetime independently of project parser',()=>{
  const a=layer('a'),b=layer('b');a.parentId='b';b.parentId='a';
  assert.throws(()=>validateMotionComposition({id:'m',name:'M',width:10,height:10,duration:60,background:'#000',layers:[a,b]}),/cycle/i);
  const x=layer('x');x.duration=61;assert.throws(()=>validateMotionComposition({id:'m',name:'M',width:10,height:10,duration:60,background:'#000',layers:[x]}),/lifetime/i);
  const p=layer('p'),q=layer('q');p.matte={sourceLayerId:'q',mode:'alpha'};q.matte={sourceLayerId:'p',mode:'alpha'};
  assert.throws(()=>validateMotionComposition({id:'m',name:'M',width:10,height:10,duration:60,background:'#000',layers:[p,q]}),/matte.*cycle/i);
});

test('scene evaluator applies responsive variants, per-cluster text animators, and rig controls in canonical order',()=>{
  const title=layer('title','text');
  title.text='GO';
  title.textStyle={fontSize:animated(40),lineHeight:animated(48),tracking:animated(0),horizontalAlign:'left',fill:animated('#fff'),paragraphBox:{x:0,y:0,width:200,height:60}};
  title.opacity={baseValue:.2,expression:{source:'value + 0.1',mode:'replace'}};
  title.textSelectors=[{id:'first',type:'characters',start:0,end:1}];
  title.textAnimators=[{id:'rise',selectorIds:['first'],position:animated([0,20,0]),opacity:animated(.5),blur:animated(8)}];
  const c:MotionComposition={id:'m-responsive',name:'Responsive',width:1920,height:1080,duration:60,background:'#000',rigId:'rig',layers:[title],layoutVariants:[
    {aspect:'landscape',constraintsByLayer:{title:[{id:'x-land',type:'pin-left',value:100}]}},
    {aspect:'portrait',constraintsByLayer:{title:[{id:'x-port',type:'pin-left',value:40}]}},
  ]};
  const rig={id:'rig',name:'Rig',version:1,controls:[{id:'opacity',name:'Opacity',type:'number' as const,defaultValue:.8,min:0,max:1}],bindings:[{controlId:'opacity',layerId:'title',propertyPath:'opacity'}]};
  const land=evaluateMotionComposition(c,10,{surface:{width:1920,height:1080},rig,rigValues:{opacity:.75}});
  const port=evaluateMotionComposition(c,10,{surface:{width:1080,height:1920},rig,rigValues:{opacity:.75}});
  assert.equal(land.width,1920);assert.equal(port.width,1080);
  assert.equal(land.layers[0].bounds.x,100);assert.equal(port.layers[0].bounds.x,40);
  assert.equal(land.layers[0].opacity,.75,'rig mapping is the final property stage');
  assert.equal(land.layers[0].textClusters?.length,2);
  assert.deepEqual(land.layers[0].textClusters?.[0].position,[0,20,0]);
  assert.deepEqual(land.layers[0].textClusters?.[1].position,[0,0,0]);
  assert.equal(land.layers[0].textClusters?.[0].opacity,.5);
  assert.equal(land.layers[0].textClusters?.[1].opacity,1);
  assert.equal(land.layers[0].textClusters?.[0].blur,8);
});


test('scene expressions receive first-class audio analysis variables without manual vars plumbing',()=>{
  const l=layer('audio-driven','shape');
  l.shape={kind:'rect',width:10,height:10};
  l.opacity={baseValue:.1,expression:{source:'audio.energy * 0.5 + audio.beat * 0.25',mode:'replace'}};
  const c:MotionComposition={id:'m-audio-expression',name:'Audio Expression',width:100,height:100,duration:60,background:'transparent',layers:[l]};
  const e=evaluateMotionComposition(c,5,{audio:{energy:.8,beat:1}}).layers[0];
  assert.equal(e.opacity,.65);
});

test('parented responsive layout converts absolute solver bounds back to parent-local coordinates',()=>{
  const parent=layer('parent','shape');parent.shape={kind:'rect',width:200,height:200};parent.layout=[{id:'pl',type:'pin-left',value:100},{id:'pt',type:'pin-top',value:50}];
  const child=layer('child','shape');child.parentId='parent';child.shape={kind:'rect',width:20,height:20};child.layout=[{id:'cl',type:'pin-left',value:20},{id:'ct',type:'pin-top',value:10}];
  const c:MotionComposition={id:'parent-layout',name:'Parent layout',width:800,height:600,duration:60,background:'transparent',layers:[parent,child]};
  const scene=evaluateMotionComposition(c,0);const p=scene.layers.find(l=>l.id==='parent')!,ch=scene.layers.find(l=>l.id==='child')!;
  assert.equal(p.bounds.x,100);assert.equal(p.bounds.y,50);
  assert.equal(ch.bounds.x,120);assert.equal(ch.bounds.y,60);
});

test('point rig controls preserve z when bound to vec3 motion properties',()=>{
  const item=layer('item','shape');item.shape={kind:'rect',width:10,height:10};item.transform.position=animated([1,2,30]);
  const c:MotionComposition={id:'point-rig',name:'Point rig',width:100,height:100,duration:60,background:'transparent',rigId:'point-rig',layers:[item]};
  const rig={id:'point-rig',name:'Point rig',version:1,controls:[{id:'position',name:'Position',type:'point' as const,defaultValue:[10,20]}],bindings:[{controlId:'position',layerId:'item',propertyPath:'transform.position'}]};
  const scene=evaluateMotionComposition(c,0,{rig,rigValues:{position:[40,50]}});
  assert.deepEqual(scene.layers[0].localPosition,[40,50,30]);
});


test('text animators materialize selected fill and stroke width per cluster',()=>{
  const title=layer('styled-text','text');title.text='AB';title.textStyle={fontSize:animated(40),fill:animated('#111111'),strokeWidth:animated(1)};
  title.textSelectors=[{id:'first',type:'index-range',start:0,end:1}];
  title.textAnimators=[{id:'style-first',selectorIds:['first'],fill:animated('#ff0000'),strokeWidth:animated(5)}];
  const c:MotionComposition={id:'text-style-animation',name:'Text style animation',width:300,height:100,duration:60,background:'transparent',layers:[title]};
  const clusters=evaluateMotionComposition(c,0).layers[0].textClusters!;
  assert.equal(clusters[0].fill,'#ff0000');assert.equal(clusters[0].strokeWidth,5);
  assert.equal(clusters[1].fill,'#111111');assert.equal(clusters[1].strokeWidth,1);
});

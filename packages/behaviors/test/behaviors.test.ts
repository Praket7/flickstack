import test from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRegistry, evaluateBehaviorNumber, evaluateBehaviorVec3 } from '../src/index.ts';

const ctx={frame:15,start:0,duration:30,index:1,count:4,seed:9,audio:{energy:.8,low:.5,mid:.2,high:.1,beat:1,downbeat:0},resolveVector:(id:string)=>id==='target'?[100,50,0] as const:undefined};

test('initial professional behavior library declares domains cost and bakeability',()=>{
  for(const name of ['fade','slide','grow','spring','overshoot','drift','wiggle','follow','look-at','follow-path','orbit','stagger','sequence','type-on','audio-react','auto-focus']){
    const d=behaviorRegistry[name];assert.ok(d,name);assert.ok(d.domains.length>0);assert.ok(d.estimatedCost>0);assert.equal(typeof d.bakeable,'boolean');
  }
});

test('number behaviors are deterministic and audio-react uses named normalized signals',()=>{
  const behavior={id:'b',type:'audio-react',enabled:true,params:{signal:'energy',amount:10},seed:2};
  assert.equal(evaluateBehaviorNumber(5,behavior,ctx),13);
  assert.equal(evaluateBehaviorNumber(5,behavior,ctx),evaluateBehaviorNumber(5,behavior,ctx));
  assert.ok(evaluateBehaviorNumber(0,{id:'w',type:'wiggle',enabled:true,params:{amplitude:20,frequency:.2},seed:42},ctx)<=20);
});

test('vector behaviors support slide follow orbit and deterministic wiggle',()=>{
  assert.deepEqual(evaluateBehaviorVec3([0,0,0],{id:'s',type:'slide',enabled:true,params:{from:[100,0,0]}},ctx),[50,0,0]);
  assert.deepEqual(evaluateBehaviorVec3([0,0,0],{id:'f',type:'follow',enabled:true,params:{targetId:'target',offset:[10,5,0]}},ctx),[110,55,0]);
  const a=evaluateBehaviorVec3([0,0,0],{id:'o',type:'orbit',enabled:true,params:{radius:100,speed:1}},ctx);
  const b=evaluateBehaviorVec3([0,0,0],{id:'o',type:'orbit',enabled:true,params:{radius:100,speed:1}},ctx);
  assert.deepEqual(a,b);
});

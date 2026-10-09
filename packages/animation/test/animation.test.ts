import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAnimatedNumber,
  evaluateAnimatedVec2,
  evaluateAnimatedVec3,
  sampleVelocity,
  sampleCurve,
  applyMotionStyle,
  motionStylePresets,
  resolveRovingVec3Keyframes,
} from '../src/index.ts';
import type { AnimatedProperty } from '../../schema/src/v3/project.ts';

const property=(interpolation:any):AnimatedProperty<number>=>({baseValue:0,keyframes:[{frame:0,value:0,interpolation},{frame:10,value:100,interpolation}]});

test('number evaluator handles hold, linear, bezier/ease, expo, spring and damped overshoot with exact endpoints',()=>{
  assert.equal(evaluateAnimatedNumber(property('hold'),5),0);
  assert.equal(evaluateAnimatedNumber(property('linear'),5),50);
  for(const kind of ['bezier','auto-bezier','continuous-bezier','ease','expo-in','expo-out','expo-in-out','spring','damped-overshoot'] as const){
    const p=property(kind);
    assert.equal(evaluateAnimatedNumber(p,0),0,kind);
    assert.equal(evaluateAnimatedNumber(p,10),100,kind);
    const mid=evaluateAnimatedNumber(p,5);
    assert.ok(Number.isFinite(mid),kind);
    assert.ok(mid>-100&&mid<220,`${kind} bounded`);
  }
});

test('explicit bezier handles change timing while remaining deterministic',()=>{
  const p:AnimatedProperty<number>={baseValue:0,keyframes:[
    {frame:0,value:0,interpolation:'bezier',outTangent:{x:.1,y:0}},
    {frame:10,value:100,interpolation:'bezier',inTangent:{x:.9,y:0}},
  ]};
  const a=evaluateAnimatedNumber(p,5),b=evaluateAnimatedNumber(p,5);
  assert.equal(a,b);
  assert.ok(a<40);
});

test('vector evaluators interpolate dimensions independently and clamp outside keyframe range',()=>{
  const v2:AnimatedProperty<readonly[number,number]>={baseValue:[1,2],keyframes:[{frame:2,value:[0,10],interpolation:'linear'},{frame:6,value:[8,2],interpolation:'linear'}]};
  assert.deepEqual(evaluateAnimatedVec2(v2,0),[0,10]);
  assert.deepEqual(evaluateAnimatedVec2(v2,4),[4,6]);
  assert.deepEqual(evaluateAnimatedVec2(v2,99),[8,2]);
  const v3:AnimatedProperty<readonly[number,number,number]>={baseValue:[0,0,0],keyframes:[{frame:0,value:[0,0,0],interpolation:'linear'},{frame:10,value:[10,20,30],interpolation:'linear'}]};
  assert.deepEqual(evaluateAnimatedVec3(v3,5),[5,10,15]);
});

test('velocity sampling is deterministic and matches linear slope',()=>{
  const p=property('linear');
  assert.equal(sampleVelocity(p,5),10);
  assert.equal(sampleVelocity(p,5),sampleVelocity(p,5));
});

test('curve sampling returns normalized value and velocity without wall-clock dependence',()=>{
  const a=sampleCurve('ui-native',.5),b=sampleCurve('ui-native',.5);
  assert.deepEqual(a,b);
  assert.ok(a.value>0&&a.value<1);
  assert.ok(Number.isFinite(a.velocity));
});

test('motion styles are data and can be applied without changing semantic endpoint values',()=>{
  assert.ok(motionStylePresets['ui-native']);
  assert.ok(motionStylePresets.snappy);
  const p=applyMotionStyle(10,30,0,1,'cinematic');
  assert.equal(p.keyframes?.[0].frame,10);
  assert.equal(p.keyframes?.[1].frame,30);
  assert.equal(evaluateAnimatedNumber(p,10),0);
  assert.equal(evaluateAnimatedNumber(p,30),1);
});

test('vector animation supports independent dimension tangents',()=>{
 const p={baseValue:[0,0,0] as const,keyframes:[
  {frame:0,value:[0,0,0] as const,interpolation:'bezier' as const,dimensionTangents:{x:{outTangent:{x:.1,y:.9}},y:{outTangent:{x:.9,y:.1}}}},
  {frame:10,value:[100,100,0] as const,interpolation:'bezier' as const,dimensionTangents:{x:{inTangent:{x:.9,y:.9}},y:{inTangent:{x:.1,y:.1}}}},
 ]};
 const v=evaluateAnimatedVec3(p,5);assert.notEqual(Math.round(v[0]*1000),Math.round(v[1]*1000));
});

test('roving spatial keys redistribute time according to travelled distance',()=>{
 const keys=[{frame:0,value:[0,0,0] as const,interpolation:'linear' as const},{frame:5,value:[1,0,0] as const,interpolation:'linear' as const,roving:true},{frame:10,value:[10,0,0] as const,interpolation:'linear' as const}];
 const r=resolveRovingVec3Keyframes(keys);assert.equal(r[1].frame,1);assert.equal(r[0].frame,0);assert.equal(r[2].frame,10);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRigControls, validateRig } from '../src/rigs.ts';
import type { MotionRigDefinition } from '../../schema/src/v3/project.ts';

const rig:MotionRigDefinition={id:'r',name:'Message',version:1,controls:[
  {id:'amount',name:'Amount',type:'number',defaultValue:50,min:0,max:100},
  {id:'enabled',name:'Enabled',type:'boolean',defaultValue:true},
  {id:'mode',name:'Mode',type:'enum',defaultValue:'soft',options:['soft','hard']},
],bindings:[
  {controlId:'amount',layerId:'card',propertyPath:'opacity',inputRange:[0,100],outputRange:[0,1]},
  {controlId:'enabled',layerId:'card',propertyPath:'enabled'},
]};

test('rig validation and control mapping publish a small semantic surface',()=>{
  assert.doesNotThrow(()=>validateRig(rig));
  const out=resolveRigControls(rig,{amount:25});
  assert.deepEqual(out.find(x=>x.propertyPath==='opacity')?.value,.25);
  assert.equal(out.find(x=>x.propertyPath==='enabled')?.value,true);
});

test('rig controls reject out-of-range and invalid enum values',()=>{
  assert.throws(()=>resolveRigControls(rig,{amount:101}),/range/i);
  assert.throws(()=>resolveRigControls(rig,{mode:'nope'}),/enum/i);
});

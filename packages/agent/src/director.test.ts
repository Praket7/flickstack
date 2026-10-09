import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDirectorPlan, buildDirectorReceipt, type DirectorPlan } from './director.ts';
import { normalizeStyle } from './style.ts';

function plan():DirectorPlan{return{
  version:1,
  brief:{id:'brief',objective:'Explain a professional local-first editor',audience:'professional editors',durationFrames:900,aspect:'landscape',message:'Edit with control and evidence',constraints:['product UI remains legible']},
  grammar:{id:'grammar',motionStyleIds:['ui-native'],transitionKinds:['hard-cut','shared-element'],textEntrances:['mask-reveal'],cameraLanguage:['push-in'],rules:['one focal move at a time']},
  storyboard:[{id:'scene-1',start:0,duration:180,purpose:'establish product',focus:'timeline',componentId:'feature-card',motionStyleId:'ui-native',transitionOut:'shared-element',rationale:'move from intent to concrete edit',constraints:['safe-area']}],
  shots:[{id:'shot-1',sceneId:'scene-1',start:0,duration:180,compositionId:'motion-main',camera:'push-in',focusLayerIds:['timeline-ui']}],
  sound:[{id:'sound-1',sceneId:'scene-1',frame:40,event:'click'}],
};}

test('Director plans validate semantic component/style references and preserve structured rationale',()=>{
  const value=validateDirectorPlan(plan(),{componentIds:new Set(['feature-card']),motionStyleIds:new Set(['ui-native']),compositionIds:new Set(['motion-main'])});
  assert.equal(value.storyboard[0].componentId,'feature-card');
  const receipt=buildDirectorReceipt(value.storyboard[0]);
  assert.equal(receipt.sceneId,'scene-1');
  assert.match(receipt.intent,/intent to concrete edit/i);
  assert.deepEqual(receipt.constraints,['safe-area']);
});

test('Director plans reject opaque executable payloads and unknown semantic references',()=>{
  const executable={...plan(),storyboard:[{...plan().storyboard[0],props:{command:'rm -rf /'}}]} as unknown as DirectorPlan;
  assert.throws(()=>validateDirectorPlan(executable,{componentIds:new Set(['feature-card']),motionStyleIds:new Set(['ui-native']),compositionIds:new Set(['motion-main'])}),/executable|command|opaque/i);
  const missing=plan();missing.storyboard[0].componentId='missing';
  assert.throws(()=>validateDirectorPlan(missing,{componentIds:new Set(['feature-card']),motionStyleIds:new Set(['ui-native']),compositionIds:new Set(['motion-main'])}),/unknown component/i);
});

test('style packages retain semantic motion grammar references through normalization',()=>{
  const style=normalizeStyle({id:'pro',motionGrammarId:'grammar',motionStyleIds:['ui-native','cinematic'],motion:{density:'restrained'}});
  assert.equal(style.motionGrammarId,'grammar');
  assert.deepEqual(style.motionStyleIds,['ui-native','cinematic']);
});

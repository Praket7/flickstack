import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGain, buildDuckingEnvelope, detectBeatsFromEnergy, equalPowerCrossfade, planLoudnessNormalization, repairClicks } from './audio.ts';

test('ducking envelope lowers music during voice ranges with attack and release',()=>{
 const env=buildDuckingEnvelope([{start:30,end:60}],{totalFrames:90,normalGain:1,duckGain:.25,attackFrames:5,releaseFrames:5});
 assert.equal(env[0].gain,1); assert.ok(env.some(p=>p.frame===30&&p.gain<=.25)); assert.equal(env.at(-1)?.gain,1);
});

test('beat detection finds local energy peaks with minimum spacing',()=>{
 assert.deepEqual(detectBeatsFromEnergy([0,1,5,1,0,1,6,1,0],{threshold:4,minDistance:3}),[2,6]);
});

test('loudness normalization respects integrated LUFS and true-peak ceilings',()=>{
 const plan=planLoudnessNormalization({integratedLufs:-20,truePeakDbtp:-3},{integratedLufs:-14,truePeakDbtp:-1});
 assert.equal(plan.gainDb,2);
 assert.equal(plan.predictedTruePeakDbtp,-1);
 assert.equal(plan.predictedIntegratedLufs,-18);
 assert.equal(plan.limitedByTruePeak,true);
});

test('repair primitives remove isolated clicks and create equal-power crossfades',()=>{
 assert.deepEqual(repairClicks([0,0,1,0,0],{threshold:.5}),[0,0,0,0,0]);
 const fade=equalPowerCrossfade([1,1,1],[1,1,1],3);
 assert.ok(Math.abs(fade.outgoing.at(-1)??1)<1e-9);
 assert.ok(Math.abs((fade.incoming.at(-1)??0)-1)<1e-9);
 assert.deepEqual(applyGain([2,-2,0.5],0),[1,-1,0.5]);
});

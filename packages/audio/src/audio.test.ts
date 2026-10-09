import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuckingEnvelope, detectBeatsFromEnergy } from './audio.ts';

test('ducking envelope lowers music during voice ranges with attack and release',()=>{
 const env=buildDuckingEnvelope([{start:30,end:60}],{totalFrames:90,normalGain:1,duckGain:.25,attackFrames:5,releaseFrames:5});
 assert.equal(env[0].gain,1); assert.ok(env.some(p=>p.frame===30&&p.gain<=.25)); assert.equal(env.at(-1)?.gain,1);
});

test('beat detection finds local energy peaks with minimum spacing',()=>{
 assert.deepEqual(detectBeatsFromEnergy([0,1,5,1,0,1,6,1,0],{threshold:4,minDistance:3}),[2,6]);
});

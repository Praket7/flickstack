import test from 'node:test';
import assert from 'node:assert/strict';
import { WhisperCppAdapter } from './transcribe.ts';

test('whisper adapter normalizes word timestamps into integer frame ticks',async()=>{
 const runner=async()=>({segments:[{startMs:0,endMs:1200,text:'Hello world',words:[{startMs:0,endMs:500,text:'Hello'},{startMs:520,endMs:1200,text:'world'}]}]});
 const adapter=new WhisperCppAdapter({runner});
 const result=await adapter.transcribe('/tmp/fake.wav',{fps:{numerator:30,denominator:1}});
 assert.deepEqual(result.words.map(w=>[w.text,w.startFrame,w.endFrame]),[['Hello',0,15],['world',16,36]]);
 assert.equal(result.segments[0].endFrame,36);
});

test('whisper adapter reports optional runtime unavailability explicitly',async()=>{
 const adapter=new WhisperCppAdapter({runner:async()=>{throw new Error('whisper.cpp executable not configured');}});
 await assert.rejects(()=>adapter.transcribe('/tmp/fake.wav',{fps:{numerator:30,denominator:1}}),/whisper\.cpp executable not configured/);
});

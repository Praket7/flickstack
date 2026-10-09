import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisCacheKey,
  normalizeAudioAnalysis,
  sampleAudioSignal,
  snapFrameToBeat,
  phraseAtFrame,
  isSilentAtFrame,
  materializeSoundCues,
} from '../src/index.ts';
import type { AudioAnalysisRecord, MotionComponentDefinition } from '../../schema/src/v3/project.ts';

const record:AudioAnalysisRecord={
  id:'analysis',assetId:'music',sourceHash:'abc',algorithm:'local-energy',algorithmVersion:'1.0.0',fps:30,
  beats:[0,15,30,45],downbeats:[0,30],onsets:[{frame:15,strength:.9}],phrases:[{start:0,end:30,label:'intro'},{start:30,end:60,label:'drop'}],silence:[{start:50,end:60}],
  envelopes:{energy:[{frame:0,value:0},{frame:30,value:1}],low:[{frame:0,value:.2},{frame:30,value:.6}],mid:[],high:[],speech:[]},
};

test('analysis cache identity includes source hash and algorithm version',()=>{
  const a=analysisCacheKey(record),b=analysisCacheKey(record);
  assert.equal(a,b);
  assert.notEqual(a,analysisCacheKey({...record,sourceHash:'def'}));
  assert.notEqual(a,analysisCacheKey({...record,algorithmVersion:'2'}));
});

test('analysis normalization sorts/deduplicates markers and clamps envelopes',()=>{
  const normalized=normalizeAudioAnalysis({...record,beats:[30,15,15,0],envelopes:{...record.envelopes!,energy:[{frame:30,value:2},{frame:0,value:-1}]}});
  assert.deepEqual(normalized.beats,[0,15,30]);
  assert.deepEqual(normalized.envelopes?.energy,[{frame:0,value:0},{frame:30,value:1}]);
});

test('frame sampling aligns beat impulses within one frame and linearly interpolates energy',()=>{
  assert.equal(sampleAudioSignal(record,'beat',14.4),1);
  assert.equal(sampleAudioSignal(record,'beat',13.8),0);
  assert.equal(sampleAudioSignal(record,'downbeat',29.2),1);
  assert.ok(Math.abs(sampleAudioSignal(record,'energy',15)-.5)<1e-9);
  assert.ok(Math.abs(sampleAudioSignal(record,'low',15)-.4)<1e-9);
});

test('beat snapping and phrase/silence helpers are deterministic',()=>{
  assert.equal(snapFrameToBeat(record,27,'beat',5),30);
  assert.equal(snapFrameToBeat(record,27,'downbeat',2),27);
  assert.equal(phraseAtFrame(record,35)?.label,'drop');
  assert.equal(isSilentAtFrame(record,55),true);
});

test('sound cue materialization never invents or hides audio assets',()=>{
  const component={id:'c',name:'C',category:'ui',version:1,composition:{id:'m',name:'M',width:10,height:10,duration:60,background:'transparent',layers:[]},soundCues:[{id:'send',frame:10,event:'send'},{id:'impact',frame:20,event:'impact',assetId:'explicit'}]} as MotionComponentDefinition;
  const events=materializeSoundCues(component,{send:'asset-send'});
  assert.deepEqual(events[0],{cueId:'send',frame:10,event:'send',assetId:'asset-send',resolved:true,gainDb:0});
  assert.deepEqual(events[1],{cueId:'impact',frame:20,event:'impact',assetId:'explicit',resolved:true,gainDb:0});
  const unresolved=materializeSoundCues(component,{});
  assert.equal(unresolved[0].assetId,undefined);
  assert.equal(unresolved[0].resolved,false);
});

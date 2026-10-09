import test from 'node:test';import assert from 'node:assert/strict';import {snapFrame,moveSelectedKeyframes,copyKeyframes,pasteKeyframes} from '../authoring-model.ts';
test('timeline snapping chooses nearest beat or frame target deterministically',()=>{assert.equal(snapFrame(47.6,{beats:[30,60],keyframes:[48],threshold:4}),48);assert.equal(snapFrame(58,{beats:[60],keyframes:[],threshold:4}),60);assert.equal(snapFrame(51,{beats:[60],keyframes:[],threshold:4}),51);});
test('dope-sheet keyframe moves and copy paste preserve values and relative spacing',()=>{const keys=[{frame:10,value:0,interpolation:'linear' as const},{frame:20,value:1,interpolation:'bezier' as const}];assert.deepEqual(moveSelectedKeyframes(keys,new Set([10,20]),5).map(k=>k.frame),[15,25]);const clip=copyKeyframes(keys,new Set([10,20]));assert.deepEqual(pasteKeyframes(clip,100).map(k=>k.frame),[100,110]);});
import {selectLayerIds,resizeLayerTiming,animationState} from '../authoring-model.ts';

test('layer selection supports deterministic single and additive multiselect',()=>{
 assert.deepEqual([...selectLayerIds(new Set(['a']),'b',false)],['b']);
 assert.deepEqual([...selectLayerIds(new Set(['a']),'b',true)].sort(),['a','b']);
 assert.deepEqual([...selectLayerIds(new Set(['a','b']),'a',true)],['b']);
});

test('timeline edge resize is frame exact and preserves minimum one-frame duration',()=>{
 assert.deepEqual(resizeLayerTiming({start:10,duration:20},'start',5),{start:15,duration:15});
 assert.deepEqual(resizeLayerTiming({start:10,duration:20},'end',-50),{start:10,duration:1});
});

test('inspector derives animation state without conflating expressions behaviors and rigs',()=>{
 assert.equal(animationState({baseValue:1,keyframes:[]}), 'static');
 assert.equal(animationState({baseValue:1,keyframes:[{frame:0,value:1,interpolation:'linear'}]}),'keyframed');
 assert.equal(animationState({baseValue:1,keyframes:[],expression:{language:'flick-expr-v1',source:'time'}}),'expression');
 assert.equal(animationState({baseValue:1,keyframes:[],behaviors:[{id:'b',type:'drift',enabled:true,params:{}}]}),'behavior');
 assert.equal(animationState({baseValue:1,keyframes:[],rigBinding:{rigId:'r',controlId:'c'}}),'rig-linked');
});

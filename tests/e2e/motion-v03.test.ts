import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProjectV3 } from '../../packages/schema/src/index.ts';
import { evaluateMotionComposition } from '../../packages/motion/src/v3.ts';
import { projectPoint, motionBlurSampleFrames, interpolateSharedElement } from '../../packages/compositing/src/index.ts';
import { snapFrameToBeat, sampleAudioSignal } from '../../packages/audio-analysis/src/index.ts';
import { reviewMotionDesign } from '../../packages/design-qc/src/index.ts';
import { motionV03Project } from '../fixtures/motion-v03-project.ts';

test('premium v0.3 motion acceptance scene is deterministic, editable, responsive, spatial and audio-aware',()=>{
 const p=parseProjectV3(motionV03Project()),c=p.motionCompositions[0],analysis=p.audioAnalyses![0];
 const a=evaluateMotionComposition(c,30,{fps:30,audio:{energy:sampleAudioSignal(analysis,'energy',30)}}),b=evaluateMotionComposition(c,30,{fps:30,audio:{energy:sampleAudioSignal(analysis,'energy',30)}});assert.deepEqual(a,b);
 const title=a.layers.find(l=>l.id==='title')!;assert.ok(title.selectorWeights?.words.some(x=>x===1));assert.ok(title.opacity>.92&&title.opacity<=1);
 const panel=a.layers.find(l=>l.id==='panel')!,ui=a.layers.find(l=>l.id==='ui-surface')!;assert.equal(panel.masks[0].id,'panel-reveal');assert.equal(ui.matteSourceId,'ui-matte');
 const portraitScene=evaluateMotionComposition(c,30,{fps:30,surface:{width:1080,height:1920},audio:{energy:sampleAudioSignal(analysis,'energy',30)}});const landscapeScene=evaluateMotionComposition(c,30,{fps:30,surface:{width:1920,height:1080},audio:{energy:sampleAudioSignal(analysis,'energy',30)}});const portraitTitle=portraitScene.layers.find(l=>l.id==='title')!,landscapeTitle=landscapeScene.layers.find(l=>l.id==='title')!;assert.equal(portraitScene.width,1080);assert.equal(landscapeScene.width,1920);assert.notEqual(portraitTitle.bounds.x,landscapeTitle.bounds.x);
 const projected=projectPoint([0,0,0],{position:[0,0,1000],rotation:[0,0,0],focalLength:50},{width:1080,height:1920});assert.deepEqual(projected,[540,960,1000]);
 const blur=motionBlurSampleFrames(30,c.motionBlur!);assert.equal(blur.length,8);assert.ok(blur[0]<30&&blur.at(-1)!>30);
 const transition=c.sharedTransitions![0],source={bounds:{x:100,y:100,width:200,height:80},opacity:1,cornerRadius:20,position:[100,100,0] as const,scale:[1,1,1] as const,rotation:[0,0,0] as const},dest={bounds:{x:176,y:400,width:728,height:520},opacity:1,cornerRadius:32,position:[176,400,0] as const,scale:[1,1,1] as const,rotation:[0,0,0] as const};assert.deepEqual(interpolateSharedElement(source,dest,transition,30).state,source);assert.deepEqual(interpolateSharedElement(source,dest,transition,48).state,dest);
 assert.equal(snapFrameToBeat(analysis,29),30);assert.equal(sampleAudioSignal(analysis,'beat',30),1);
 const qc=reviewMotionDesign(p,'motion-ui');assert.equal(qc.blocking,false);assert.ok(qc.issues.every(i=>i.startFrame>=0&&i.endFrame>=i.startFrame&&i.message&&i.suggestion));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {planAnchorFrames,routeLocalShot} from '../src/index.ts';

test('anchor planner preserves endpoints and scene boundaries while filling large gaps',()=>{const p=planAnchorFrames({durationFrames:121,sceneStartFrames:[40,80],targetSpacingFrames:24,maxAnchors:7});assert.equal(p.frames[0],0);assert.equal(p.frames.at(-1),120);assert.ok(p.frames.includes(40));assert.ok(p.frames.includes(80));assert.ok(p.frames.length<=7);assert.ok(p.maxGapFrames<=40)});

test('router keeps simple motion deterministic and routes fluids to local video',()=>{assert.equal(routeLocalShot({id:'hero',kind:'push',cameraRotationDegrees:0,referenceImageCount:1},'cpu').strategy,'layered-2.5d');const fluid=routeLocalShot({id:'splash',kind:'fluid',fluidMotion:true,referenceImageCount:1,durationSeconds:4,resolution:'720p'},'standard-gpu');assert.equal(fluid.strategy,'local-video');assert.equal(fluid.requirements?.execution,'local');assert.equal(fluid.requirements?.video?.motionMasks,true)});

test('router blocks physically exact hidden-surface orbit from one product reference',()=>{const r=routeLocalShot({id:'orbit',kind:'orbit',cameraRotationDegrees:90,hiddenSurfaceReveal:true,referenceImageCount:1,requiresExactProductGeometry:true},'high-vram');assert.equal(r.strategy,'blocked');assert.equal(r.minimumReferenceImages,2);assert.match(r.reason,/single reference/i)});

test('cpu profile never silently substitutes fake parallax for complex synthesis',()=>{const r=routeLocalShot({id:'reflection',kind:'lighting-change',changingReflections:true,referenceImageCount:1},'cpu');assert.equal(r.strategy,'blocked');assert.match(r.diagnostics.join(' '),/do not silently/i)});

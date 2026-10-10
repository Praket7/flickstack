import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerationProviderRegistry, type GenerationProvider, type GenerationRequest, type ProviderCapabilityManifest } from '../src/index.ts';

const provider=(id:string,kinds:any[],extra:Partial<ProviderCapabilityManifest>={}):GenerationProvider=>({manifest:()=>({provider:id,kinds,execution:'cloud',supportsTransparency:false,supportsMasks:false,supportsReferences:false,supportsStreaming:false,supportsCancellation:true,...extra}),generate:async()=>({requestId:'r',provider:id,model:'m',outputs:[]})});
const req:GenerationRequest={id:'r',projectId:'p',kind:'image',inputAssetIds:[],parameters:{}};
const videoReq:GenerationRequest={id:'v',projectId:'p',kind:'video',inputAssetIds:['start'],parameters:{}};

test('registry rejects duplicates and resolves deterministic exact/capability matches',()=>{const r=new GenerationProviderRegistry();r.register(provider('b',['image']));r.register(provider('a',['image'],{supportsTransparency:true}));assert.throws(()=>r.register(provider('a',['image'])),/duplicate/i);assert.equal(r.resolve({...req,provider:'b'}).manifest().provider,'b');assert.equal(r.resolve(req,{supportsTransparency:true}).manifest().provider,'a');assert.deepEqual(r.list().map(x=>x.provider),['a','b'])});

test('selected provider never silently falls back and requirements are enforced',()=>{const r=new GenerationProviderRegistry();r.register(provider('a',['image']));r.register(provider('b',['video']));assert.throws(()=>r.resolve({...req,provider:'b'}),/cannot|capability|image/i);assert.throws(()=>r.resolve(req,{supportsMasks:true}),/no generation provider/i)});

test('video routing requires requested first/last frame controls and prefers local execution',()=>{
 const r=new GenerationProviderRegistry();
 const full={supportsFirstFrame:true,supportsLastFrame:true,maxReferenceImages:3,supportsNegativePrompt:true,supportsSeed:true,minDurationSeconds:2,maxDurationSeconds:15,supportedResolutions:['720p','1080p'],supportedAspectRatios:['16:9','9:16'],supportsCameraControl:true,supportsMotionMasks:true,supportsExtension:true,supportsNativeAudio:false};
 r.register(provider('a-cloud',['video'],{execution:'cloud',video:full}));
 r.register(provider('z-local',['video'],{execution:'local',video:full}));
 const selected=r.resolve(videoReq,{video:{firstFrame:true,lastFrame:true,durationSeconds:8,resolution:'720p',aspectRatio:'16:9'}});
 assert.equal(selected.manifest().provider,'z-local');
});

test('video routing rejects providers missing last-frame or reference capacity',()=>{
 const r=new GenerationProviderRegistry();
 r.register(provider('first-only',['video'],{execution:'local',video:{supportsFirstFrame:true,supportsLastFrame:false,maxReferenceImages:1,supportsNegativePrompt:true,supportsSeed:true,maxDurationSeconds:10,supportedResolutions:['720p'],supportsCameraControl:false,supportsMotionMasks:false,supportsExtension:false,supportsNativeAudio:false}}));
 assert.throws(()=>r.resolve(videoReq,{execution:'local',video:{firstFrame:true,lastFrame:true}}),/no generation provider/i);
 assert.throws(()=>r.resolve(videoReq,{execution:'local',video:{referenceImages:2}}),/no generation provider/i);
});

test('video routing enforces duration and resolution and exact selection never falls back',()=>{
 const r=new GenerationProviderRegistry();
 r.register(provider('local-short',['video'],{execution:'local',video:{supportsFirstFrame:true,supportsLastFrame:true,maxReferenceImages:3,supportsNegativePrompt:false,supportsSeed:true,minDurationSeconds:2,maxDurationSeconds:5,supportedResolutions:['480p'],supportedAspectRatios:['16:9'],supportsCameraControl:false,supportsMotionMasks:false,supportsExtension:false,supportsNativeAudio:false}}));
 r.register(provider('local-full',['video'],{execution:'local',video:{supportsFirstFrame:true,supportsLastFrame:true,maxReferenceImages:3,supportsNegativePrompt:true,supportsSeed:true,minDurationSeconds:2,maxDurationSeconds:12,supportedResolutions:['720p'],supportedAspectRatios:['16:9'],supportsCameraControl:true,supportsMotionMasks:true,supportsExtension:true,supportsNativeAudio:true}}));
 assert.equal(r.resolve(videoReq,{video:{durationSeconds:8,resolution:'720p',negativePrompt:true,cameraControl:true}}).manifest().provider,'local-full');
 assert.throws(()=>r.resolve({...videoReq,provider:'local-short'},{video:{durationSeconds:8,resolution:'720p'}}),/cannot|capability/i);
});

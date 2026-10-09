import type { FlickProjectV3, LayeredImageScene } from '../../schema/src/v3/project.ts';
export type SceneStrategy='direct-alpha'|'multilayer'|'segmentation-fallback'|'flattened-video';
export type CameraPreset='push-in'|'pull-out'|'pan-left'|'pan-right'|'orbit-subtle'|'static';
export interface GeneratedSceneRequest{id:string;sourceAssetId:string;compositionId:string;desiredLayerCount?:number;allowFlattenedVideo?:boolean;cameraPreset?:CameraPreset;durationFrames:number;strategyHint?:SceneStrategy}
export interface GeneratedScenePlan{requestId:string;strategy:SceneStrategy;sourceAssetId:string;requiredGenerationKinds:Array<'layer-decomposition'|'inpaint'|'depth'|'video'>;diagnostics:string[]}
export interface PlannedLayerMotion{dx:number;dy:number;dz?:number}
export interface PlannedSceneMotion{camera:{dx:number;dy:number;pushIn:number};layers:Record<string,PlannedLayerMotion>;preset?:CameraPreset;diagnostics?:string[]}
export interface OcclusionAssessment{needsCleanPlate:boolean;revealRiskByLayer:Record<string,number>;requiredInpaintMaskAssetIds:string[];diagnostics:string[]}
export interface LayerDepthInput{layerId:string;samples:number[]}
export interface LayerDepthPlacement{layerId:string;medianDepth:number;normalizedDepth:number;z:number}
export interface CameraSafetyEnvelope{maxTranslateX:number;maxTranslateY:number;maxPushIn:number;confidence:number}
export interface CameraSafetyInput{width:number;height:number;cleanPlateCoverage:number;depthConfidence:number}
export function validateGeneratedSceneRequest(project:FlickProjectV3,request:GeneratedSceneRequest):GeneratedSceneRequest{if(!request.id?.trim())throw new Error('Generated scene request id is required');if(!Number.isInteger(request.durationFrames)||request.durationFrames<=0)throw new Error('Generated scene duration must be a positive integer frame count');if(!project.assets.some(a=>a.id===request.sourceAssetId))throw new Error(`Unknown source asset ${request.sourceAssetId}`);if(request.desiredLayerCount!==undefined&&(!Number.isInteger(request.desiredLayerCount)||request.desiredLayerCount<1||request.desiredLayerCount>64))throw new Error('Desired layer count must be between 1 and 64');if(request.strategyHint==='flattened-video'&&request.allowFlattenedVideo!==true)throw new Error('Flattened video fallback must be explicitly allowed');return structuredClone(request)}
export function sceneLayer(scene:LayeredImageScene,id:string){const layer=scene.layers.find(x=>x.id===id);if(!layer)throw new Error(`Unknown generated scene layer ${id}`);return layer}

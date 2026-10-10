import type { GenerationKind } from '../../schema/src/v3/project.ts';
export interface GenerationBudget { maxUnits?:number; maxCostUsd?:number }
export interface VideoGenerationControls { firstFrameAssetId?:string; lastFrameAssetId?:string; referenceAssetIds?:string[]; negativePrompt?:string; durationSeconds?:number; resolution?:string; aspectRatio?:string; camera?:Record<string,unknown>; motionMaskAssetIds?:string[]; extendVideoAssetId?:string; candidateCount?:number; nativeAudio?:boolean }
export interface GenerationRequest { id:string; projectId:string; kind:GenerationKind; prompt?:string; inputAssetIds:string[]; parameters:Record<string,unknown>; video?:VideoGenerationControls; seed?:number|string; provider?:string; model?:string; previousResponseId?:string; budget?:GenerationBudget }

export interface VideoProviderCapabilities {
 supportsFirstFrame:boolean;
 supportsLastFrame:boolean;
 maxReferenceImages:number;
 supportsNegativePrompt:boolean;
 supportsSeed:boolean;
 minDurationSeconds?:number;
 maxDurationSeconds?:number;
 supportedResolutions?:string[];
 supportedAspectRatios?:string[];
 supportsCameraControl:boolean;
 supportsMotionMasks:boolean;
 supportsExtension:boolean;
 supportsNativeAudio:boolean;
}
export interface GenerationVideoRequirements {
 firstFrame?:boolean;
 lastFrame?:boolean;
 referenceImages?:number;
 negativePrompt?:boolean;
 seed?:boolean;
 durationSeconds?:number;
 resolution?:string;
 aspectRatio?:string;
 cameraControl?:boolean;
 motionMasks?:boolean;
 extension?:boolean;
 nativeAudio?:boolean;
}
export interface ProviderCapabilityManifest { provider:string; kinds:GenerationKind[]; execution:'local'|'cloud'; supportsTransparency:boolean; supportsMasks:boolean; supportsReferences:boolean; supportsStreaming:boolean; supportsCancellation:boolean; video?:VideoProviderCapabilities; models?:string[]; maxWidth?:number; maxHeight?:number; estimatedUnit?:'image'|'second'|'sample'|'token'; estimatedCostUnits?:number; metadata?:Record<string,unknown> }
export interface GenerationRequirements { execution?:'local'|'cloud'; supportsTransparency?:boolean; supportsMasks?:boolean; supportsReferences?:boolean; supportsStreaming?:boolean; supportsCancellation?:boolean; requireCommercialRights?:boolean; video?:GenerationVideoRequirements }
export interface GeneratedOutput { path:string; mediaType:string; sha256:string }
export interface GenerationUsage { units?:number; costUsd?:number }
export interface GenerationRights { commercialAllowed?:boolean|null; attributionRequired?:boolean; policy?:string }
export interface StagedGenerationOutput { requestId:string; provider:string; model:string; outputs:GeneratedOutput[]; usage?:GenerationUsage; rights?:GenerationRights; providerMetadata?:Record<string,unknown>; providerResponseId?:string; createdAt?:string }
export interface GenerationProvider { manifest():ProviderCapabilityManifest; generate(request:GenerationRequest,signal:AbortSignal):Promise<StagedGenerationOutput> }
export interface ResolvedGenerationInput { bytes:Uint8Array; mediaType:string; width?:number; height?:number }
export interface OpenAIImageProviderOptions { apiKey?:string; baseUrl?:string; fetchImpl?:typeof fetch; responseModel?:string; defaultModel?:string; defaultImageModel?:string; stagingRoot?:string; resolveInputAsset?:(assetId:string)=>ResolvedGenerationInput|Promise<ResolvedGenerationInput> }
export interface StructuredHttpProviderOptions { baseUrl:string; fetchImpl?:typeof fetch; stagingRoot?:string; resolveInputAsset:(assetId:string)=>ResolvedGenerationInput|Promise<ResolvedGenerationInput> }

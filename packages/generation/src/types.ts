import type { GenerationKind } from '../../schema/src/v3/project.ts';
export interface GenerationRequest { id:string; projectId:string; kind:GenerationKind; prompt?:string; inputAssetIds:string[]; parameters:Record<string,unknown>; seed?:number|string; provider?:string; model?:string; previousResponseId?:string }
export interface ProviderCapabilityManifest { provider:string; kinds:GenerationKind[]; execution:'local'|'cloud'; supportsTransparency:boolean; supportsMasks:boolean; supportsReferences:boolean; supportsStreaming:boolean; supportsCancellation:boolean; models?:string[]; maxWidth?:number; maxHeight?:number; estimatedCostUnits?:number; metadata?:Record<string,unknown> }
export interface GenerationRequirements { execution?:'local'|'cloud'; supportsTransparency?:boolean; supportsMasks?:boolean; supportsReferences?:boolean; supportsStreaming?:boolean; supportsCancellation?:boolean }
export interface GeneratedOutput { path:string; mediaType:string; sha256:string }
export interface GenerationUsage { units?:number; costUsd?:number }
export interface GenerationRights { commercialAllowed?:boolean|null; attributionRequired?:boolean; policy?:string }
export interface StagedGenerationOutput { requestId:string; provider:string; model:string; outputs:GeneratedOutput[]; usage?:GenerationUsage; rights?:GenerationRights; providerResponseId?:string; createdAt?:string }
export interface GenerationProvider { manifest():ProviderCapabilityManifest; generate(request:GenerationRequest,signal:AbortSignal):Promise<StagedGenerationOutput> }
export interface OpenAIImageProviderOptions { apiKey:string; baseUrl?:string; fetchImpl?:typeof fetch; responseModel?:string; defaultImageModel?:string; stagingRoot?:string }

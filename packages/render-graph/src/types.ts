export interface FrameRange { start:number; end:number }
export type RenderNodeKind=
 |'visual-source'|'composition-source'|'effect'|'composite'
 |'motion-source'|'motion-layer'|'text-scene'|'vector-scene'|'camera'|'matte'|'motion-blur'|'shared-transition'|'tracking-transform'|'compositing-node'|'audio-analysis'
 |'audio-source'|'audio-effect'|'audio-bus'|'audio-output'|'output';
export interface RenderNode { id:string; kind:RenderNodeKind; range:FrameRange; upstream:string[]; params:Record<string,unknown>; capabilityId?:string }
export interface RenderGraph { compositionId:string; nodes:RenderNode[]; outputNodeId:string; audioOutputNodeId?:string }
export interface RenderGraphDiagnostic { code:string; severity:'warning'|'error'; message:string; nodeId?:string }
export interface RenderInvalidation { ranges:FrameRange[]; changedNodeIds:string[]; downstreamNodeIds:string[]; cacheKeys:string[]; requiredQcIds:string[] }
export interface EffectTolerance { pixelRmse?:number; alphaRmse?:number; timingFrames?:number }
export interface EffectSupport { support:'native'|'approximate'|'unsupported'; tolerance?:EffectTolerance }
export interface RendererCapabilitySet { renderer:string; effects:Record<string,EffectSupport> }

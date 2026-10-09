import type { FrameRange, RenderGraph } from '../../render-graph/src/index.ts';
import type { PreviewCapabilities, PreviewFrame, PreviewRenderer } from '../../render-preview/src/index.ts';
export interface NativePreviewBridge {capabilities():Promise<PreviewCapabilities>;load(graph:RenderGraph):Promise<void>;seek(frame:number):Promise<PreviewFrame>;invalidate(range:FrameRange):Promise<void>;dispose():Promise<void>}
export class NativeGpuPreviewRenderer implements PreviewRenderer {private readonly bridge:NativePreviewBridge;constructor(bridge:NativePreviewBridge){this.bridge=bridge;}capabilities(){return this.bridge.capabilities();}load(g:RenderGraph){return this.bridge.load(g);}seek(frame:number){return this.bridge.seek(frame);}invalidate(r:FrameRange){return this.bridge.invalidate(r);}dispose(){return this.bridge.dispose();}}

export * from './bridge.ts';

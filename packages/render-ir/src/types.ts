import type { RenderGraph } from '../../render-graph/src/types.ts';
import type { AudioAnalysisRecord, MotionComposition, MotionLayer, SharedTransition } from '../../schema/src/v3/project.ts';

export interface RenderProgramLimits {
  maxLayers:number;
  maxPathPoints:number;
  maxMasks:number;
  maxEffectNodes:number;
  maxTextureDimension:number;
}
export const DEFAULT_RENDER_PROGRAM_LIMITS:RenderProgramLimits={
  maxLayers:4096,
  maxPathPoints:1_000_000,
  maxMasks:16384,
  maxEffectNodes:32768,
  maxTextureDimension:16384,
};
export interface RenderProgramAsset { id:string; kind:string; path:string; duration:number; hash?:string; metadata?:Record<string,unknown> }
export interface RenderProgramV1 {
  version:1;
  projectVersion:3;
  projectId:string;
  target:{compositionId:string};
  surface:{width:number;height:number;fps:number;durationFrames:number;background:string};
  layers:MotionLayer[];
  cameraId?:string;
  compositingGraph?:MotionComposition['compositingGraph'];
  layoutVariants?:MotionComposition['layoutVariants'];
  motionBlur?:MotionComposition['motionBlur'];
  graph:RenderGraph;
  assets:RenderProgramAsset[];
  audioAnalyses:AudioAnalysisRecord[];
  transitions:SharedTransition[];
  limits:RenderProgramLimits;
}

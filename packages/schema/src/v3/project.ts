import type { FrameTick } from '../project.ts';
import type {
  BlendMode,
  CurveHandle,
  EffectInstance,
  FlickProjectV2,
} from '../v2/project.ts';

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Rect = Readonly<{ x:number; y:number; width:number; height:number }>;
export type MotionColor = string;
export type MotionInterpolation =
  | 'hold' | 'linear' | 'bezier' | 'auto-bezier' | 'continuous-bezier' | 'ease'
  | 'expo-in' | 'expo-out' | 'expo-in-out' | 'spring' | 'damped-overshoot';

export interface MotionDimensionTangents { inTangent?:CurveHandle; outTangent?:CurveHandle }
export interface MotionKeyframe<T> {
  frame: FrameTick;
  value: T;
  interpolation: MotionInterpolation;
  inTangent?: CurveHandle;
  outTangent?: CurveHandle;
  dimensionTangents?: Partial<Record<'x'|'y'|'z',MotionDimensionTangents>>;
  spatialInTangent?: Vec3;
  spatialOutTangent?: Vec3;
  roving?: boolean;
}

export interface MotionExpression {
  source: string;
  mode?: 'replace'|'add'|'multiply';
  maxOperations?: number;
}

export interface MotionBehaviorInstance {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
  seed?: number;
  estimatedCost?: number;
  bakeable?: boolean;
}

export interface AnimatedProperty<T> {
  baseValue: T;
  keyframes?: MotionKeyframe<T>[];
  behaviors?: MotionBehaviorInstance[];
  expression?: MotionExpression;
}

export interface MotionTransform3D {
  position: AnimatedProperty<Vec3>;
  anchor: AnimatedProperty<Vec3>;
  scale: AnimatedProperty<Vec3>;
  rotation: AnimatedProperty<Vec3>;
  orientation?: AnimatedProperty<Vec3>;
}

export type LayoutConstraintType =
  | 'pin-left'|'pin-right'|'pin-top'|'pin-bottom'|'center-x'|'center-y'
  | 'width'|'height'|'min-width'|'max-width'|'min-height'|'max-height'
  | 'aspect-fit'|'aspect-fill'|'safe-area'|'parent-percent'|'stack-row'|'stack-column'
  | 'gap'|'align';

export interface LayoutConstraint {
  id: string;
  type: LayoutConstraintType;
  value?: number|string|Vec2;
  targetLayerId?: string;
  dependsOn?: string[];
  priority?: number;
}

export type AspectClass = 'landscape'|'portrait'|'square'|'four-five'|'custom';
export interface LayoutVariantRule {
  aspect: AspectClass;
  constraintsByLayer: Record<string, LayoutConstraint[]>;
}

export interface TextStyle {
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number|string;
  fontSize: AnimatedProperty<number>;
  lineHeight?: AnimatedProperty<number>;
  tracking?: AnimatedProperty<number>;
  baselineShift?: AnimatedProperty<number>;
  horizontalAlign?: 'left'|'center'|'right'|'justify';
  verticalAlign?: 'top'|'middle'|'bottom';
  fill?: AnimatedProperty<MotionColor>;
  stroke?: AnimatedProperty<MotionColor>;
  strokeWidth?: AnimatedProperty<number>;
  variableAxes?: Record<string, number>;
  openTypeFeatures?: Record<string, boolean>;
  textPathLayerId?: string;
  paragraphBox?: Rect;
}

export type TextSelector =
  | { id:string; type:'characters'|'words'|'lines'; start?:number; end?:number; feather?:number }
  | { id:string; type:'index-range'; start:number; end:number; feather?:number }
  | { id:string; type:'percent-range'; start:number; end:number; feather?:number }
  | { id:string; type:'regex'; pattern:string; flags?:string }
  | { id:string; type:'seeded-random'; probability:number; seed:number };

export interface TextAnimator {
  id: string;
  selectorIds: string[];
  position?: AnimatedProperty<Vec3>;
  scale?: AnimatedProperty<Vec3>;
  rotation?: AnimatedProperty<Vec3>;
  opacity?: AnimatedProperty<number>;
  blur?: AnimatedProperty<number>;
  tracking?: AnimatedProperty<number>;
  fill?: AnimatedProperty<MotionColor>;
  strokeWidth?: AnimatedProperty<number>;
}

export type ShapeGeometry =
  | { kind:'rect'; width:number; height:number; radius?:number }
  | { kind:'ellipse'; rx:number; ry:number }
  | { kind:'polygon'; points:Vec2[] }
  | { kind:'star'; points:number; innerRadius:number; outerRadius:number; rotation?:number }
  | { kind:'line'; from:Vec2; to:Vec2 }
  | { kind:'path'; points:Array<{point:Vec2; in?:Vec2; out?:Vec2}>; closed:boolean };

export interface ShapeStyle {
  fill?: AnimatedProperty<MotionColor>;
  fillGradient?: { type:'linear'|'radial'; stops:Array<{offset:number;color:string}>; from:Vec2; to:Vec2 };
  stroke?: AnimatedProperty<MotionColor>;
  strokeWidth?: AnimatedProperty<number>;
  lineCap?: 'butt'|'round'|'square';
  lineJoin?: 'miter'|'round'|'bevel';
  dash?: number[];
  opacity?: AnimatedProperty<number>;
}

export interface MotionMaskDefinition {
  id:string;
  kind:'rect'|'ellipse'|'path';
  geometry: ShapeGeometry;
  feather: AnimatedProperty<number>;
  expansion: AnimatedProperty<number>;
  invert:boolean;
  combine:'add'|'subtract'|'intersect'|'difference';
}

export interface MotionMatte {
  sourceLayerId:string;
  mode:'alpha'|'alpha-inverted'|'luma'|'luma-inverted';
}

export interface CameraDefinition {
  focalLength: AnimatedProperty<number>;
  fieldOfView?: AnimatedProperty<number>;
  focusDistance?: AnimatedProperty<number>;
  aperture?: AnimatedProperty<number>;
  depthOfField?: AnimatedProperty<number>;
  nearClip?: number;
  farClip?: number;
}

export interface MotionBlurSettings {
  enabled:boolean;
  shutterAngle:number;
  shutterPhase:number;
  samples:number;
  quality:'preview'|'balanced'|'final';
}

export interface IndexContext {
  index:number;
  count:number;
  depth:number;
  normalized:number;
  seed:number;
}
export type ReplicatorDistribution =
  | {kind:'grid';columns:number;rows?:number;spacing:Vec2}
  | {kind:'radial';radius:number;startAngle:number;endAngle:number}
  | {kind:'path';points:Vec2[];closed?:boolean};
export interface ReplicatorDefinition {
  id:string;
  count:number;
  distribution:ReplicatorDistribution;
  positionOffset?:Vec3;
  rotationOffset?:Vec3;
  scaleOffset?:Vec3;
  timeOffsetFrames?:number;
  seed:number;
}
export type FalloffGraphType='linear'|'smoothstep'|'ease-in'|'ease-out';
export interface FalloffDefinition {
  id:string;
  kind:'circle'|'rect'|'linear'|'sweep'|'path';
  center?:Vec2;
  size?:Vec2;
  radius?:number;
  rotation?:number;
  path?:Vec2[];
  graph?:{type:FalloffGraphType;invert?:boolean};
  combine?:'multiply'|'add'|'max'|'min';
  strength?:number;
}
export interface ParticleDefinition {
  id:string;
  rate:number;
  lifetimeFrames:number;
  maxParticles?:number;
  seed:number;
  position?:Vec3;
  velocity:Vec3;
  velocityVariance?:Vec3;
  gravity?:Vec3;
  scale?:readonly [number,number];
  rotation?:readonly [number,number];
  color?:readonly [string,string];
}

export type MotionLayerKind='group'|'null'|'text'|'shape'|'image'|'video'|'composition'|'camera'|'adjustment'|'particle';
export interface MotionLayer {
  id:string;
  kind:MotionLayerKind;
  name:string;
  start:FrameTick;
  duration:FrameTick;
  parentId?:string;
  enabled:boolean|AnimatedProperty<boolean>;
  locked:boolean;
  zIndex:number;
  blendMode?:BlendMode;
  transform:MotionTransform3D;
  opacity:AnimatedProperty<number>;
  effects:EffectInstance[];
  masks:MotionMaskDefinition[];
  matte?:MotionMatte;
  layout?:LayoutConstraint[];
  motionBlur:boolean;
  text?:string;
  textStyle?:TextStyle;
  textSelectors?:TextSelector[];
  textAnimators?:TextAnimator[];
  shape?:ShapeGeometry;
  shapeStyle?:ShapeStyle;
  assetId?:string;
  compositionId?:string;
  motionCompositionId?:string;
  camera?:CameraDefinition;
  componentId?:string;
  replicator?:ReplicatorDefinition;
  falloffs?:FalloffDefinition[];
  particle?:ParticleDefinition;
  props?:Record<string,unknown>;
}

export interface SharedElementBinding {
  id:string;
  sourceLayerId:string;
  destinationLayerId:string;
  properties:Array<'bounds'|'transform'|'corner-radius'|'mask'|'opacity'|'style'>;
}
export interface SharedTransition {
  id:string;
  kind:'hard-cut'|'crossfade'|'shared-element'|'match-geometry'|'camera-continuation'|'depth-reveal'|'focus-handoff'|'motion-match';
  start:FrameTick;
  duration:FrameTick;
  sourceCompositionId?:string;
  destinationCompositionId?:string;
  bindings?:SharedElementBinding[];
  params?:Record<string,unknown>;
}

export type CompositingNodeKind='source'|'layer'|'transform'|'blur'|'directional-blur'|'glow'|'shadow'|'color'|'mask'|'matte'|'blend'|'composite'|'displacement'|'noise'|'sharpen'|'vignette'|'output';
export interface CompositingNode { id:string; kind:CompositingNodeKind; inputs:string[]; params:Record<string,unknown>; enabled?:boolean }
export interface CompositingNodeGroup {id:string;name:string;nodeIds:string[]}
export interface MotionCompositingGraph { nodes:CompositingNode[]; outputNodeId:string; groups?:CompositingNodeGroup[] }

export interface PublishedControl {
  id:string;
  name:string;
  type:'number'|'boolean'|'enum'|'color'|'text'|'asset'|'point';
  defaultValue:unknown;
  min?:number;
  max?:number;
  options?:string[];
}
export interface MotionRigBinding {
  controlId:string;
  layerId:string;
  propertyPath:string;
  inputRange?:readonly [number,number];
  outputRange?:readonly [number,number];
  curve?:string;
}
export interface MotionRigDefinition { id:string; name:string; controls:PublishedControl[]; bindings:MotionRigBinding[]; version:number }

export interface MotionComposition {
  id:string;
  name:string;
  width:number;
  height:number;
  duration:FrameTick;
  background:string;
  layers:MotionLayer[];
  cameraId?:string;
  compositingGraph?:MotionCompositingGraph;
  rigId?:string;
  publishedControls?:PublishedControl[];
  layoutVariants?:LayoutVariantRule[];
  sharedTransitions?:SharedTransition[];
  motionBlur?:MotionBlurSettings;
}

export interface SoundCueDefinition { id:string; frame:FrameTick; event:'click'|'send'|'impact'|'success'|'panel-open'|'whoosh'|string; assetId?:string; gainDb?:number }
export interface MotionComponentDefinition {
  id:string;
  name:string;
  category:string;
  version:number;
  composition:MotionComposition;
  rigId?:string;
  responsiveVariants?:AspectClass[];
  soundCues?:SoundCueDefinition[];
  provenance?:{creator?:string;sourceUrl?:string;license?:string};
  preview?:{thumbnailAssetId?:string;posterFrame?:number};
}

export interface AudioAnalysisRecord {
  id:string;
  assetId:string;
  sourceHash:string;
  algorithm:string;
  algorithmVersion:string;
  fps:number;
  beats:FrameTick[];
  downbeats:FrameTick[];
  onsets?:Array<{frame:FrameTick;strength:number}>;
  phrases?:Array<{start:FrameTick;end:FrameTick;label?:string}>;
  silence?:Array<{start:FrameTick;end:FrameTick}>;
  envelopes?:Record<'energy'|'low'|'mid'|'high'|'speech',Array<{frame:FrameTick;value:number}>>;
}

export interface TrackingRecord {
  id:string;
  assetId?:string;
  sourceHash?:string;
  algorithm:string;
  algorithmVersion:string;
  kind:'point'|'planar'|'corner-pin'|'stabilization'|'mask'|'object'|'camera-3d'|'surface';
  supported:boolean;
  confidence?:number;
  keyframes:Array<{frame:FrameTick;value:unknown;confidence?:number}>;
  diagnostics?:string[];
}

export interface MotionStyleDefinition {
  id:string;
  name:string;
  durationFrames?:number;
  curve:{type:MotionInterpolation;inTangent?:CurveHandle;outTangent?:CurveHandle;params?:Record<string,number>};
  metadata?:Record<string,unknown>;
}

export type FlickProjectV3 = Omit<FlickProjectV2,'version'> & {
  version:3;
  motionCompositions:MotionComposition[];
  motionComponents:MotionComponentDefinition[];
  motionRigs:MotionRigDefinition[];
  audioAnalyses?:AudioAnalysisRecord[];
  motionStyles:MotionStyleDefinition[];
  trackingData?:TrackingRecord[];
  layoutTokens?:Record<string,unknown>;
  motionTokens?:Record<string,unknown>;
  typographyTokens?:Record<string,unknown>;
  legacyMetadata?:Record<string,unknown>;
};

export const animated = <T>(baseValue:T):AnimatedProperty<T> => ({baseValue});
export const defaultMotionTransform = ():MotionTransform3D => ({
  position:animated<Vec3>([0,0,0]),
  anchor:animated<Vec3>([0,0,0]),
  scale:animated<Vec3>([1,1,1]),
  rotation:animated<Vec3>([0,0,0]),
});

import { assertNoCredentialFields } from '../secrets.ts';
import { parseProject } from '../project.ts';
import { parseProjectV2 } from '../v2/parse.ts';
import { migrateV1ToV2 } from '../migrations/v1-to-v2.ts';
import { migrateV2ToV3 } from '../migrations/v2-to-v3.ts';
import type {
  AnimatedProperty,
  FlickProjectV3,
  LayoutConstraint,
  MotionComposition,
  MotionLayer,
  MotionRigDefinition,
  ReplicatorDefinition,
  FalloffDefinition,
  ParticleDefinition,
} from './project.ts';

function invariant(condition:unknown,message:string):asserts condition { if(!condition) throw new TypeError(message); }
function record(value:unknown): value is Record<string,unknown> { return typeof value==='object'&&value!==null&&!Array.isArray(value); }
function animatedProperty(value:unknown):value is AnimatedProperty<unknown>{return record(value)&&Object.prototype.hasOwnProperty.call(value,'baseValue');}
function finite(value:unknown,path:string):void {
  if(typeof value==='number') invariant(Number.isFinite(value),`${path} must be finite`);
  else if(Array.isArray(value)) value.forEach((v,i)=>finite(v,`${path}[${i}]`));
  else if(record(value)) for(const [k,v] of Object.entries(value)) finite(v,`${path}.${k}`);
}
function positiveInt(value:unknown,path:string):void { invariant(typeof value==='number'&&Number.isInteger(value)&&value>0,`${path} must be a positive integer`); }
function nonNegativeInt(value:unknown,path:string):void { invariant(typeof value==='number'&&Number.isInteger(value)&&value>=0,`${path} must be a non-negative integer`); }
const MOTION_INTERPOLATIONS=new Set(['hold','linear','bezier','auto-bezier','continuous-bezier','ease','expo-in','expo-out','expo-in-out','spring','damped-overshoot']);

type MotionValueValidator=(value:unknown,path:string)=>void;
function numberValue(value:unknown,path:string):void {invariant(typeof value==='number'&&Number.isFinite(value),`${path} must be number`);}
function booleanValue(value:unknown,path:string):void {invariant(typeof value==='boolean',`${path} must be boolean`);}
function stringValue(value:unknown,path:string):void {invariant(typeof value==='string',`${path} must be string`);}
function vec3Value(value:unknown,path:string):void {invariant(Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v)),`${path} must be vec3`);}
function validateProperty(prop:unknown,path:string,validateValue?:MotionValueValidator):void {
  invariant(animatedProperty(prop),`${path} must be an animated property`);
  const p=prop;
  finite(p.baseValue,`${path}.baseValue`);validateValue?.(p.baseValue,`${path}.baseValue`);
  if(p.keyframes!==undefined){
    invariant(Array.isArray(p.keyframes),`${path}.keyframes must be an array`);
    let previous=-1;
    for(let i=0;i<p.keyframes.length;i++){
      const k=p.keyframes[i]; nonNegativeInt(k.frame,`${path}.keyframes[${i}].frame`);
      invariant(MOTION_INTERPOLATIONS.has(k.interpolation),`${path}.keyframes[${i}].interpolation is invalid`);
      invariant(k.frame>=previous,`${path}.keyframes must be sorted by frame`); previous=k.frame;
      finite(k.value,`${path}.keyframes[${i}].value`);validateValue?.(k.value,`${path}.keyframes[${i}].value`);
      if(typeof p.baseValue==='boolean'||typeof p.baseValue==='string') invariant(k.interpolation==='hold',`${path} discrete properties support hold interpolation only`);
    }
  }
  if(p.expression){
    invariant(typeof p.expression.source==='string'&&p.expression.source.length<=4096,`${path}.expression source is invalid or unbounded`);
    if(p.expression.maxOperations!==undefined) invariant(Number.isInteger(p.expression.maxOperations)&&p.expression.maxOperations>0&&p.expression.maxOperations<=10_000,`${path}.expression work must be bounded`);
  }
  if(p.behaviors){
    invariant(p.behaviors.length<=128,`${path}.behaviors exceeds limit`);
    for(const behavior of p.behaviors) finite(behavior.params,`${path}.behavior.params`);
  }
}


const MAX_PROCEDURAL_INSTANCES=10_000,MAX_PARTICLES=50_000;
function vec2(value:unknown,path:string):void {invariant(Array.isArray(value)&&value.length===2&&value.every(v=>typeof v==='number'&&Number.isFinite(v)),`${path} must be vec2`);}
function validateReplicator(def:ReplicatorDefinition,path:string):void {
  invariant(record(def),`${path} must be object`);invariant(typeof def.id==='string'&&def.id.length>0,`${path}.id required`);
  positiveInt(def.count,`${path}.count`);invariant(def.count<=MAX_PROCEDURAL_INSTANCES,`${path}.count exceeds 10000 instance budget`);
  invariant(Number.isInteger(def.seed),`${path}.seed must be integer`);if(def.timeOffsetFrames!==undefined)numberValue(def.timeOffsetFrames,`${path}.timeOffsetFrames`);
  if(def.positionOffset!==undefined)vec3Value(def.positionOffset,`${path}.positionOffset`);if(def.rotationOffset!==undefined)vec3Value(def.rotationOffset,`${path}.rotationOffset`);if(def.scaleOffset!==undefined)vec3Value(def.scaleOffset,`${path}.scaleOffset`);
  const d=def.distribution;invariant(record(d),`${path}.distribution required`);
  if(d.kind==='grid'){positiveInt(d.columns,`${path}.distribution.columns`);if(d.rows!==undefined)positiveInt(d.rows,`${path}.distribution.rows`);vec2(d.spacing,`${path}.distribution.spacing`);if(d.rows!==undefined)invariant(d.columns*d.rows>=def.count,`${path}.distribution grid is smaller than count`);}
  else if(d.kind==='radial'){numberValue(d.radius,`${path}.distribution.radius`);invariant(d.radius>=0,`${path}.distribution.radius must be non-negative`);numberValue(d.startAngle,`${path}.distribution.startAngle`);numberValue(d.endAngle,`${path}.distribution.endAngle`);}
  else if(d.kind==='path'){invariant(Array.isArray(d.points)&&d.points.length>=2,`${path}.distribution.path points must contain at least two points`);d.points.forEach((v,i)=>vec2(v,`${path}.distribution.points[${i}]`));}
  else invariant(false,`${path}.distribution kind invalid`);
}
function validateFalloff(def:FalloffDefinition,path:string):void {
  invariant(record(def),`${path} must be object`);invariant(typeof def.id==='string'&&def.id.length>0,`${path}.id required`);invariant(['circle','rect','linear','sweep','path'].includes(def.kind),`${path}.kind invalid`);
  if(def.center!==undefined)vec2(def.center,`${path}.center`);if(def.size!==undefined)vec2(def.size,`${path}.size`);if(def.radius!==undefined){numberValue(def.radius,`${path}.radius`);invariant(def.radius>0,`${path}.radius must be positive`);}if(def.rotation!==undefined)numberValue(def.rotation,`${path}.rotation`);if(def.strength!==undefined)numberValue(def.strength,`${path}.strength`);
  if(def.kind==='path'){invariant(Array.isArray(def.path)&&def.path.length>=2,`${path}.path must contain at least two points`);def.path.forEach((v,i)=>vec2(v,`${path}.path[${i}]`));}
  if(def.graph)invariant(['linear','smoothstep','ease-in','ease-out'].includes(def.graph.type),`${path}.graph type invalid`);if(def.combine)invariant(['multiply','add','max','min'].includes(def.combine),`${path}.combine invalid`);
}
function validateParticle(def:ParticleDefinition,path:string):void {
  invariant(record(def),`${path} must be object`);invariant(typeof def.id==='string'&&def.id.length>0,`${path}.id required`);numberValue(def.rate,`${path}.rate`);invariant(def.rate>=0,`${path}.rate must be non-negative`);positiveInt(def.lifetimeFrames,`${path}.lifetimeFrames`);invariant(Number.isInteger(def.seed),`${path}.seed must be integer`);
  if(def.maxParticles!==undefined){positiveInt(def.maxParticles,`${path}.maxParticles`);invariant(def.maxParticles<=MAX_PARTICLES,`${path}.maxParticles exceeds 50000 particle budget`);}if(def.position!==undefined)vec3Value(def.position,`${path}.position`);vec3Value(def.velocity,`${path}.velocity`);if(def.velocityVariance!==undefined)vec3Value(def.velocityVariance,`${path}.velocityVariance`);if(def.gravity!==undefined)vec3Value(def.gravity,`${path}.gravity`);
  if(def.scale!==undefined)invariant(Array.isArray(def.scale)&&def.scale.length===2&&def.scale.every(v=>typeof v==='number'&&Number.isFinite(v)),`${path}.scale must be numeric pair`);if(def.rotation!==undefined)invariant(Array.isArray(def.rotation)&&def.rotation.length===2&&def.rotation.every(v=>typeof v==='number'&&Number.isFinite(v)),`${path}.rotation must be numeric pair`);if(def.color!==undefined)invariant(Array.isArray(def.color)&&def.color.length===2&&def.color.every(v=>typeof v==='string'),`${path}.color must be color pair`);
}

function validateConstraints(constraints:LayoutConstraint[]|undefined,layerIds:Set<string>,path:string):void {
  if(!constraints) return;
  invariant(Array.isArray(constraints),`${path} must be an array`);
  const ids=new Set<string>();
  for(const c of constraints){
    invariant(typeof c.id==='string'&&c.id.length>0,`${path} constraint id required`);
    invariant(!ids.has(c.id),`${path} duplicate constraint id ${c.id}`); ids.add(c.id);
    if(c.targetLayerId) invariant(layerIds.has(c.targetLayerId),`${path} unknown target layer ${c.targetLayerId}`);
    finite(c.value,`${path}.${c.id}.value`);
  }
  const byId=new Map(constraints.map(c=>[c.id,c]));
  const visiting=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{ if(done.has(id))return; invariant(!visiting.has(id),`${path} constraint dependency cycle involving ${id}`); visiting.add(id); for(const d of byId.get(id)?.dependsOn??[]) { invariant(byId.has(d),`${path} missing constraint dependency ${d}`); visit(d); } visiting.delete(id); done.add(id); };
  for(const c of constraints) visit(c.id);
}

function validateLayer(layer:MotionLayer,composition:MotionComposition,layerIds:Set<string>,componentIds:Set<string>,path:string):void {
  invariant(typeof layer.id==='string'&&layer.id.length>0,`${path}.id required`);
  invariant(typeof layer.name==='string',`${path}.name required`);
  nonNegativeInt(layer.start,`${path}.start`); positiveInt(layer.duration,`${path}.duration`);
  invariant(layer.start+layer.duration<=composition.duration,`${path} lifetime exceeds composition duration`);
  invariant(Number.isInteger(layer.zIndex),`${path}.zIndex must be integer`);
  validateProperty(layer.transform.position,`${path}.transform.position`,vec3Value);
  validateProperty(layer.transform.anchor,`${path}.transform.anchor`,vec3Value);
  validateProperty(layer.transform.scale,`${path}.transform.scale`,vec3Value);
  validateProperty(layer.transform.rotation,`${path}.transform.rotation`,vec3Value);
  if(layer.transform.orientation) validateProperty(layer.transform.orientation,`${path}.transform.orientation`,vec3Value);
  validateProperty(layer.opacity,`${path}.opacity`,numberValue);
  if(record(layer.enabled)) validateProperty(layer.enabled,`${path}.enabled`,booleanValue);else invariant(typeof layer.enabled==='boolean',`${path}.enabled must be boolean`);
  if(layer.parentId) invariant(layerIds.has(layer.parentId),`${path} unknown parent ${layer.parentId}`);
  if(layer.matte) invariant(layerIds.has(layer.matte.sourceLayerId),`${path} missing matte layer ${layer.matte.sourceLayerId}`);
  if(layer.componentId) invariant(componentIds.has(layer.componentId),`${path} missing component ${layer.componentId}`);
  if(layer.kind==='camera') invariant(Boolean(layer.camera),`${path} camera layer requires camera properties`);
  if(layer.textStyle){
    validateProperty(layer.textStyle.fontSize,`${path}.textStyle.fontSize`,numberValue);
    if(layer.textStyle.lineHeight)validateProperty(layer.textStyle.lineHeight,`${path}.textStyle.lineHeight`,numberValue);
    if(layer.textStyle.tracking)validateProperty(layer.textStyle.tracking,`${path}.textStyle.tracking`,numberValue);
  }
  if(layer.textStyle?.baselineShift)validateProperty(layer.textStyle.baselineShift,`${path}.textStyle.baselineShift`,numberValue);
  if(layer.textStyle?.fill)validateProperty(layer.textStyle.fill,`${path}.textStyle.fill`,stringValue);
  if(layer.textStyle?.stroke)validateProperty(layer.textStyle.stroke,`${path}.textStyle.stroke`,stringValue);
  if(layer.textStyle?.strokeWidth)validateProperty(layer.textStyle.strokeWidth,`${path}.textStyle.strokeWidth`,numberValue);
  for(const animator of layer.textAnimators??[]){
    invariant(typeof animator.id==='string'&&animator.id.length>0,`${path}.textAnimator id required`);invariant(Array.isArray(animator.selectorIds),`${path}.textAnimator ${animator.id}.selectorIds must be array`);
    if(animator.position)validateProperty(animator.position,`${path}.textAnimator.${animator.id}.position`,vec3Value);if(animator.scale)validateProperty(animator.scale,`${path}.textAnimator.${animator.id}.scale`,vec3Value);if(animator.rotation)validateProperty(animator.rotation,`${path}.textAnimator.${animator.id}.rotation`,vec3Value);
    if(animator.opacity)validateProperty(animator.opacity,`${path}.textAnimator.${animator.id}.opacity`,numberValue);if(animator.blur)validateProperty(animator.blur,`${path}.textAnimator.${animator.id}.blur`,numberValue);if(animator.tracking)validateProperty(animator.tracking,`${path}.textAnimator.${animator.id}.tracking`,numberValue);if(animator.fill)validateProperty(animator.fill,`${path}.textAnimator.${animator.id}.fill`,stringValue);if(animator.strokeWidth)validateProperty(animator.strokeWidth,`${path}.textAnimator.${animator.id}.strokeWidth`,numberValue);
  }
  if(layer.shapeStyle){if(layer.shapeStyle.fill)validateProperty(layer.shapeStyle.fill,`${path}.shapeStyle.fill`,stringValue);if(layer.shapeStyle.stroke)validateProperty(layer.shapeStyle.stroke,`${path}.shapeStyle.stroke`,stringValue);if(layer.shapeStyle.strokeWidth)validateProperty(layer.shapeStyle.strokeWidth,`${path}.shapeStyle.strokeWidth`,numberValue);if(layer.shapeStyle.opacity)validateProperty(layer.shapeStyle.opacity,`${path}.shapeStyle.opacity`,numberValue);finite(layer.shapeStyle,`${path}.shapeStyle`);}
  if(layer.camera){validateProperty(layer.camera.focalLength,`${path}.camera.focalLength`,numberValue);if(layer.camera.fieldOfView)validateProperty(layer.camera.fieldOfView,`${path}.camera.fieldOfView`,numberValue);if(layer.camera.focusDistance)validateProperty(layer.camera.focusDistance,`${path}.camera.focusDistance`,numberValue);if(layer.camera.aperture)validateProperty(layer.camera.aperture,`${path}.camera.aperture`,numberValue);if(layer.camera.depthOfField)validateProperty(layer.camera.depthOfField,`${path}.camera.depthOfField`,numberValue);if(layer.camera.nearClip!==undefined)numberValue(layer.camera.nearClip,`${path}.camera.nearClip`);if(layer.camera.farClip!==undefined)numberValue(layer.camera.farClip,`${path}.camera.farClip`);if(layer.camera.nearClip!==undefined&&layer.camera.farClip!==undefined)invariant(layer.camera.nearClip<layer.camera.farClip,`${path}.camera clip range is invalid`);}
  for(const mask of layer.masks??[]){ validateProperty(mask.feather,`${path}.mask.${mask.id}.feather`,numberValue); validateProperty(mask.expansion,`${path}.mask.${mask.id}.expansion`,numberValue); }
  if(layer.replicator)validateReplicator(layer.replicator,`${path}.replicator`);
  for(let i=0;i<(layer.falloffs?.length??0);i++)validateFalloff(layer.falloffs![i],`${path}.falloffs[${i}]`);
  if(layer.particle)validateParticle(layer.particle,`${path}.particle`);
  if(layer.kind==='particle')invariant(Boolean(layer.particle),`${path} particle layer requires particle definition`);
  validateConstraints(layer.layout,layerIds,`${path}.layout`);
  finite(layer.effects,`${path}.effects`);
}

function validateComposition(comp:MotionComposition,allCompositions:Set<string>,componentIds:Set<string>):void {
  invariant(typeof comp.id==='string'&&comp.id.length>0,'motion composition id required');
  positiveInt(comp.width,`motion composition ${comp.id}.width`); positiveInt(comp.height,`motion composition ${comp.id}.height`); positiveInt(comp.duration,`motion composition ${comp.id}.duration`);
  invariant(Array.isArray(comp.layers),`motion composition ${comp.id}.layers must be array`);
  const ids=new Set<string>();
  for(const layer of comp.layers){ invariant(!ids.has(layer.id),`duplicate layer id ${layer.id} in motion composition ${comp.id}`); ids.add(layer.id); }
  for(let i=0;i<comp.layers.length;i++) validateLayer(comp.layers[i],comp,ids,componentIds,`motionCompositions.${comp.id}.layers[${i}]`);
  const byId=new Map(comp.layers.map(l=>[l.id,l]));
  for(const layer of comp.layers){
    const seen=new Set<string>(); let current:MotionLayer|undefined=layer;
    while(current?.parentId){ invariant(!seen.has(current.parentId)&&current.parentId!==layer.id,`parent cycle involving layer ${layer.id}`); seen.add(current.parentId); current=byId.get(current.parentId); }
  }
  const matteVisiting=new Set<string>(),matteDone=new Set<string>();
  const visitMatte=(id:string)=>{if(matteDone.has(id))return;invariant(!matteVisiting.has(id),`matte cycle involving layer ${id}`);matteVisiting.add(id);const source=byId.get(id)?.matte?.sourceLayerId;if(source)visitMatte(source);matteVisiting.delete(id);matteDone.add(id);};
  for(const layer of comp.layers)visitMatte(layer.id);
  if(comp.cameraId){ const camera=byId.get(comp.cameraId); invariant(camera?.kind==='camera',`camera ${comp.cameraId} is missing or not a camera layer`); }
  if(comp.rigId) invariant(typeof comp.rigId==='string',`motion composition ${comp.id}.rigId invalid`);
  for(const layer of comp.layers) if(layer.motionCompositionId) invariant(allCompositions.has(layer.motionCompositionId),`missing motion composition ${layer.motionCompositionId}`);
  const transitionIds=new Set<string>();
  for(const transition of comp.sharedTransitions??[]){
    invariant(typeof transition.id==='string'&&transition.id.length>0,`transition id required in ${comp.id}`);
    invariant(!transitionIds.has(transition.id),`duplicate transition ${transition.id} in ${comp.id}`);transitionIds.add(transition.id);
    nonNegativeInt(transition.start,`transition ${transition.id}.start`);positiveInt(transition.duration,`transition ${transition.id}.duration`);
    invariant(transition.start+transition.duration<=comp.duration,`transition ${transition.id} lifetime exceeds composition duration`);
    if(transition.sourceCompositionId)invariant(transition.sourceCompositionId===comp.id||allCompositions.has(transition.sourceCompositionId),`transition ${transition.id} missing source composition ${transition.sourceCompositionId}`);
    if(transition.destinationCompositionId)invariant(transition.destinationCompositionId===comp.id||allCompositions.has(transition.destinationCompositionId),`transition ${transition.id} missing destination composition ${transition.destinationCompositionId}`);
    const bindingIds=new Set<string>();
    for(const binding of transition.bindings??[]){
      invariant(typeof binding.id==='string'&&binding.id.length>0,`transition ${transition.id} binding id required`);invariant(!bindingIds.has(binding.id),`duplicate transition binding ${binding.id}`);bindingIds.add(binding.id);
      if(!transition.sourceCompositionId||transition.sourceCompositionId===comp.id)invariant(ids.has(binding.sourceLayerId),`transition ${transition.id} missing source layer ${binding.sourceLayerId}`);
      if(!transition.destinationCompositionId||transition.destinationCompositionId===comp.id)invariant(ids.has(binding.destinationLayerId),`transition ${transition.id} missing destination layer ${binding.destinationLayerId}`);
      invariant(Array.isArray(binding.properties)&&binding.properties.length>0,`transition ${transition.id} binding ${binding.id} properties required`);
    }
    finite(transition.params,`transition ${transition.id}.params`);
  }
  if(comp.compositingGraph){
    const graphIds=new Set(comp.compositingGraph.nodes.map(n=>n.id));
    invariant(graphIds.size===comp.compositingGraph.nodes.length,`duplicate compositing node in ${comp.id}`);
    invariant(graphIds.has(comp.compositingGraph.outputNodeId),`missing compositing output ${comp.compositingGraph.outputNodeId}`);
    const graphById=new Map(comp.compositingGraph.nodes.map(n=>[n.id,n]));
    for(const node of comp.compositingGraph.nodes)for(const input of node.inputs)invariant(graphIds.has(input),`missing compositing input ${input} for ${node.id} in ${comp.id}`);
    const visiting=new Set<string>(),done=new Set<string>();
    const visit=(id:string)=>{if(done.has(id))return;invariant(!visiting.has(id),`compositing cycle involving ${id} in ${comp.id}`);visiting.add(id);for(const input of graphById.get(id)?.inputs??[])visit(input);visiting.delete(id);done.add(id);};
    for(const node of comp.compositingGraph.nodes)visit(node.id);
  }
  for(const variant of comp.layoutVariants??[]){
    invariant(variant&&record(variant.constraintsByLayer),`layout variant ${variant?.aspect??'unknown'} in ${comp.id} is invalid`);
    for(const [layerId,constraints] of Object.entries(variant.constraintsByLayer)){invariant(ids.has(layerId),`layout variant ${variant.aspect} references missing layer ${layerId}`);validateConstraints(constraints,ids,`motionCompositions.${comp.id}.layoutVariants.${variant.aspect}.${layerId}`);}
  }
}

function validateRigDefinition(rig:MotionRigDefinition):void {
  invariant(typeof rig.id==='string'&&rig.id.length>0,`motion rig id required`);invariant(typeof rig.name==='string'&&rig.name.length>0,`motion rig ${rig.id}.name required`);positiveInt(rig.version,`motion rig ${rig.id}.version`);
  invariant(Array.isArray(rig.controls)&&Array.isArray(rig.bindings),`motion rig ${rig.id} controls/bindings must be arrays`);
  const controls=new Set<string>();for(const c of rig.controls){
    invariant(typeof c.id==='string'&&c.id.length>0,`motion rig ${rig.id} control id required`);invariant(!controls.has(c.id),`duplicate motion rig control ${c.id}`);controls.add(c.id);
    invariant(['number','boolean','enum','color','text','asset','point'].includes(c.type),`motion rig ${rig.id} control ${c.id} type is invalid`);
    if(c.type==='number'){invariant(typeof c.defaultValue==='number'&&Number.isFinite(c.defaultValue),`motion rig ${rig.id} control ${c.id} must be number`);if(c.min!==undefined)invariant(Number.isFinite(c.min),`motion rig ${rig.id} control ${c.id} min must be finite`);if(c.max!==undefined)invariant(Number.isFinite(c.max),`motion rig ${rig.id} control ${c.id} max must be finite`);if(c.min!==undefined&&c.max!==undefined)invariant(c.min<=c.max,`motion rig ${rig.id} control ${c.id} range is invalid`);if(c.min!==undefined)invariant(c.defaultValue>=c.min,`motion rig ${rig.id} control ${c.id} default is below min`);if(c.max!==undefined)invariant(c.defaultValue<=c.max,`motion rig ${rig.id} control ${c.id} default is above max`);}
    else if(c.type==='boolean')invariant(typeof c.defaultValue==='boolean',`motion rig ${rig.id} control ${c.id} must be boolean`);
    else if(c.type==='enum'){invariant(Array.isArray(c.options)&&c.options.length>0&&c.options.every(x=>typeof x==='string'),`motion rig ${rig.id} control ${c.id} enum options required`);invariant(typeof c.defaultValue==='string'&&c.options.includes(c.defaultValue),`motion rig ${rig.id} control ${c.id} enum default is invalid`);}
    else if(c.type==='point')invariant(Array.isArray(c.defaultValue)&&c.defaultValue.length===2&&c.defaultValue.every(x=>typeof x==='number'&&Number.isFinite(x)),`motion rig ${rig.id} control ${c.id} must be point`);
    else invariant(typeof c.defaultValue==='string',`motion rig ${rig.id} control ${c.id} must be string`);
  }
  for(const b of rig.bindings){invariant(controls.has(b.controlId),`motion rig ${rig.id} missing control ${b.controlId}`);invariant(typeof b.layerId==='string'&&b.layerId.length>0,`motion rig ${rig.id} binding layer required`);invariant(/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/.test(b.propertyPath),`motion rig ${rig.id} binding property path invalid`);finite(b.inputRange,`motion rig ${rig.id}.${b.controlId}.inputRange`);finite(b.outputRange,`motion rig ${rig.id}.${b.controlId}.outputRange`);}
}

function validateCompositionCycles(comps:MotionComposition[]):void {
  const byId=new Map(comps.map(c=>[c.id,c])); const done=new Set<string>(); const visiting=new Set<string>();
  const visit=(id:string)=>{ if(done.has(id))return; invariant(!visiting.has(id),`motion composition reference cycle involving ${id}`); visiting.add(id); const c=byId.get(id); if(c) for(const l of c.layers) if(l.motionCompositionId) visit(l.motionCompositionId); visiting.delete(id); done.add(id); };
  for(const c of comps) visit(c.id);
}

function validateCrossCompositionTransitionRefs(comps:MotionComposition[]):void {
  const byId=new Map(comps.map(c=>[c.id,c]));
  for(const owner of comps)for(const transition of owner.sharedTransitions??[]){
    const source=transition.sourceCompositionId?byId.get(transition.sourceCompositionId):owner;
    const destination=transition.destinationCompositionId?byId.get(transition.destinationCompositionId):owner;
    if(!source||!destination)continue;
    const sourceLayers=new Set(source.layers.map(l=>l.id)),destinationLayers=new Set(destination.layers.map(l=>l.id));
    for(const binding of transition.bindings??[]){
      invariant(sourceLayers.has(binding.sourceLayerId),`transition ${transition.id} missing source layer ${binding.sourceLayerId} in ${source.id}`);
      invariant(destinationLayers.has(binding.destinationLayerId),`transition ${transition.id} missing destination layer ${binding.destinationLayerId} in ${destination.id}`);
    }
  }
}

function validateComponentCycles(components:FlickProjectV3['motionComponents']):void {
  const byId=new Map(components.map(component=>[component.id,component])),visiting=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{
    if(done.has(id))return;invariant(!visiting.has(id),`motion component cycle involving ${id}`);visiting.add(id);
    const component=byId.get(id);if(component)for(const layer of component.composition.layers)if(layer.componentId)visit(layer.componentId);
    visiting.delete(id);done.add(id);
  };
  for(const component of components)visit(component.id);
}

export function parseProjectV3(input:unknown):FlickProjectV3 {
  invariant(record(input),'project must be an object');
  invariant(input.version===3,'project.version must be 3');
  const clone=structuredClone(input) as FlickProjectV3;
  const v2like={...clone,version:2};
  delete (v2like as Record<string,unknown>).motionCompositions;
  delete (v2like as Record<string,unknown>).motionComponents;
  delete (v2like as Record<string,unknown>).motionRigs;
  delete (v2like as Record<string,unknown>).audioAnalyses;
  delete (v2like as Record<string,unknown>).motionStyles;
  delete (v2like as Record<string,unknown>).trackingData;
  delete (v2like as Record<string,unknown>).layoutTokens;
  delete (v2like as Record<string,unknown>).motionTokens;
  delete (v2like as Record<string,unknown>).typographyTokens;
  delete (v2like as Record<string,unknown>).legacyMetadata;
  parseProjectV2(v2like);
  invariant(Array.isArray(clone.motionCompositions),'motionCompositions must be array');
  invariant(Array.isArray(clone.motionComponents),'motionComponents must be array');
  invariant(Array.isArray(clone.motionRigs),'motionRigs must be array');
  invariant(Array.isArray(clone.motionStyles),'motionStyles must be array');
  const compIds=new Set<string>(); for(const c of clone.motionCompositions){invariant(!compIds.has(c.id),`duplicate motion composition id ${c.id}`);compIds.add(c.id);}
  const componentIds=new Set<string>(); for(const c of clone.motionComponents){invariant(!componentIds.has(c.id),`duplicate motion component id ${c.id}`);componentIds.add(c.id);}
  for(const c of clone.motionCompositions) validateComposition(c,compIds,componentIds);
  validateCompositionCycles(clone.motionCompositions);
  validateCrossCompositionTransitionRefs(clone.motionCompositions);
  const rigIds=new Set(clone.motionRigs.map(r=>r.id)); invariant(rigIds.size===clone.motionRigs.length,'duplicate motion rig id');
  for(const rig of clone.motionRigs)validateRigDefinition(rig);
  const rigById=new Map(clone.motionRigs.map(r=>[r.id,r]));
  for(const c of clone.motionCompositions) if(c.rigId){invariant(rigIds.has(c.rigId),`missing motion rig ${c.rigId}`);const layerIds=new Set(c.layers.map(l=>l.id));for(const b of rigById.get(c.rigId)?.bindings??[])invariant(layerIds.has(b.layerId),`motion rig ${c.rigId} references missing layer ${b.layerId} in ${c.id}`);}
  for(const component of clone.motionComponents){
    invariant(typeof component.id==='string'&&component.id.length>0,`motion component id required`);invariant(typeof component.name==='string'&&component.name.length>0,`motion component ${component.id}.name required`);positiveInt(component.version,`motion component ${component.id}.version`);
    validateComposition(component.composition,compIds,componentIds);
    if(component.rigId&&component.composition.rigId)invariant(component.rigId===component.composition.rigId,`motion component ${component.id} rig mismatch`);
    const componentRigId=component.rigId??component.composition.rigId;
    if(componentRigId){invariant(rigIds.has(componentRigId),`motion component ${component.id} missing rig ${componentRigId}`);const layerIds=new Set(component.composition.layers.map(l=>l.id));for(const b of rigById.get(componentRigId)?.bindings??[])invariant(layerIds.has(b.layerId),`motion rig ${componentRigId} references missing layer ${b.layerId} in component ${component.id}`);}
    for(const cue of component.soundCues??[]){nonNegativeInt(cue.frame,`motion component ${component.id} sound cue frame`);invariant(cue.frame<component.composition.duration,`motion component ${component.id} sound cue exceeds duration`);}
  }
  validateComponentCycles(clone.motionComponents);
  finite(clone.motionTokens,'motionTokens'); finite(clone.layoutTokens,'layoutTokens'); finite(clone.typographyTokens,'typographyTokens');
  assertNoCredentialFields(clone);
  return clone;
}

export function parseAnyProjectV3(input:unknown):FlickProjectV3 {
  invariant(record(input),'project must be an object');
  const version=input.version;
  if(version===3)return parseProjectV3(input);
  if(version===2)return parseProjectV3(migrateV2ToV3(parseProjectV2(input)));
  if(version===1)return parseProjectV3(migrateV2ToV3(migrateV1ToV2(parseProject(input))));
  throw new TypeError(`unsupported project version ${String(version)}`);
}

export function serializeProjectV3(project:FlickProjectV3):string {
  assertNoCredentialFields(project);
  return JSON.stringify(parseProjectV3(project),null,2)+'\n';
}

import type { MotionRigDefinition, PublishedControl } from '../../schema/src/v3/project.ts';

export interface ResolvedRigBinding { controlId:string; layerId:string; propertyPath:string; value:unknown }
function validateControlValue(c:PublishedControl,value:unknown):void {
  switch(c.type){
    case 'number':if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`control ${c.id} must be number`);if(c.min!==undefined&&value<c.min||c.max!==undefined&&value>c.max)throw new Error(`control ${c.id} out of range`);break;
    case 'boolean':if(typeof value!=='boolean')throw new Error(`control ${c.id} must be boolean`);break;
    case 'enum':if(typeof value!=='string'||!c.options?.includes(value))throw new Error(`control ${c.id} enum value is invalid`);break;
    case 'color':case 'text':case 'asset':if(typeof value!=='string')throw new Error(`control ${c.id} must be string`);break;
    case 'point':if(!Array.isArray(value)||value.length<2||!value.every(Number.isFinite))throw new Error(`control ${c.id} must be point`);break;
  }
}
export function validateRig(rig:MotionRigDefinition):void {
  if(!rig.id||!rig.name||!Number.isInteger(rig.version)||rig.version<1)throw new Error('invalid rig identity');
  const ids=new Set<string>();for(const c of rig.controls){if(ids.has(c.id))throw new Error(`duplicate rig control ${c.id}`);ids.add(c.id);validateControlValue(c,c.defaultValue);}
  for(const b of rig.bindings)if(!ids.has(b.controlId))throw new Error(`missing rig control ${b.controlId}`);
}
function remap(value:number,input:readonly[number,number],output:readonly[number,number]):number {const span=input[1]-input[0];const t=span===0?0:(value-input[0])/span;return output[0]+(output[1]-output[0])*Math.max(0,Math.min(1,t));}
export function resolveRigControls(rig:MotionRigDefinition,values:Record<string,unknown>):ResolvedRigBinding[] {
  validateRig(rig);const controls=new Map(rig.controls.map(c=>[c.id,c]));const resolved=new Map<string,unknown>();
  for(const c of rig.controls){const v=Object.prototype.hasOwnProperty.call(values,c.id)?values[c.id]:c.defaultValue;validateControlValue(c,v);resolved.set(c.id,v);}
  return rig.bindings.map(b=>{const c=controls.get(b.controlId)!,raw=resolved.get(b.controlId);let value=raw;if(typeof raw==='number'&&b.inputRange&&b.outputRange)value=remap(raw,b.inputRange,b.outputRange);return{controlId:c.id,layerId:b.layerId,propertyPath:b.propertyPath,value};});
}

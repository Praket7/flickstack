import { parseProject, type FlickProject } from '../project.ts';
import type { FlickProjectV2 } from './project.ts';
import { migrateV1ToV2 } from '../migrations/v1-to-v2.ts';
import { assertNoCredentialFields } from '../secrets.ts';

function invariant(c:unknown,m:string):asserts c { if(!c) throw new TypeError(m); }
export function parseProjectV2(input:unknown):FlickProjectV2 {
 invariant(typeof input==='object'&&input!==null&&!Array.isArray(input),'project must be an object');
 const p=input as Partial<FlickProjectV2>;
 invariant(p.version===2,'project.version must be 2');
 invariant(typeof p.id==='string'&&p.id.length>0,'id must be non-empty');
 invariant(typeof p.name==='string'&&p.name.length>0,'name must be non-empty');
 invariant(p.format && Number.isInteger(p.format.width)&&Number.isInteger(p.format.height),'format is invalid');
 invariant(Array.isArray(p.assets),'assets must be array'); invariant(Array.isArray(p.compositions),'compositions must be array');
 invariant(typeof p.rootCompositionId==='string','rootCompositionId required'); invariant(p.compositions.some(c=>c.id===p.rootCompositionId),'root composition missing');
 invariant(Array.isArray(p.audioBuses),'audioBuses must be array'); invariant(Array.isArray(p.multicamGroups),'multicamGroups must be array');
 return structuredClone(p as FlickProjectV2);
}
export function parseAnyProject(input:unknown):FlickProjectV2 {
  if (typeof input==='object'&&input!==null&&(input as {version?:unknown}).version===1) return migrateV1ToV2(parseProject(input) as FlickProject);
  return parseProjectV2(input);
}
export function serializeProjectV2(project:FlickProjectV2):string { assertNoCredentialFields(project); return JSON.stringify(parseProjectV2(project),null,2)+'\n'; }

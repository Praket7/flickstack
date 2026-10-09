import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,rmSync } from 'node:fs';
import { extname,join,resolve,sep } from 'node:path';
import type { GeneratedOutput,StagedGenerationOutput } from './types.ts';
export function sha256File(path:string):string{return createHash('sha256').update(readFileSync(path)).digest('hex')}
function ext(mediaType:string,path:string):string{const byType:Record<string,string>={'image/png':'.png','image/webp':'.webp','image/jpeg':'.jpg','video/mp4':'.mp4','audio/wav':'.wav','audio/mpeg':'.mp3'};return byType[mediaType]??extname(path)??'.bin'}
export function stageProviderOutput(output:StagedGenerationOutput,root:string,jobId:string):StagedGenerationOutput{const dir=join(resolve(root),jobId);mkdirSync(dir,{recursive:true});const outputs:GeneratedOutput[]=output.outputs.map((o,i)=>{if(!existsSync(o.path))throw new Error(`Provider output missing: ${o.path}`);const hash=sha256File(o.path),target=join(dir,`${String(i).padStart(2,'0')}-${hash}${ext(o.mediaType,o.path)}`);if(resolve(o.path)!==resolve(target))copyFileSync(o.path,target);return{path:target,mediaType:o.mediaType,sha256:hash}});return{...structuredClone(output),outputs,createdAt:output.createdAt??new Date().toISOString()}}
export function removeStagedOutput(output:StagedGenerationOutput|undefined,root:string):void{if(!output)return;const base=resolve(root)+sep;for(const o of output.outputs){const p=resolve(o.path);if(p.startsWith(base))rmSync(p,{force:true})}}

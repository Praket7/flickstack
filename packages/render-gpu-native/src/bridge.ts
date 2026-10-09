import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RenderProgramV1 } from '../../render-ir/src/types.ts';
export type NativeRenderBackend='cpu'|'gpu'|'auto';
export interface NativeRenderRequest{program:RenderProgramV1;output:string;backend?:NativeRenderBackend;binary?:string}
export function nativeRenderArgs(programPath:string,output:string,backend:NativeRenderBackend='auto'):string[]{return['render','--program',programPath,'--output',output,'--backend',backend];}
export function renderNativeProgram(req:NativeRenderRequest):string{mkdirSync(dirname(req.output),{recursive:true});const programPath=`${req.output}.render-program.json`;writeFileSync(programPath,JSON.stringify(req.program));const binary=req.binary??process.env.FLICK_RENDER_BIN??'flick-render';const r=spawnSync(binary,nativeRenderArgs(programPath,req.output,req.backend??'auto'),{encoding:'utf8'});if(r.error)throw new Error(`native render unavailable: ${r.error.message}`);if(r.status!==0)throw new Error(`native render failed: ${(r.stderr||r.stdout||'').slice(-4000)}`);return req.output;}
export function selectRenderPipeline(projectVersion:number):'legacy-ffmpeg'|'native-v04'{return projectVersion>=3?'native-v04':'legacy-ffmpeg';}

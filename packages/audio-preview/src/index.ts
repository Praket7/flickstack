import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2 } from '../../schema/src/v2/project.ts';
import { renderProjectV2 } from '../../render-ffmpeg/src/v2.ts';

export interface AudioPreviewOptions { startFrame?:number; endFrame?:number; sampleFormat?:'s16'|'f32' }
const fps=(p:FlickProjectV2)=>p.format.fps.numerator/p.format.fps.denominator;

/**
 * Correctness-first local audio preview. It renders through the canonical v2
 * FFmpeg backend and decodes that exact master mix to PCM, guaranteeing that
 * preview and final export share bus/effect semantics. A later low-latency
 * backend can replace the transport while keeping this as the equivalence oracle.
 */
export function renderAudioPreview(project:FlickProjectV2,output:string,options:AudioPreviewOptions={}):string {
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-audio-preview-'));
 try{
  const reference=join(dir,'reference.mp4');renderProjectV2(project,reference);
  const start=Math.max(0,options.startFrame??0)/fps(project);const totalFrames=options.endFrame===undefined?undefined:Math.max(0,options.endFrame-(options.startFrame??0));
  const args=['-y','-hide_banner','-loglevel','error'];if(start>0)args.push('-ss',String(start));args.push('-i',reference,'-vn');if(totalFrames!==undefined)args.push('-t',String(totalFrames/fps(project)));
  const format=options.sampleFormat??'s16';args.push('-ar',String(project.format.audioSampleRate),'-c:a',format==='f32'?'pcm_f32le':'pcm_s16le',output);
  const r=spawnSync('ffmpeg',args,{encoding:'utf8',timeout:240000});if(r.error)throw r.error;if(r.status!==0)throw new Error(`Audio preview render failed: ${r.stderr}`);return output;
 } finally { rmSync(dir,{recursive:true,force:true}); }
}

export class FfmpegAudioPreviewRenderer {
 private readonly project:FlickProjectV2;
 constructor(project:FlickProjectV2){this.project=project;}
 render(output:string,options:AudioPreviewOptions={}){return renderAudioPreview(this.project,output,options);}
}

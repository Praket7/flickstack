import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { Clip, FlickProject } from '../../schema/src/project.ts';
import { probeMedia } from '../../media/src/ingest.ts';
import { motionComponents, SvgMotionRenderer, type MotionGraph } from '../../motion/src/index.ts';

export interface RenderSegment {
 clipId:string; trackId:string; assetId:string; path:string;
 sourceInSeconds:number; durationSeconds:number; timelineStartSeconds:number; hasAudio:boolean; speed:number;
}
export interface RenderPlan { width:number;height:number;fps:number;segments:RenderSegment[];durationSeconds:number }

function fps(project:FlickProject):number { return project.format.fps.numerator/project.format.fps.denominator; }
function sec(frames:number, project:FlickProject):number { return frames/fps(project); }

export function buildRenderPlan(project:FlickProject):RenderPlan {
  const videoTracks=project.tracks.filter(t=>t.kind==='video');
  if(!videoTracks.length) throw new Error('Project has no video track');
  const assets=new Map(project.assets.map(a=>[a.id,a]));
  const clips=videoTracks.flatMap(t=>t.clips.map(c=>({track:t,clip:c}))).sort((a,b)=>a.clip.start-b.clip.start);
  const segments:RenderSegment[]=clips.map(({track,clip})=>{
    if(!clip.assetId) throw new Error(`Video clip ${clip.id} has no assetId`);
    const asset=assets.get(clip.assetId); if(!asset) throw new Error(`Missing asset ${clip.assetId} for clip ${clip.id}`);
    if(!existsSync(asset.path) && !asset.path.startsWith('/tmp/')) throw new Error(`Missing media path ${asset.path}`);
    const hasAudio=existsSync(asset.path)?Boolean(probeMedia(asset.path).audio):false;
    return {clipId:clip.id,trackId:track.id,assetId:asset.id,path:asset.path,sourceInSeconds:sec(clip.sourceIn,project),durationSeconds:sec(clip.duration,project),timelineStartSeconds:sec(clip.start,project),hasAudio,speed:clip.speed??1};
  });
  for(let i=1;i<segments.length;i++) {
    const prev=segments[i-1]; const cur=segments[i];
    if(cur.timelineStartSeconds+1e-8 < prev.timelineStartSeconds+prev.durationSeconds) throw new Error(`Render plan has overlap between ${prev.clipId} and ${cur.clipId}`);
  }
  const durationSeconds=segments.reduce((m,s)=>Math.max(m,s.timelineStartSeconds+s.durationSeconds),0);
  return {width:project.format.width,height:project.format.height,fps:fps(project),segments,durationSeconds};
}

function graphForClip(clip:Clip):MotionGraph|undefined {
  if(!clip.component) return undefined;
  const factory=motionComponents[clip.component as keyof typeof motionComponents];
  if(!factory) return undefined;
  return factory((clip.props??{}) as {title?:string;subtitle?:string;value?:number;accent?:string});
}

function writeMotionSequence(graph:MotionGraph,clip:Clip,directory:string):string {
  const renderer=new SvgMotionRenderer();
  const pattern=join(directory,'frame-%06d.svg');
  for(let i=0;i<clip.duration;i++) {
    const sourceFrame=Math.min(graph.duration-1,Math.floor((i/Math.max(1,clip.duration))*graph.duration));
    writeFileSync(join(directory,`frame-${String(i).padStart(6,'0')}.svg`),renderer.renderFrame(graph,sourceFrame));
  }
  return pattern;
}

function escapeDrawtext(value:string):string {
  return value.replace(/\\/g,'\\\\').replace(/:/g,'\\:').replace(/'/g,"\\'").replace(/%/g,'\\%');
}

function atempoChain(speed:number):string {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`Invalid clip speed ${speed}`);
  const factors:number[]=[]; let remaining=speed;
  while(remaining>2){ factors.push(2); remaining/=2; }
  while(remaining<0.5){ factors.push(0.5); remaining/=0.5; }
  factors.push(remaining);
  return factors.map(v=>`atempo=${v.toFixed(8).replace(/0+$/,'').replace(/\.$/,'')}`).join(',');
}

export function renderProject(project:FlickProject, output:string):string {
  const plan=buildRenderPlan(project); if(!plan.segments.length) throw new Error('Nothing to render');
  mkdirSync(dirname(output),{recursive:true});
  const work=mkdtempSync(join(tmpdir(),'flicksmith-render-'));
  try {
    const args:string[]=['-y'];
    for(const s of plan.segments) args.push('-ss',s.sourceInSeconds.toFixed(6),'-t',(s.durationSeconds*s.speed).toFixed(6),'-i',s.path);

    const assets=new Map(project.assets.map(a=>[a.id,a]));
    const audioClips=project.tracks.filter(t=>t.kind==='audio'&&!t.muted).flatMap(t=>t.clips.map(c=>({track:t,clip:c}))).filter(x=>x.clip.assetId);
    const audioInputs:{clip:Clip;inputIndex:number}[]=[];
    for(const {clip} of audioClips){
      const asset=assets.get(clip.assetId!); if(!asset||!existsSync(asset.path)) continue;
      const index=plan.segments.length+audioInputs.length;
      args.push('-ss',sec(clip.sourceIn,project).toFixed(6),'-t',sec(clip.duration,project).toFixed(6),'-i',asset.path);
      audioInputs.push({clip,inputIndex:index});
    }

    const motionClips=project.tracks.filter(t=>t.kind==='motion'&&!t.muted).flatMap(t=>t.clips).filter(c=>graphForClip(c));
    const motionInputs:{clip:Clip;inputIndex:number}[]=[];
    for(let i=0;i<motionClips.length;i++){
      const clip=motionClips[i],graph=graphForClip(clip)!; const dir=join(work,`motion-${i}`); mkdirSync(dir,{recursive:true}); const pattern=writeMotionSequence(graph,clip,dir);
      const index=plan.segments.length+audioInputs.length+motionInputs.length;
      args.push('-framerate',plan.fps.toFixed(6),'-start_number','0','-i',pattern);
      motionInputs.push({clip,inputIndex:index});
    }

    const filters:string[]=[]; const refs:string[]=[];
    let cursor=0, gapIndex=0;
    for(let i=0;i<plan.segments.length;i++){
      const s=plan.segments[i];
      const gap=s.timelineStartSeconds-cursor;
      if(gap>1e-6){
        filters.push(`color=c=black:s=${plan.width}x${plan.height}:r=${plan.fps.toFixed(6)}:d=${gap.toFixed(6)}[vg${gapIndex}]`);
        filters.push(`anullsrc=r=${project.format.audioSampleRate}:cl=stereo,atrim=duration=${gap.toFixed(6)},asetpts=PTS-STARTPTS[ag${gapIndex}]`);
        refs.push(`[vg${gapIndex}][ag${gapIndex}]`); gapIndex++;
      }
      filters.push(`[${i}:v]scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${plan.fps.toFixed(6)},setpts=(PTS-STARTPTS)/${s.speed.toFixed(8)},trim=duration=${s.durationSeconds.toFixed(6)},setpts=PTS-STARTPTS[v${i}]`);
      if(s.hasAudio) filters.push(`[${i}:a]aresample=${project.format.audioSampleRate},asetpts=PTS-STARTPTS,${atempoChain(s.speed)},atrim=duration=${s.durationSeconds.toFixed(6)},asetpts=PTS-STARTPTS[a${i}]`);
      else filters.push(`anullsrc=r=${project.format.audioSampleRate}:cl=stereo,atrim=duration=${s.durationSeconds.toFixed(6)},asetpts=PTS-STARTPTS[a${i}]`);
      refs.push(`[v${i}][a${i}]`); cursor=s.timelineStartSeconds+s.durationSeconds;
    }
    filters.push(`${refs.join('')}concat=n=${refs.length}:v=1:a=1[vbase][abase]`);

    let videoLabel='vbase';
    motionInputs.forEach(({clip,inputIndex},i)=>{
      filters.push(`[${inputIndex}:v]scale=${plan.width}:${plan.height},format=rgba,setpts=PTS-STARTPTS+${sec(clip.start,project).toFixed(6)}/TB[m${i}]`);
      const next=`vm${i}`; filters.push(`[${videoLabel}][m${i}]overlay=eof_action=pass:shortest=0[${next}]`); videoLabel=next;
    });

    const captions=project.tracks.filter(t=>t.kind==='caption'&&!t.muted).flatMap(t=>t.clips).filter(c=>c.text);
    captions.forEach((clip,i)=>{
      const next=`vc${i}`,start=sec(clip.start,project),end=sec(clip.start+clip.duration,project),fontSize=Math.max(18,Math.round(plan.height*0.045));
      filters.push(`[${videoLabel}]drawtext=text='${escapeDrawtext(clip.text!)}':fontcolor=white:fontsize=${fontSize}:box=1:boxcolor=black@0.65:boxborderw=12:x=(w-text_w)/2:y=h*0.82:enable='between(t,${start.toFixed(6)},${end.toFixed(6)})'[${next}]`); videoLabel=next;
    });

    let audioLabel='abase';
    if(audioInputs.length){
      const mixRefs=[`[${audioLabel}]`];
      audioInputs.forEach(({clip,inputIndex},i)=>{
        const delay=Math.round(sec(clip.start,project)*1000),volume=clip.volume??1;
        filters.push(`[${inputIndex}:a]aresample=${project.format.audioSampleRate},volume=${volume},adelay=${delay}|${delay}[ax${i}]`); mixRefs.push(`[ax${i}]`);
      });
      filters.push(`${mixRefs.join('')}amix=inputs=${mixRefs.length}:duration=longest:normalize=0[amix]`); audioLabel='amix';
    }

    args.push('-filter_complex',filters.join(';'),'-map',`[${videoLabel}]`,'-map',`[${audioLabel}]`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-t',plan.durationSeconds.toFixed(6),output);
    const result=spawnSync('ffmpeg',args,{encoding:'utf8',timeout:240_000});
    if(result.error) throw new Error(`FFmpeg render failed: ${result.error.message}`);
    if(result.status!==0) throw new Error(`FFmpeg render failed: ${(result.stderr||'').slice(-6000)}`);
    return output;
  } finally { rmSync(work,{recursive:true,force:true}); }
}

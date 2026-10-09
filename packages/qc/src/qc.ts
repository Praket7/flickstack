import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { FlickProject } from '../../schema/src/project.ts';
import { probeMedia } from '../../media/src/ingest.ts';
import type {MotionQCReport} from '../../design-qc/src/motion-analysis.ts';

export type QCIssueType='missing_media'|'black_frames'|'frozen_frames'|'caption_overflow'|'missing_attribution'|'render_failure'|'dead_air'|'audio_clipping'|'loudness'|'extreme_crop'|'duplicate_shot'|'static_motion_ratio'|'inactive_shot'|'dead_space'|'readability_projection'|'focal_competition'|'end_card_hold'|'cut_only_energy'|'motion_density'|'single_plane_motion'|'ui_occupancy'|'safe_area_spacing';
export type QCSeverity='info'|'warning'|'error';
export interface QCIssue {id:string;type:QCIssueType;severity:QCSeverity;startFrame:number;endFrame:number;message:string;suggestion:string;clipId?:string;assetId?:string;layerIds?:string[]}
export interface QCResult {issues:QCIssue[];blocking:boolean;renderPath:string}
export interface RepairPlan {branchName:string;range:{startFrame:number;endFrame:number};intent:string;issueId:string;suggestedAction:string}

function fps(p:FlickProject):number{return p.format.fps.numerator/p.format.fps.denominator;}
function issueId(type:string,start:number,end:number,index:number):string{return `qc_${type}_${start}_${end}_${index}`;}
function frame(seconds:number,project:FlickProject):number{return Math.max(0,Math.round(seconds*fps(project)));}
function push(issues:QCIssue[],issue:Omit<QCIssue,'id'>):void{issues.push({id:issueId(issue.type,issue.startFrame,issue.endFrame,issues.length),...issue});}

function runFfmpeg(args:string[]):string {
 const r=spawnSync('ffmpeg',['-hide_banner',...args],{encoding:'utf8',timeout:90_000});
 if(r.error)throw new Error(r.error.message);
 return r.stderr||'';
}

export function reviewRender(renderPath:string,project:FlickProject):QCResult{
 const issues:QCIssue[]=[];
 for(const asset of project.assets){if(!existsSync(asset.path)){push(issues,{type:'missing_media',severity:'error',startFrame:0,endFrame:0,message:`Missing media: ${asset.path}`,suggestion:'relink or replace asset',assetId:asset.id});}}
 const capMax=typeof project.style.captionMaxChars==='number'?project.style.captionMaxChars:42;
 for(const track of project.tracks.filter(t=>t.kind==='caption')) for(const c of track.clips){if((c.text?.length??0)>capMax){push(issues,{type:'caption_overflow',severity:'warning',startFrame:c.start,endFrame:c.start+c.duration,message:`Caption exceeds ${capMax} characters`,suggestion:'split or shorten caption',clipId:c.id});}}

 for(const record of project.provenance){
  if(record.attributionRequired && (!record.creator?.trim() || !record.sourceUrl?.trim())){
   const asset=record.assetId?project.assets.find(a=>a.id===record.assetId):undefined;
   const clips=record.assetId?project.tracks.flatMap(t=>t.clips).filter(c=>c.assetId===record.assetId):[];
   const start=clips.length?Math.min(...clips.map(c=>c.start)):0, end=clips.length?Math.max(...clips.map(c=>c.start+c.duration)):0;
   push(issues,{type:'missing_attribution',severity:'warning',startFrame:start,endFrame:end,message:`Required attribution metadata is incomplete for ${record.assetId??'external asset'}`,suggestion:'add creator and source URL before publishing',...(asset?{assetId:asset.id}:{})});
  }
 }

 for(const track of project.tracks.filter(t=>t.kind==='video')){
  const clips=[...track.clips].sort((a,b)=>a.start-b.start);
  for(let i=1;i<clips.length;i++){
   const prev=clips[i-1],cur=clips[i];
   if(prev.assetId && cur.assetId===prev.assetId){
    push(issues,{type:'duplicate_shot',severity:'warning',startFrame:cur.start,endFrame:cur.start+cur.duration,message:`Adjacent clips ${prev.id} and ${cur.id} reuse the same source asset`,suggestion:'review for repetitive composition or choose alternate coverage',clipId:cur.id,assetId:cur.assetId});
   }
  }
  for(const c of clips){
   const crop=c.props?.crop as Record<string,unknown>|undefined;
   if(crop && typeof crop.width==='number' && typeof crop.height==='number' && (crop.width<0.3 || crop.height<0.3)){
    push(issues,{type:'extreme_crop',severity:'warning',startFrame:c.start,endFrame:c.start+c.duration,message:`Clip ${c.id} uses an extreme crop`,suggestion:'inspect subject framing and reduce crop if detail is being lost',clipId:c.id,assetId:c.assetId});
   }
  }
 }

 if(!existsSync(renderPath)){push(issues,{type:'render_failure',severity:'error',startFrame:0,endFrame:0,message:`Render output does not exist: ${renderPath}`,suggestion:'re-render after checking media and FFmpeg diagnostics'});return{issues,blocking:true,renderPath};}
 let media;
 try{media=probeMedia(renderPath);}catch(error){push(issues,{type:'render_failure',severity:'error',startFrame:0,endFrame:0,message:`Render cannot be probed: ${error instanceof Error?error.message:String(error)}`,suggestion:'re-render and inspect FFmpeg diagnostics'});return{issues,blocking:true,renderPath};}
 const endFrame=Math.max(1,frame(media.durationSeconds??0,project));
 try{
  const text=runFfmpeg(['-i',renderPath,'-vf','blackdetect=d=0.15:pix_th=0.02','-an','-f','null','-']);
  const re=/black_start:([0-9.]+) black_end:([0-9.]+) black_duration:([0-9.]+)/g; let m:RegExpExecArray|null;
  while((m=re.exec(text))){const start=frame(Number(m[1]),project),end=Math.max(start+1,frame(Number(m[2]),project));push(issues,{type:'black_frames',severity:'warning',startFrame:start,endFrame:end,message:`Black frames detected from ${m[1]}s to ${m[2]}s`,suggestion:'inspect whether black section is intentional; replace or trim if not'});}
 }catch(error){push(issues,{type:'render_failure',severity:'error',startFrame:0,endFrame:0,message:`Black-frame QC failed: ${error instanceof Error?error.message:String(error)}`,suggestion:'check FFmpeg installation'});}

 try{
  const text=runFfmpeg(['-i',renderPath,'-vf','freezedetect=n=-50dB:d=0.5','-an','-f','null','-']);
  const starts=[...text.matchAll(/freeze_start:\s*([0-9.]+)/g)].map(m=>Number(m[1]));
  const ends=[...text.matchAll(/freeze_end:\s*([0-9.]+)/g)].map(m=>Number(m[1]));
  starts.forEach((startSec,i)=>{const endSec=ends[i]??(media.durationSeconds??startSec+.5);const start=frame(startSec,project),end=Math.max(start+1,frame(endSec,project));push(issues,{type:'frozen_frames',severity:'warning',startFrame:start,endFrame:end,message:`Frozen visual section detected from ${startSec.toFixed(2)}s to ${endSec.toFixed(2)}s`,suggestion:'confirm the hold is intentional or replace with alternate coverage'});});
 }catch{/* non-blocking diagnostic */}

 if(media.audio){
  try{
   const text=runFfmpeg(['-i',renderPath,'-af','silencedetect=noise=-45dB:d=0.8','-vn','-f','null','-']);
   const re=/silence_start:\s*([0-9.]+)[\s\S]*?silence_end:\s*([0-9.]+)/g; let m:RegExpExecArray|null;
   while((m=re.exec(text))){const start=frame(Number(m[1]),project),end=Math.max(start+1,frame(Number(m[2]),project));push(issues,{type:'dead_air',severity:'warning',startFrame:start,endFrame:end,message:`Extended silence detected from ${m[1]}s to ${m[2]}s`,suggestion:'confirm silence is intentional or tighten pacing/add room tone'});}
  }catch{/* non-blocking diagnostic */}
  try{
   const text=runFfmpeg(['-i',renderPath,'-af','volumedetect','-vn','-f','null','-']);
   const max=Number(text.match(/max_volume:\s*(-?[0-9.]+) dB/)?.[1]); const mean=Number(text.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1]);
   if(Number.isFinite(max)&&max>-0.2)push(issues,{type:'audio_clipping',severity:'warning',startFrame:0,endFrame,message:`Audio peak is ${max.toFixed(1)} dBFS and is too close to clipping`,suggestion:'lower gain or apply a true-peak limiter'});
   if(Number.isFinite(mean)&&(mean<-35||mean>-8))push(issues,{type:'loudness',severity:'info',startFrame:0,endFrame,message:`Mean audio level is ${mean.toFixed(1)} dBFS`,suggestion:'review loudness normalization for the target platform'});
  }catch{/* non-blocking diagnostic */}
 }
 return{issues,blocking:issues.some(i=>i.severity==='error'),renderPath};
}

export function buildRepairPlan(issue:QCIssue,_project:FlickProject):RepairPlan{return{branchName:`repair/${issue.id}`,range:{startFrame:issue.startFrame,endFrame:issue.endFrame},intent:`Repair QC issue ${issue.id}: ${issue.message}`,issueId:issue.id,suggestedAction:issue.suggestion};}

export function mergeMotionQC(base:QCResult,motion:MotionQCReport):QCResult{const mapped:QCIssue[]=motion.issues.map((issue,index)=>({id:`qc_motion_${index}_${issue.id}`,type:issue.type,severity:issue.severity,startFrame:issue.startFrame,endFrame:issue.endFrame,message:issue.message,suggestion:issue.suggestion,layerIds:issue.layerIds}));return{...base,issues:[...base.issues,...mapped],blocking:base.blocking||motion.blocking};}

import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2, Transform2D, V2Clip, V2Track } from '../../schema/src/v2/project.ts';
import { compileColorEffect } from '../../effects/src/index.ts';
import { compileAudioBusChain, compileAudioProcessor } from '../../audio-engine/src/index.ts';
import { probeMedia } from '../../media/src/ingest.ts';

interface VisualLeaf { clip:V2Clip; assetPath:string; start:number; duration:number; sourceIn:number; transform:Transform2D; opacity:number; blendMode:string; order:number }
interface AudioLeaf { clip:V2Clip; assetPath:string; start:number; duration:number; sourceIn:number; busId:string }
const fps=(p:FlickProjectV2)=>p.format.fps.numerator/p.format.fps.denominator;
const sec=(p:FlickProjectV2,frames:number)=>frames/fps(p);

function composeTransform(parent:Transform2D,child:Transform2D):Transform2D{return{x:parent.x+child.x*parent.scaleX,y:parent.y+child.y*parent.scaleY,scaleX:parent.scaleX*child.scaleX,scaleY:parent.scaleY*child.scaleY,rotation:parent.rotation+child.rotation};}
function flattenVisual(project:FlickProjectV2,compositionId:string,baseStart=0,windowStart=0,windowDuration=Infinity,parentTransform:Transform2D={x:0,y:0,scaleX:1,scaleY:1,rotation:0},parentOpacity=1,orderBase=0):VisualLeaf[]{
 const c=project.compositions.find(x=>x.id===compositionId); if(!c)throw new Error(`Unknown composition ${compositionId}`); const assets=new Map(project.assets.map(a=>[a.id,a])); const out:VisualLeaf[]=[];
 const tracks=[...c.tracks].filter(t=>t.kind!=='audio').sort((a,b)=>(a.zIndex??0)-(b.zIndex??0)||a.id.localeCompare(b.id)); let ord=orderBase;
 for(const t of tracks)for(const clip of [...t.clips].sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))){ if(!clip.enabled||t.muted)continue; const s=Math.max(clip.start,windowStart),e=Math.min(clip.start+clip.duration,windowStart+windowDuration); if(e<=s)continue; const localOffset=s-clip.start; const start=baseStart+(s-windowStart); const duration=e-s; const sourceIn=clip.sourceIn+localOffset*(clip.speed??1); const transform=composeTransform(parentTransform,clip.transform); const opacity=parentOpacity*clip.opacity;
   if(clip.compositionId){out.push(...flattenVisual(project,clip.compositionId,start,sourceIn,duration,transform,opacity,ord*1000));ord++;continue;}
   if(!clip.assetId)continue; const asset=assets.get(clip.assetId); if(!asset)throw new Error(`Missing asset ${clip.assetId}`); if(!existsSync(asset.path))throw new Error(`Missing media ${asset.path}`); out.push({clip:{...clip,sourceIn},assetPath:asset.path,start,duration,sourceIn,transform,opacity,blendMode:clip.blendMode,order:ord++});
 }
 return out.sort((a,b)=>a.order-b.order||a.start-b.start);
}
function flattenAudio(project:FlickProjectV2):AudioLeaf[]{const c=project.compositions.find(x=>x.id===project.rootCompositionId)!;const assets=new Map(project.assets.map(a=>[a.id,a]));return c.tracks.filter(t=>t.kind==='audio'&&!t.muted).flatMap(t=>t.clips).filter(c=>c.enabled&&c.assetId).flatMap(clip=>{const a=assets.get(clip.assetId!);if(!a||!existsSync(a.path))throw new Error(`Missing audio asset ${clip.assetId}`);const meta=probeMedia(a.path);if(!meta.audio)return [];return[{clip,assetPath:a.path,start:clip.start,duration:clip.duration,sourceIn:clip.sourceIn,busId:clip.busId??'master'}];});}
function esc(n:number){return Number(n.toFixed(6)).toString();}
function atempo(speed:number):string{const parts:number[]=[];let x=speed;while(x>2){parts.push(2);x/=2;}while(x<.5){parts.push(.5);x/=.5;}parts.push(x);return parts.map(v=>`atempo=${esc(v)}`).join(',');}
function mode(name:string):string { return ({multiply:'multiply',screen:'screen',overlay:'overlay',darken:'darken',lighten:'lighten',add:'addition',difference:'difference',exclusion:'exclusion','soft-light':'softlight','hard-light':'hardlight'} as Record<string,string>)[name]??'normal'; }


interface VideoTiming { sourceDurationSeconds:number; setpts:string }
function videoTiming(project:FlickProjectV2,clip:V2Clip,durationFrames:number):VideoTiming {
 const rate=fps(project), curve=clip.speedCurve?.points;
 if(!curve?.length){const speed=clip.speed??1;return{sourceDurationSeconds:sec(project,durationFrames)*speed,setpts:`(PTS-STARTPTS)/${esc(speed)}`};}
 let points=[...curve].sort((a,b)=>a.frame-b.frame);if(points.some(p=>!Number.isFinite(p.speed)||p.speed<=0))throw new Error(`Invalid speed curve on ${clip.id}`);if(points[0].frame>0)points=[{frame:0,speed:points[0].speed},...points];if(points.at(-1)!.frame<durationFrames)points.push({frame:durationFrames,speed:points.at(-1)!.speed});points=points.filter(p=>p.frame>=0&&p.frame<=durationFrames);if(points.length<2)throw new Error(`Speed curve on ${clip.id} needs two points`);
 const segments:Array<{t0:number;t1:number;v0:number;k:number;s0:number;s1:number}>=[];let source=0;for(let i=0;i<points.length-1;i++){const t0=points[i].frame/rate,t1=points[i+1].frame/rate,dt=t1-t0;if(dt<=0)continue;const v0=points[i].speed,v1=points[i+1].speed,k=(v1-v0)/dt,s1=source+v0*dt+.5*k*dt*dt;segments.push({t0,t1,v0,k,s0:source,s1});source=s1;}if(!segments.length)throw new Error(`Invalid speed curve on ${clip.id}`);
 const sourceExpr='((PTS-STARTPTS)*TB)';
 const local=(seg:typeof segments[number])=>Math.abs(seg.k)<1e-9?`((${sourceExpr}-${esc(seg.s0)})/${esc(seg.v0)})`:`((-${esc(seg.v0)}+sqrt(${esc(seg.v0*seg.v0)}+2*${esc(seg.k)}*(${sourceExpr}-${esc(seg.s0)})))/${esc(seg.k)})`;
 let expr=`(${esc(segments.at(-1)!.t0)}+${local(segments.at(-1)!)})/TB`;
 for(let i=segments.length-2;i>=0;i--){const seg=segments[i];expr=`if(lt(${sourceExpr},${esc(seg.s1)}),(${esc(seg.t0)}+${local(seg)})/TB,${expr})`;}
 return{sourceDurationSeconds:source,setpts:expr};
}

export function renderProjectV2(project:FlickProjectV2,output:string):string {
 const visual=flattenVisual(project,project.rootCompositionId); if(!visual.length)throw new Error('Nothing visual to render'); const audio=flattenAudio(project); const rate=fps(project); const root=project.compositions.find(c=>c.id===project.rootCompositionId)!; const totalFrames=Math.max(...visual.map(x=>x.start+x.duration),...audio.map(x=>x.start+x.duration),1); const total=sec(project,totalFrames); mkdirSync(dirname(output),{recursive:true});
 const args:string[]=['-y','-hide_banner','-loglevel','error'];
 visual.forEach(v=>{const timing=videoTiming(project,v.clip,v.duration);args.push('-ss',esc(sec(project,v.sourceIn)),'-t',esc(timing.sourceDurationSeconds),'-i',v.assetPath);});
 audio.forEach(a=>args.push('-ss',esc(sec(project,a.sourceIn)),'-t',esc(sec(project,a.duration)*(a.clip.speed??1)),'-i',a.assetPath));
 const filters:string[]=[];
 filters.push(`color=c=black:s=${root.width}x${root.height}:r=${esc(rate)}:d=${esc(total)},format=rgba[base0]`); let base='base0';
 visual.forEach((v,i)=>{
   const timing=videoTiming(project,v.clip,v.duration); const masks=(v.clip.maskRefs??[]).map(id=>(project.masks??[]).find(m=>m.id===id)); if(masks.some(m=>!m))throw new Error(`Unknown mask on clip ${v.clip.id}`); if(masks.length>1)throw new Error(`Multiple masks on clip ${v.clip.id} are not yet supported by FFmpeg reference renderer`); const mask=masks[0]; if(mask&&mask.kind!=='rect')throw new Error(`Mask kind ${mask.kind} is not yet supported by FFmpeg reference renderer`); if(mask?.invert)throw new Error(`Inverted masks are not yet supported by FFmpeg reference renderer`); const baseW=mask?.width??root.width,baseH=mask?.height??root.height; const scaledW=Math.max(2,Math.round(baseW*Math.abs(v.transform.scaleX))),scaledH=Math.max(2,Math.round(baseH*Math.abs(v.transform.scaleY))); const maskX=mask?.x??0,maskY=mask?.y??0; const chain:string[]=[`[${i}:v]fps=${esc(rate)}`,`scale=${root.width}:${root.height}:force_original_aspect_ratio=decrease`,`pad=${root.width}:${root.height}:(ow-iw)/2:(oh-ih)/2`,`setsar=1`];
   for(const fx of v.clip.effectStack){const f=compileColorEffect(fx);if(f)chain.push(f);}
   if(mask)chain.push(`crop=${Math.round(mask.width)}:${Math.round(mask.height)}:${Math.round(mask.x)}:${Math.round(mask.y)}`);
   chain.push(`setpts='${timing.setpts}'`,`trim=duration=${esc(sec(project,v.duration))}`,`setpts=PTS-STARTPTS`);
   if(scaledW!==root.width||scaledH!==root.height)chain.push(`scale=${scaledW}:${scaledH}`);
   if(Math.abs(v.transform.rotation)>1e-8)chain.push(`rotate=${esc(v.transform.rotation*Math.PI/180)}:ow=rotw(iw):oh=roth(ih):c=black@0`);
   chain.push('format=rgba');
   const transition=v.clip.effectStack.find(e=>e.enabled&&e.type==='transition:cross-dissolve'); if(transition){const df=typeof transition.params.durationFrames==='number'?transition.params.durationFrames:Math.min(10,v.duration);chain.push(`fade=t=in:st=0:d=${esc(sec(project,df))}:alpha=1`);}
   if(v.opacity<.999999)chain.push(`colorchannelmixer=aa=${esc(v.opacity)}`); chain.push(`setpts=PTS-STARTPTS+${esc(sec(project,v.start))}/TB[layer${i}]`); filters.push(chain.join(','));
   const x=Math.round(v.transform.x+maskX*v.transform.scaleX),y=Math.round(v.transform.y+maskY*v.transform.scaleY); const next=`base${i+1}`;
   if(v.blendMode==='normal') filters.push(`[${base}][layer${i}]overlay=x=${x}:y=${y}:eof_action=pass:shortest=0:format=auto[${next}]`);
   else {
     const crop=`bg${i}`; filters.push(`[${base}]crop=${scaledW}:${scaledH}:${Math.max(0,x)}:${Math.max(0,y)},format=gbrp[${crop}]`); filters.push(`[layer${i}]format=gbrp[fg${i}]`); filters.push(`[${crop}][fg${i}]blend=all_mode=${mode(v.blendMode)}:all_opacity=${esc(v.opacity)}[blend${i}]`); filters.push(`[${base}][blend${i}]overlay=x=${x}:y=${y}:eof_action=pass:shortest=0[${next}]`);
   } base=next;
 });
 let audioLabel:string|undefined; const audioStart=visual.length; const byBus=new Map<string,string[]>();
 audio.forEach((a,i)=>{const input=audioStart+i, speed=a.clip.speed??1,label=`aclip${i}`,gain=a.clip.gainDb??0,delay=Math.round(sec(project,a.start)*1000);filters.push(`[${input}:a]aresample=${project.format.audioSampleRate},${atempo(speed)},atrim=duration=${esc(sec(project,a.duration))},asetpts=PTS-STARTPTS,volume=${gain}dB,adelay=${delay}|${delay}[${label}]`);const list=byBus.get(a.busId)??[];list.push(label);byBus.set(a.busId,list);});
 const busLabels=new Map<string,string>();
 for(const bus of project.audioBuses.filter(b=>b.id!=='master')){const refs=byBus.get(bus.id)??[];if(!refs.length)continue;let label=`busmix_${bus.id}`;filters.push(`${refs.map(r=>`[${r}]`).join('')}amix=inputs=${refs.length}:duration=longest:normalize=0[${label}]`);const chain=compileAudioBusChain(bus);if(chain!=='anull'){const out=`busfx_${bus.id}`;filters.push(`[${label}]${chain}[${out}]`);label=out;}busLabels.set(bus.id,label);}
 // FFmpeg filter outputs are single-consumer labels. Split every bus used as a
 // sidechain so one branch remains available for the master mix while each
 // ducking processor receives its own independent sidechain branch.
 const sidechainUses=new Map<string,number>();
 for(const bus of project.audioBuses.filter(b=>b.id!=='master'))for(const fx of bus.effects.filter(e=>e.enabled&&e.type==='ducking')){const sideId=String(fx.params.sidechainBusId??'');if(sideId)sidechainUses.set(sideId,(sidechainUses.get(sideId)??0)+1);}
 const sidechainQueues=new Map<string,string[]>();
 for(const [sideId,count] of sidechainUses){const source=busLabels.get(sideId);if(!source)throw new Error(`Ducking sidechain bus ${sideId} has no audio`);const keep=`sidekeep_${sideId}`,branches=Array.from({length:count},(_,i)=>`side_${sideId}_${i}`);filters.push(`[${source}]asplit=${count+1}[${keep}]${branches.map(x=>`[${x}]`).join('')}`);busLabels.set(sideId,keep);sidechainQueues.set(sideId,branches);}
 for(const bus of project.audioBuses.filter(b=>b.id!=='master')){let label=busLabels.get(bus.id);if(!label)continue;for(const fx of bus.effects.filter(e=>e.enabled&&e.type==='ducking')){const sideId=String(fx.params.sidechainBusId??''),side=sidechainQueues.get(sideId)?.shift();if(!side)throw new Error(`Ducking sidechain bus ${sideId} has no available split`);const out=`duck_${bus.id}_${fx.id}`;filters.push(`[${label}][${side}]${compileAudioProcessor(fx)}[${out}]`);label=out;}busLabels.set(bus.id,label);}
 const masterInputs=[...(byBus.get('master')??[]),...project.audioBuses.filter(b=>b.outputBusId==='master').map(b=>busLabels.get(b.id)).filter((x):x is string=>Boolean(x))];
 if(masterInputs.length){let label='mastermix';filters.push(`${masterInputs.map(r=>`[${r}]`).join('')}amix=inputs=${masterInputs.length}:duration=longest:normalize=0[${label}]`);const master=project.audioBuses.find(b=>b.id==='master');if(master){const chain=compileAudioBusChain(master);if(chain!=='anull'){filters.push(`[${label}]${chain}[masterout]`);label='masterout';}}audioLabel=label;}
 args.push('-filter_complex',filters.join(';'),'-map',`[${base}]`); if(audioLabel)args.push('-map',`[${audioLabel}]`,'-c:a','aac','-b:a','160k');else args.push('-an'); args.push('-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-t',esc(total),output);
 const r=spawnSync('ffmpeg',args,{encoding:'utf8',timeout:240000}); if(r.error)throw r.error;if(r.status!==0)throw new Error(`FFmpeg v2 render failed: ${r.stderr}`);return output;
}

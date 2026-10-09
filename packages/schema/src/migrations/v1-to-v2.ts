import type { Clip, FlickProject, Track, TrackKind } from '../project.ts';
import { defaultTransform, type FlickProjectV2, type V2Clip, type V2Track } from '../v2/project.ts';

function volumeToDb(v:number|undefined): number | undefined {
  if (v === undefined) return undefined;
  if (v <= 0) return -120;
  return 20*Math.log10(v);
}
function migrateClip(c:Clip, trackKind:TrackKind):V2Clip {
  return {
    id:c.id, ...(c.assetId?{assetId:c.assetId}:{}), start:c.start,duration:c.duration,sourceIn:c.sourceIn,
    transform:defaultTransform(), opacity:1, blendMode:'normal', maskRefs:[], effectStack:[], enabled:true,
    ...(c.speed!==undefined?{speed:c.speed}:{}), ...(c.volume!==undefined?{gainDb:volumeToDb(c.volume)}:{}), ...(trackKind==='video'&&c.assetId?{busId:'master'}:{}),
    ...(c.text?{text:c.text}:{}), ...(c.component?{component:c.component}:{}), ...(c.props?{props:structuredClone(c.props)}:{}), ...(c.locked!==undefined?{locked:c.locked}:{}),
  };
}
function migrateTrack(t:Track):V2Track { return {id:t.id,kind:t.kind,name:t.name,clips:t.clips.map(c=>migrateClip(c,t.kind)),...(t.locked!==undefined?{locked:t.locked}:{}),...(t.muted!==undefined?{muted:t.muted}:{})}; }
function embeddedAudioTrack(t:Track):V2Track|undefined {
  if(t.kind!=='video') return undefined;
  const clips=t.clips.filter(c=>c.assetId).map(c=>({ ...migrateClip(c,'audio'), id:`${c.id}__embedded_audio`, busId:'master', props:{...(c.props??{}),embeddedAudio:true} }));
  if(!clips.length) return undefined;
  return {id:`${t.id}__embedded_audio`,kind:'audio',name:`${t.name} Embedded Audio`,clips,...(t.locked!==undefined?{locked:t.locked}:{}),...(t.muted!==undefined?{muted:t.muted}:{})};
}
export function migrateV1ToV2(input:FlickProject):FlickProjectV2 {
  const p=structuredClone(input);
  const root='root';
  return {
    version:2,id:p.id,name:p.name,format:structuredClone(p.format),assets:structuredClone(p.assets),
    rootCompositionId:root, compositions:[{id:root,name:'Main',width:p.format.width,height:p.format.height,tracks:[...p.tracks.map(migrateTrack),...p.tracks.map(embeddedAudioTrack).filter((x):x is V2Track=>Boolean(x))]}],
    masks:[], audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}], multicamGroups:[], perception:{providers:[]}, preview:{quality:'full',preferGpu:true},
    markers:structuredClone(p.markers),style:structuredClone(p.style),provenance:structuredClone(p.provenance),checkpoints:structuredClone(p.checkpoints),branches:structuredClone(p.branches),
    ...(p.semanticLocks?{semanticLocks:structuredClone(p.semanticLocks)}:{}),
  };
}

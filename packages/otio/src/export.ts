import type { FlickProject } from '../../schema/src/project.ts';
import type { FlickProjectV2 } from '../../schema/src/v2/project.ts';
import type { FlickProjectV3 } from '../../schema/src/v3/project.ts';

type AnyProject=FlickProject|FlickProjectV2|FlickProjectV3;
type ModernProject=FlickProjectV2|FlickProjectV3;
const isModernProject=(project:AnyProject):project is ModernProject=>project.version===2||project.version===3;
function editorialTracks(project:AnyProject){if(!isModernProject(project))return project.tracks;const root=project.compositions.find(c=>c.id===project.rootCompositionId);if(!root)throw new Error(`Unknown root composition ${project.rootCompositionId}`);return root.tracks;}
export function exportOtio(project:AnyProject):Record<string,unknown>{
 const rate=project.format.fps.numerator/project.format.fps.denominator,assets=new Map(project.assets.map(a=>[a.id,a])),tracks=editorialTracks(project);
 const flicksmith:Record<string,unknown>={projectId:project.id,version:project.version,fps:project.format.fps,markers:structuredClone(project.markers)};
 if(isModernProject(project))Object.assign(flicksmith,{rootCompositionId:project.rootCompositionId,compositionIds:project.compositions.map(c=>c.id)});
 if(project.version===3)flicksmith.motion={compositionIds:project.motionCompositions.map(c=>c.id),componentIds:project.motionComponents.map(c=>c.id),rigIds:project.motionRigs.map(r=>r.id),styleIds:project.motionStyles.map(s=>s.id),trackingIds:(project.trackingData??[]).map(t=>t.id),audioAnalysisIds:(project.audioAnalyses??[]).map(a=>a.id),compositions:structuredClone(project.motionCompositions),components:structuredClone(project.motionComponents),rigs:structuredClone(project.motionRigs),styles:structuredClone(project.motionStyles)};
 return {OTIO_SCHEMA:'Timeline.1',name:project.name,metadata:{flicksmith},global_start_time:null,tracks:{OTIO_SCHEMA:'Stack.1',name:'tracks',children:tracks.map(track=>({
   OTIO_SCHEMA:'Track.1',name:track.name,kind:track.kind==='audio'?'Audio':'Video',metadata:{flicksmith:{trackId:track.id,kind:track.kind}},children:track.clips.map(clip=>{const asset=clip.assetId?assets.get(clip.assetId):undefined;return{
     OTIO_SCHEMA:'Clip.2',name:clip.id,source_range:{OTIO_SCHEMA:'TimeRange.1',start_time:{OTIO_SCHEMA:'RationalTime.1',value:clip.sourceIn,rate},duration:{OTIO_SCHEMA:'RationalTime.1',value:clip.duration,rate}},
     media_reference:asset?{OTIO_SCHEMA:'ExternalReference.1',target_url:`file://${asset.path}`,available_range:asset.duration?{OTIO_SCHEMA:'TimeRange.1',start_time:{OTIO_SCHEMA:'RationalTime.1',value:0,rate},duration:{OTIO_SCHEMA:'RationalTime.1',value:asset.duration,rate}}:null}:{OTIO_SCHEMA:'MissingReference.1'},
     metadata:{flicksmith:{timelineStart:clip.start,trackId:track.id,speed:clip.speed??1,volume:'volume' in clip?clip.volume:undefined,gainDb:'gainDb' in clip?clip.gainDb:undefined,text:clip.text,component:clip.component,props:clip.props,transform:'transform' in clip?clip.transform:undefined,opacity:'opacity' in clip?clip.opacity:undefined,effectStack:'effectStack' in clip?clip.effectStack:undefined}}
   };})}))}};
}

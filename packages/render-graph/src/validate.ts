import type { FlickProjectV2 } from '../../schema/src/v2/project.ts';
import type { FlickProjectV3 } from '../../schema/src/v3/project.ts';
import type { RenderGraphDiagnostic } from './types.ts';
export function validateCompositionGraph(project:FlickProjectV2|FlickProjectV3):RenderGraphDiagnostic[] {
 const by=new Map(project.compositions.map(c=>[c.id,c])); const out:RenderGraphDiagnostic[]=[]; const done=new Set<string>();
 const visit=(id:string,path:string[])=>{
   const idx=path.indexOf(id); if(idx>=0){out.push({code:'composition_cycle',severity:'error',message:`Composition cycle: ${[...path.slice(idx),id].join(' -> ')}`});return;}
   if(done.has(id)) return; const c=by.get(id); if(!c){out.push({code:'missing_composition',severity:'error',message:`Missing composition ${id}`});return;}
   const next=[...path,id]; for(const t of c.tracks) for(const clip of t.clips) if(clip.compositionId&&by.has(clip.compositionId)) visit(clip.compositionId,next); done.add(id);
 };
 for(const c of project.compositions) visit(c.id,[]);
 if(project.version===3){
  const motionBy=new Map(project.motionCompositions.map(c=>[c.id,c]));const motionDone=new Set<string>(),visiting=new Set<string>();
  const mv=(id:string)=>{if(motionDone.has(id))return;if(visiting.has(id)){out.push({code:'motion_composition_cycle',severity:'error',message:`Motion composition cycle involving ${id}`});return;}visiting.add(id);const c=motionBy.get(id);if(!c){out.push({code:'missing_motion_composition',severity:'error',message:`Missing motion composition ${id}`});visiting.delete(id);return;}for(const l of c.layers)if(l.motionCompositionId)mv(l.motionCompositionId);visiting.delete(id);motionDone.add(id);};for(const c of project.motionCompositions)mv(c.id);
 }
 return out;
}

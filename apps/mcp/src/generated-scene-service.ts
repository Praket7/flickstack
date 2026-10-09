import type { FlickProjectV3,LayeredImageScene } from '../../../packages/schema/src/v3/project.ts';
import { V3ProjectSession,type V3EditOperation,type V3EditResult,type V3SessionApplyResult } from '../../../packages/timeline/src/v3.ts';
import { GenerationRuntime,type GenerationRequest,type GenerationRequirements } from '../../../packages/generation/src/index.ts';
import { buildGeneratedSceneOperations,buildNativeMotionOperations,planGeneratedScene,planNativeSceneMotion,type CameraSafetyEnvelope,type GeneratedSceneRequest,type LayerDepthPlacement } from '../../../packages/generated-scenes/src/index.ts';
import { reviewGeneratedScene,type GeneratedSceneQcIssue } from '../../../packages/design-qc/src/generated-scene.ts';

export type GeneratedSceneMutationResult=
 |{ok:true;result:V3EditResult;revision:string;applied:number;receipts:V3EditResult['receipt'][]}
 |Extract<V3SessionApplyResult,{ok:false}>;

function conflict(expectedRevision:string,currentRevision:string):Extract<V3SessionApplyResult,{ok:false}>{return{ok:false,conflict:{expectedRevision,currentRevision,message:'Project changed; refresh and retry'}}}
function runBatch(session:V3ProjectSession,expectedRevision:string,ops:V3EditOperation[]):GeneratedSceneMutationResult{
 if(expectedRevision!==session.revision)return conflict(expectedRevision,session.revision);
 if(!ops.length)throw new Error('Generated-scene mutation contains no operations');
 const probe=new V3ProjectSession(session.project);let probeRevision=expectedRevision;
 for(const op of ops){const applied=probe.apply(probeRevision,op);if(!applied.ok)return applied;probeRevision=applied.result.diff.afterRevision}
 let revision=expectedRevision;const receipts:V3EditResult['receipt'][]=[];let last:V3EditResult|undefined;
 for(const op of ops){const applied=session.apply(revision,op);if(!applied.ok)return applied;last=applied.result;receipts.push(applied.result.receipt);revision=applied.result.diff.afterRevision}
 return{ok:true,result:last!,revision:session.revision,applied:ops.length,receipts};
}

export class GeneratedSceneService{
 readonly session:V3ProjectSession;readonly generation?:GenerationRuntime;
 constructor(session:V3ProjectSession,generation?:GenerationRuntime){this.session=session;this.generation=generation}
 plan(request:GeneratedSceneRequest){return planGeneratedScene(this.session.project,request,this.generation?.listProviders()??[])}
 build(expectedRevision:string,request:GeneratedSceneRequest,scene:LayeredImageScene,placements:LayerDepthPlacement[],envelope:CameraSafetyEnvelope):GeneratedSceneMutationResult{return runBatch(this.session,expectedRevision,buildGeneratedSceneOperations(this.session.project,scene,request,placements,envelope))}
 animate(expectedRevision:string,sceneId:string,request:GeneratedSceneRequest,envelope:CameraSafetyEnvelope){if(expectedRevision!==this.session.revision)return conflict(expectedRevision,this.session.revision);const scene=this.session.project.generatedScenes?.find(x=>x.id===sceneId);if(!scene)throw new Error(`Unknown generated scene ${sceneId}`);const plan=planNativeSceneMotion(request,scene,envelope),ops=buildNativeMotionOperations(request.compositionId,scene,plan,request.durationFrames);if(!ops.length)return{ok:true as const,revision:this.session.revision,applied:0,receipts:[],plan};const result=runBatch(this.session,expectedRevision,ops);return result.ok?{...result,plan}:result}
 review(sceneId:string):GeneratedSceneQcIssue[]{return reviewGeneratedScene(this.session.project,sceneId)}
 regenerate(sceneId:string,layerId:string,request:GenerationRequest,requirements:GenerationRequirements={}){if(!this.generation)throw new Error('Generation runtime unavailable');const scene=this.session.project.generatedScenes?.find(x=>x.id===sceneId);if(!scene)throw new Error(`Unknown generated scene ${sceneId}`);const layer=scene.layers.find(x=>x.id===layerId);if(!layer)throw new Error(`Unknown generated scene layer ${layerId}`);if(request.projectId!==this.session.project.id)throw new Error(`Generation request projectId must equal ${this.session.project.id}`);if(request.kind!=='image-edit'&&request.kind!=='image')throw new Error('Scene-layer regeneration requires image or image-edit generation');if(request.kind==='image-edit'&&!request.inputAssetIds.includes(layer.assetId))throw new Error(`Image-edit regeneration must reference target asset ${layer.assetId}`);return{jobId:this.generation.submit(request,requirements),sceneId,layerId,targetAssetId:layer.assetId,revision:this.session.revision}}
}

export function generatedSceneServiceFor(project:FlickProjectV3,generation?:GenerationRuntime):GeneratedSceneService{return new GeneratedSceneService(new V3ProjectSession(project),generation)}

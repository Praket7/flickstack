import type { GenerationProvider,GenerationRequest,GenerationRequirements,GenerationVideoRequirements,ProviderCapabilityManifest,VideoProviderCapabilities } from './types.ts';

function videoCapable(cap:VideoProviderCapabilities|undefined,req:GenerationVideoRequirements|undefined,request:GenerationRequest):boolean{
 if(!req && request.seed===undefined)return true;
 if(!cap)return false;
 const required=req??{};
 if(required.firstFrame===true&&!cap.supportsFirstFrame)return false;
 if(required.lastFrame===true&&!cap.supportsLastFrame)return false;
 if((required.referenceImages??0)>cap.maxReferenceImages)return false;
 if(required.negativePrompt===true&&!cap.supportsNegativePrompt)return false;
 if((required.seed===true||request.seed!==undefined)&&!cap.supportsSeed)return false;
 if(required.cameraControl===true&&!cap.supportsCameraControl)return false;
 if(required.motionMasks===true&&!cap.supportsMotionMasks)return false;
 if(required.extension===true&&!cap.supportsExtension)return false;
 if(required.nativeAudio===true&&!cap.supportsNativeAudio)return false;
 if(required.durationSeconds!==undefined){
  if(cap.minDurationSeconds!==undefined&&required.durationSeconds<cap.minDurationSeconds)return false;
  if(cap.maxDurationSeconds!==undefined&&required.durationSeconds>cap.maxDurationSeconds)return false;
  if(cap.minDurationSeconds===undefined&&cap.maxDurationSeconds===undefined)return false;
 }
 if(required.resolution!==undefined&&!(cap.supportedResolutions??[]).includes(required.resolution))return false;
 if(required.aspectRatio!==undefined&&!(cap.supportedAspectRatios??[]).includes(required.aspectRatio))return false;
 return true;
}

function capable(m:ProviderCapabilityManifest,r:GenerationRequest,req:GenerationRequirements):boolean{
 if(!m.kinds.includes(r.kind))return false;
 if(req.execution&&m.execution!==req.execution)return false;
 for(const key of ['supportsTransparency','supportsMasks','supportsReferences','supportsStreaming','supportsCancellation'] as const)if(req[key]===true&&m[key]!==true)return false;
 if(r.model&&m.models&&m.models.length>0&&!m.models.includes(r.model))return false;
 if(r.kind==='video'&&!videoCapable(m.video,req.video,r))return false;
 return true;
}

function fitness(m:ProviderCapabilityManifest,r:GenerationRequest,req:GenerationRequirements):number{
 let score=0;
 if(!req.execution&&m.execution==='local')score+=1000;
 if(m.estimatedCostUnits===0)score+=100;
 if(r.model&&m.models?.includes(r.model))score+=100;
 if(req.video&&m.video){
  const bools:Array<[keyof GenerationVideoRequirements,keyof VideoProviderCapabilities]>= [
   ['firstFrame','supportsFirstFrame'],['lastFrame','supportsLastFrame'],['negativePrompt','supportsNegativePrompt'],['seed','supportsSeed'],['cameraControl','supportsCameraControl'],['motionMasks','supportsMotionMasks'],['extension','supportsExtension'],['nativeAudio','supportsNativeAudio']
  ];
  for(const [required,capability] of bools)if(req.video[required]===true&&m.video[capability]===true)score+=10;
  if(req.video.referenceImages!==undefined)score+=Math.min(10,m.video.maxReferenceImages);
 }
 if(m.estimatedCostUnits!==undefined)score+=1/(1+Math.max(0,m.estimatedCostUnits));
 return score;
}

export class GenerationProviderRegistry{
 #providers=new Map<string,GenerationProvider>();
 register(provider:GenerationProvider):void{const m=provider.manifest();if(!m.provider.trim())throw new Error('generation provider id required');if(this.#providers.has(m.provider))throw new Error(`Duplicate generation provider ${m.provider}`);this.#providers.set(m.provider,provider)}
 get(id:string):GenerationProvider|undefined{return this.#providers.get(id)}
 list():ProviderCapabilityManifest[]{return [...this.#providers.values()].map(p=>structuredClone(p.manifest())).sort((a,b)=>a.provider.localeCompare(b.provider))}
 resolve(request:GenerationRequest,requirements:GenerationRequirements={}):GenerationProvider{
  if(request.provider){const p=this.#providers.get(request.provider);if(!p)throw new Error(`Unknown generation provider ${request.provider}`);if(!capable(p.manifest(),request,requirements))throw new Error(`Generation provider ${request.provider} cannot satisfy ${request.kind} capability requirements`);return p}
  const eligible=[...this.#providers.values()].filter(p=>capable(p.manifest(),request,requirements)).sort((a,b)=>{
   const delta=fitness(b.manifest(),request,requirements)-fitness(a.manifest(),request,requirements);
   return Math.abs(delta)>1e-9?delta:a.manifest().provider.localeCompare(b.manifest().provider);
  });
  if(eligible.length===0)throw new Error(`No generation provider satisfies ${request.kind} capability requirements`);
  return eligible[0];
 }
}

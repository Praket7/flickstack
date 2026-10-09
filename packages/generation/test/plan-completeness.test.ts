import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GenerationProviderRegistry, GenerationRuntime, OpenAIImageProvider, type GenerationProvider, type GenerationRequest } from '../src/index.ts';
import { JobScheduler } from '../../jobs/src/scheduler.ts';
import { JobStore } from '../../jobs/src/store.ts';

const provider=(id:string, usage={units:1,costUsd:.01},rights={commercialAllowed:true,attributionRequired:false}):GenerationProvider=>({
 manifest:()=>({provider:id,kinds:['image'],execution:'local',supportsTransparency:true,supportsMasks:false,supportsReferences:false,supportsStreaming:false,supportsCancellation:true,estimatedUnit:'image'}),
 generate:async req=>{const root=mkdtempSync(join(tmpdir(),'gen-plan-')),path=join(root,`${req.id}.png`);writeFileSync(path,'bytes');return{requestId:req.id,provider:id,model:'fixture',outputs:[{path,mediaType:'image/png',sha256:''}],usage,rights,providerMetadata:{trace:'fixture'}}}
});

test('registry get and plan-level capability metadata are available',()=>{const r=new GenerationProviderRegistry();r.register(provider('fixture'));assert.equal(r.get('fixture')?.manifest().provider,'fixture');assert.equal(r.list()[0].estimatedUnit,'image')});

test('runtime enforces max units, max cost, and commercial-rights requirements before staging',async()=>{
 const root=mkdtempSync(join(tmpdir(),'gen-budget-')),registry=new GenerationProviderRegistry();registry.register(provider('expensive',{units:4,costUsd:2.5},{commercialAllowed:false,attributionRequired:true}));const store=new JobStore(),scheduler=new JobScheduler(store,{cpu:1,io:1,gpu:1,model:1}),runtime=new GenerationRuntime({registry,scheduler,stagingRoot:root});
 const request:GenerationRequest={id:'budget',projectId:'p',kind:'image',inputAssetIds:[],parameters:{},budget:{maxUnits:2,maxCostUsd:1}};const jobId=runtime.submit(request,{requireCommercialRights:true});await scheduler.runUntilIdle();assert.equal(runtime.status(jobId)?.state,'failed');assert.equal(runtime.staged(jobId),undefined);store.close();rmSync(root,{recursive:true,force:true});
});

test('OpenAI provider can discover env credentials without persisting them and exposes provider metadata',async()=>{
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='sk-env-secret';let auth='',body='';try{const provider=new OpenAIImageProvider({fetchImpl:async(_url,init)=>{auth=String((init?.headers as Record<string,string>)?.authorization??'');body=String(init?.body??'');return new Response(JSON.stringify({id:'resp_env',output:[{type:'image_generation_call',result:Buffer.from('img').toString('base64')}]}),{status:200,headers:{'content-type':'application/json'}})}});const out=await provider.generate({id:'env',projectId:'p',kind:'image',prompt:'hero',inputAssetIds:[],parameters:{}},new AbortController().signal);assert.match(auth,/Bearer sk-env-secret/);assert.doesNotMatch(JSON.stringify(out),/sk-env-secret/);assert.equal(out.providerMetadata?.responseId,'resp_env');assert.match(body,/image_generation/)}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous}
});

test('OpenAI edit requests resolve reference assets and advertise references only when configured',async()=>{
 let body='';const provider=new OpenAIImageProvider({apiKey:'sk-test',resolveInputAsset:async id=>({bytes:Buffer.from(`asset:${id}`),mediaType:'image/png'}),fetchImpl:async(_url,init)=>{body=String(init?.body??'');return new Response(JSON.stringify({id:'resp_edit',output:[{type:'image_generation_call',result:Buffer.from('edited').toString('base64')}]}),{status:200,headers:{'content-type':'application/json'}})}});assert.equal(provider.manifest().supportsReferences,true);await provider.generate({id:'edit',projectId:'p',kind:'image-edit',prompt:'make it blue',inputAssetIds:['hero'],parameters:{}},new AbortController().signal);assert.match(body,/input_image/);assert.match(body,/data:image\/png;base64/);assert.match(body,/make it blue/);
 const plain=new OpenAIImageProvider({apiKey:'sk-test'});assert.equal(plain.manifest().supportsReferences,false)
});

test('OpenAI adapter tolerates streamed partial images and keeps only completed/final output',async()=>{
 const final=Buffer.from('final-image').toString('base64');const partial=Buffer.from('partial-image').toString('base64');const sse=[`event: response.image_generation_call.partial_image\ndata: ${JSON.stringify({type:'response.image_generation_call.partial_image',partial_image_b64:partial})}\n`,`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response:{id:'resp_stream',output:[{type:'image_generation_call',result:final}]}})}\n`,'data: [DONE]\n'].join('\n');const provider=new OpenAIImageProvider({apiKey:'sk-test',fetchImpl:async()=>new Response(sse,{status:200,headers:{'content-type':'text/event-stream'}})});const out=await provider.generate({id:'stream',projectId:'p',kind:'image',prompt:'hero',inputAssetIds:[],parameters:{stream:true,partial_images:1}},new AbortController().signal);assert.equal(out.outputs.length,1);assert.equal(out.providerMetadata?.responseId,'resp_stream')
});

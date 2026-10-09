import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerationProviderRegistry, type GenerationProvider, type GenerationRequest } from '../src/index.ts';

const provider=(id:string,kinds:any[],extra:Record<string,unknown>={}):GenerationProvider=>({manifest:()=>({provider:id,kinds,execution:'cloud',supportsTransparency:false,supportsMasks:false,supportsReferences:false,supportsStreaming:false,supportsCancellation:true,...extra}),generate:async()=>({requestId:'r',provider:id,model:'m',outputs:[]})});
const req:GenerationRequest={id:'r',projectId:'p',kind:'image',inputAssetIds:[],parameters:{}};
test('registry rejects duplicates and resolves deterministic exact/capability matches',()=>{const r=new GenerationProviderRegistry();r.register(provider('b',['image']));r.register(provider('a',['image'],{supportsTransparency:true}));assert.throws(()=>r.register(provider('a',['image'])),/duplicate/i);assert.equal(r.resolve({...req,provider:'b'}).manifest().provider,'b');assert.equal(r.resolve(req,{supportsTransparency:true}).manifest().provider,'a');assert.deepEqual(r.list().map(x=>x.provider),['a','b'])});
test('selected provider never silently falls back and requirements are enforced',()=>{const r=new GenerationProviderRegistry();r.register(provider('a',['image']));r.register(provider('b',['video']));assert.throws(()=>r.resolve({...req,provider:'b'}),/cannot|capability|image/i);assert.throws(()=>r.resolve(req,{supportsMasks:true}),/no generation provider/i)});

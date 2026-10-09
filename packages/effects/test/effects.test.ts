import test from 'node:test';
import assert from 'node:assert/strict';
import { EffectRegistry, evaluateNumberKeyframes, transitionProgress, maskAtFrame } from '../src/index.ts';

test('evaluates hold linear and bezier keyframes deterministically',()=>{
 assert.equal(evaluateNumberKeyframes([{frame:0,value:0,interpolation:'hold'},{frame:10,value:10,interpolation:'linear'}],5),0);
 assert.equal(evaluateNumberKeyframes([{frame:0,value:0,interpolation:'linear'},{frame:10,value:10,interpolation:'linear'}],5),5);
 const b=evaluateNumberKeyframes([{frame:0,value:0,interpolation:'bezier',outTangent:{x:.25,y:.1}},{frame:10,value:10,interpolation:'linear',inTangent:{x:.25,y:1}}],5);
 assert.ok(b>0&&b<10);
});

test('registry rejects duplicates and unknown effects',()=>{
 const r=new EffectRegistry(); r.register({type:'blur',params:{radius:'number'}});
 assert.throws(()=>r.register({type:'blur',params:{}}),/duplicate/i);
 assert.throws(()=>r.validate({id:'x',type:'nope',enabled:true,params:{}}),/unknown effect/i);
});

test('transition boundaries and rectangle mask interpolation are frame exact',()=>{
 assert.equal(transitionProgress(100,100,10),0); assert.equal(transitionProgress(105,100,10),.5); assert.equal(transitionProgress(110,100,10),1);
 const m=maskAtFrame({id:'m',kind:'rect',x:0,y:0,width:100,height:100,feather:0,invert:false,keyframes:{x:[{frame:0,value:0,interpolation:'linear'},{frame:10,value:20,interpolation:'linear'}]}},5);
 assert.equal(m.x,10);
});

test('effect registry exposes host capability declarations without enabling native plugins',async()=>{
 const { professionalEffectCapabilities }=await import('../src/index.ts');
 const caps=professionalEffectCapabilities();assert.equal(caps.openfx.nativeExecution,false);assert.equal(caps.openfx.parameterSerialization,true);assert.equal(caps.colorManagement.runtime,'declarative-only');
});

test('professional v04 effect catalog declares bounds expansion and non-silent GPU fallback',async()=>{
 const {v04EffectCatalog,effectBoundsExpansion,effectRenderPolicy}=await import('../src/index.ts');
 for(const name of ['gaussian-blur','directional-blur','drop-shadow','inner-shadow','glow','color-matrix','sharpen','grain','vignette','displacement','chromatic-separation','light-sweep'])assert.ok(v04EffectCatalog().includes(name));
 assert.equal(effectBoundsExpansion({type:'glow',params:{radius:20}}),40);
 assert.equal(effectBoundsExpansion({type:'drop-shadow',params:{radius:10,distance:15}}),35);
 assert.deepEqual(effectRenderPolicy('unsupported-experimental'),{backend:'cpu',diagnostic:'GPU parity unavailable; using CPU reference renderer'});
});

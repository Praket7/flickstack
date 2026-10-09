import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudioProcessor, compileAudioProcessor, compileAudioBusChain } from '../src/index.ts';

test('validates and compiles professional audio processors',()=>{
 const effects=[
  {id:'eq',type:'eq',enabled:true,params:{frequency:1000,gainDb:3,q:1}},
  {id:'c',type:'compressor',enabled:true,params:{thresholdDb:-18,ratio:4,attackMs:10,releaseMs:120}},
  {id:'l',type:'limiter',enabled:true,params:{limitDb:-1}},
  {id:'g',type:'gate',enabled:true,params:{thresholdDb:-45}},
 ];
 for(const e of effects){validateAudioProcessor(e); assert.ok(compileAudioProcessor(e).length>0);}
 assert.match(compileAudioBusChain({id:'music',name:'Music',effects,gainDb:-6,pan:0}),/volume=/);
});

test('ducking compiles a sidechain compressor path',()=>{
 const e={id:'duck',type:'ducking',enabled:true,params:{sidechainBusId:'dialogue',thresholdDb:-24,ratio:8,attackMs:15,releaseMs:250}};
 validateAudioProcessor(e); assert.match(compileAudioProcessor(e),/sidechaincompress/);
});

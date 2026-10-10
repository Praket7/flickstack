import test from 'node:test';import assert from 'node:assert/strict';import {analyzeScopes} from '../src/index.ts';
test('analyzes black and white pixels deterministically',()=>{const f=new Uint8Array([0,0,0,255,255,255,255,255]);const s=analyzeScopes(f,2,1);assert.equal(s.histogram.luma[0],1);assert.equal(s.histogram.luma[255],1);assert.equal(s.waveform.length,2)});

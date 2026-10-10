import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalImageEditHttpProvider,LocalVideoHttpProvider} from '../src/index.ts';
const resolveInputAsset=async()=>({bytes:Buffer.from('x'),mediaType:'image/png'});
test('local HTTP generation providers reject remote endpoints unless explicitly allowed',()=>{assert.throws(()=>new LocalVideoHttpProvider({baseUrl:'https://example.com',resolveInputAsset}),/localhost/i);assert.throws(()=>new LocalImageEditHttpProvider({baseUrl:'https://example.com',resolveInputAsset}),/localhost/i);assert.doesNotThrow(()=>new LocalVideoHttpProvider({baseUrl:'https://example.com',allowRemote:true,resolveInputAsset}));assert.doesNotThrow(()=>new LocalImageEditHttpProvider({baseUrl:'https://example.com',allowRemote:true,resolveInputAsset}))});

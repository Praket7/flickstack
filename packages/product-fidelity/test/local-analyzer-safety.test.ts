import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalProductAnalyzerHttp} from '../src/index.ts';
const resolveAsset=async()=>({bytes:Buffer.from('x'),mediaType:'image/png'});
test('local product analyzer rejects remote endpoint unless explicitly opted in',()=>{assert.throws(()=>new LocalProductAnalyzerHttp({baseUrl:'https://example.com',resolveAsset}),/localhost/i);assert.doesNotThrow(()=>new LocalProductAnalyzerHttp({baseUrl:'https://example.com',allowRemote:true,resolveAsset}))});

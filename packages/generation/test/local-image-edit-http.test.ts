import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalImageEditHttpProvider} from '../src/index.ts';

async function mock(){const s=createServer(async(req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return}let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');assert.equal(req.url,'/v1/image-edit');assert.equal(body.inputs[0].role,'source');assert.equal(body.inputs[1].role,'reference');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'local-anchor-fixture',outputs:[{imageBase64:Buffer.from('anchor-a').toString('base64')},{imageBase64:Buffer.from('anchor-b').toString('base64')}]}))});await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const a=s.address() as any;return{url:`http://127.0.0.1:${a.port}`,close:()=>new Promise<void>(r=>s.close(()=>r()))}}

test('local image editor creates multiple zero-cost anchor candidates',async()=>{const m=await mock(),root=mkdtempSync(join(tmpdir(),'local-image-'));try{const p=new LocalImageEditHttpProvider({baseUrl:m.url,stagingRoot:root,resolveInputAsset:async id=>({bytes:Buffer.from(id),mediaType:'image/png'})});assert.equal(p.manifest().execution,'local');assert.equal(p.manifest().estimatedCostUnits,0);const out=await p.generate({id:'anchor',projectId:'p',kind:'image-edit',prompt:'same bottle, lower camera',inputAssetIds:['source','angle-ref'],parameters:{candidateCount:2},seed:3},new AbortController().signal);assert.equal(out.outputs.length,2);assert.equal(readFileSync(out.outputs[1].path).toString(),'anchor-b');assert.equal(out.usage?.costUsd,0)}finally{await m.close();rmSync(root,{recursive:true,force:true})}});

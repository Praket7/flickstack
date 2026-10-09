import test from 'node:test';
import assert from 'node:assert/strict';
import { WikimediaCommonsProvider } from './wikimedia.ts';

const response=(payload:unknown)=>({ok:true,json:async()=>payload}) as any;

test('Wikimedia provider maps Commons metadata into explicit provenance',async()=>{
 const payload={query:{pages:{'123':{pageid:123,title:'File:Demo.jpg',imageinfo:[{url:'https://upload.wikimedia.org/demo.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Demo.jpg',extmetadata:{Artist:{value:'Demo Creator'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},UsageTerms:{value:'Creative Commons Attribution-Share Alike 4.0'}}}]}}}};
 const fakeFetch=async()=>response(payload);
 const provider=new WikimediaCommonsProvider({fetch:fakeFetch});
 const results=await provider.search('demo');
 assert.equal(results.length,1);
 assert.equal(results[0].provenance.provider,'wikimedia-commons');
 assert.equal(results[0].provenance.creator,'Demo Creator');
 assert.equal(results[0].provenance.commercialAllowed,true);
 assert.equal(results[0].provenance.attributionRequired,true);
 assert.match(results[0].provenance.license,/CC BY-SA 4.0/);
});

test('Wikimedia provider treats unrecognized licenses conservatively',async()=>{
 const payload={query:{pages:{'1':{pageid:1,title:'File:X',imageinfo:[{url:'https://x',descriptionurl:'https://c',extmetadata:{LicenseShortName:{value:'Custom license'}}}]}}}};
 const fakeFetch=async()=>response(payload);
 const results=await new WikimediaCommonsProvider({fetch:fakeFetch}).search('x');
 assert.equal(results[0].provenance.commercialAllowed,null);
});

test('Wikimedia download rejects non-Wikimedia and link-local URLs before fetch',async()=>{
 let called=false;
 const provider=new WikimediaCommonsProvider({fetch:async()=>{called=true;return response({});}});
 const asset={id:'x',title:'x',downloadUrl:'http://169.254.169.254/latest/meta-data',provenance:{provider:'wikimedia-commons',originalUrl:'https://commons.wikimedia.org/wiki/File:X',license:'CC0',commercialAllowed:true,attributionRequired:false,retrievedAt:'2026-10-08T00:00:00Z'}};
 await assert.rejects(()=>provider.download(asset,'/tmp/never-written'),/trusted Wikimedia|upload\.wikimedia\.org|HTTPS/i);
 assert.equal(called,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseAsset, buildAttribution, type ProvenanceRecord } from './provenance.ts';

const good:ProvenanceRecord={provider:'wikimedia',creator:'Example',originalUrl:'https://commons.wikimedia.org/x',license:'CC BY 4.0',commercialAllowed:true,attributionRequired:true,retrievedAt:'2026-10-06T00:00:00Z'};

test('unknown rights block automatic inclusion',()=>{
 assert.deepEqual(canUseAsset({...good,license:'unknown',commercialAllowed:null},'commercial'),{allowed:false,reason:'license is unknown'});
 assert.equal(canUseAsset({...good,commercialAllowed:false},'commercial').allowed,false);
});

test('usable records carry a deterministic attribution line',()=>{
 assert.equal(canUseAsset(good,'commercial').allowed,true);
 assert.equal(buildAttribution(good),'Example — CC BY 4.0 — https://commons.wikimedia.org/x');
});

test('missing source provenance blocks use even when a license string exists',()=>{
 assert.equal(canUseAsset({...good,originalUrl:''},'noncommercial').allowed,false);
});

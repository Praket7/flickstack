import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaSearchIndex } from '../../search/src/search.ts';
import { planCoverage } from './coverage.ts';

test('coverage graph links each beat to source interval, confidence, role and alternatives', () => {
  const index = new MediaSearchIndex(':memory:');
  index.add({assetId:'founder',start:0,end:60,transcript:'we built FlickSmith to edit locally',visual:'founder speaking',tags:['hook','human']});
  index.add({assetId:'macro',start:60,end:120,transcript:'',visual:'close macro product interface',tags:['product','detail']});
  index.add({assetId:'screen',start:0,end:90,transcript:'render finishes fast',visual:'software dashboard render screen',tags:['screen','proof']});
  const plan = planCoverage({id:'b', title:'launch', beats:[
    {id:'hook', query:'founder hook', role:'hook'},
    {id:'product', query:'product closeup', role:'proof'},
  ]}, index);
  assert.equal(plan.beats.length, 2);
  assert.equal(plan.beats[0].beatId, 'hook');
  assert.ok(plan.beats[0].primary?.assetId);
  assert.ok((plan.beats[0].primary?.confidence ?? 0) > 0);
  assert.equal(plan.coverageDebt, 0);
});

test('coverage debt makes missing story beats explicit', () => {
  const index = new MediaSearchIndex(':memory:');
  const plan = planCoverage({id:'b',title:'ad',beats:[{id:'cta',query:'purchase call to action',role:'cta'}]}, index);
  assert.equal(plan.coverageDebt, 1);
  assert.deepEqual(plan.uncoveredBeatIds, ['cta']);
});

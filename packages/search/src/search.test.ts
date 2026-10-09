import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaSearchIndex } from './search.ts';

test('ranks transcript and visual evidence together with time ranges', () => {
  const index = new MediaSearchIndex(':memory:');
  index.add({ assetId:'founder', start:0, end:90, transcript:'We built the fastest local video editor', visual:'person speaking to camera, product on desk', tags:['hook','human'] });
  index.add({ assetId:'macro', start:30, end:80, transcript:'', visual:'close macro product shot metallic device rotating', tags:['product','detail'] });
  index.add({ assetId:'screen', start:0, end:60, transcript:'dashboard loads instantly', visual:'software dashboard screen recording', tags:['screen'] });
  const results = index.search('strongest product closeup', { limit:2 });
  assert.equal(results[0].assetId, 'macro');
  assert.ok(results[0].score > results[1].score);
  assert.deepEqual([results[0].start, results[0].end], [30,80]);
});

test('task-aware search can prefer spoken evidence', () => {
  const index = new MediaSearchIndex(':memory:');
  index.add({ assetId:'a', start:0, end:30, transcript:'battery lasts all day', visual:'person talking', tags:[] });
  index.add({ assetId:'b', start:0, end:30, transcript:'', visual:'battery icon on screen', tags:[] });
  assert.equal(index.search('battery lasts all day', { modality:'speech' })[0].assetId, 'a');
});

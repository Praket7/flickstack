import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';

test('production Studio mounts real layer timeline dope-sheet and inspector panels',()=>{
 const studio=readFileSync('apps/studio/src/FlickSmithStudio.tsx','utf8');
 for(const panel of ['LayerTree','Timeline','DopeSheet','PropertyInspector'])assert.match(studio,new RegExp(`<${panel}\\b`),`${panel} must be mounted in production Studio`);
 assert.doesNotMatch(studio,/model\.layers\.map\(layer=>\<button/, 'legacy inline layer list must be removed');
});

test('authoring panels expose edit callbacks instead of hardcoded demo state',()=>{
 for(const file of ['LayerTree.tsx','Timeline.tsx','DopeSheet.tsx','PropertyInspector.tsx']){
  const src=readFileSync(`apps/studio/src/panels/${file}`,'utf8');
  assert.match(src,/on[A-Z][A-Za-z]+/);
  assert.doesNotMatch(src,/Founder intro|Product macro|Pulse 118/);
 }
});

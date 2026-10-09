import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('TrackingPanel exposes region, solve, confidence, correction, apply and bake controls',()=>{
  const source=readFileSync(new URL('./TrackingPanel.tsx',import.meta.url),'utf8');
  for(const token of ['Point track','Planar track','Solve','Confidence','Forward/backward','Manual correction','Apply','Bake','Region']) assert.match(source,new RegExp(token,'i'));
  assert.match(source,/solverCapability/);
  assert.match(source,/onSolve/);
  assert.match(source,/onApply/);
});

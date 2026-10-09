import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { evaluateMotionComposition } from '../../motion/src/v3.ts';
import type { FlickProjectV3 } from '../../schema/src/v3/project.ts';

const project=JSON.parse(readFileSync('benchmarks/v0.4/scenes/parallax-camera.flick.json','utf8')) as FlickProjectV3;
const expected=JSON.parse(readFileSync('crates/flick-motion-runtime/tests/fixtures/runtime-parity.json','utf8')) as Array<any>;

test('native runtime parity fixture covers every frame and current semantic evaluator remains deterministic',()=>{
  const comp=project.motionCompositions[0];
  assert.equal(expected.length,comp.duration);
  for(const row of expected){
    const scene=evaluateMotionComposition(comp,row.frame,{fps:30,surface:{width:comp.width,height:comp.height},seed:42,audio:{energy:.4,low:.2,mid:.3,high:.5}});
    const ids=['camera','panel','ui-surface','title'];
    for(const id of ids){
      const layer=scene.layers.find(l=>l.id===id); const saved=row.layers[id];
      assert.ok(layer,`${id}@${row.frame}`);
      assert.deepEqual(layer!.localPosition.map(v=>+v.toFixed(6)),saved.localPosition);
      assert.deepEqual(layer!.worldPosition.map(v=>+v.toFixed(6)),saved.worldPosition);
      assert.equal(+layer!.opacity.toFixed(6),saved.opacity);
    }
  }
});

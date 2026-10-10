import test from 'node:test';
import assert from 'node:assert/strict';
import {withHumanCraftGate} from '../src/craft.ts';
import type {CreativeActionPlan} from '../src/actions.ts';
test('human craft gate runs after picture QC and is idempotent',()=>{const plan:CreativeActionPlan={version:1,briefId:'b',baseRevision:'r',actions:[{id:'qc',type:'qc',scope:{compositionId:'c'},rationale:'check'}],dependencies:{qc:[]}};const gated=withHumanCraftGate(plan,'c',85);const craft=gated.actions.find(a=>a.type==='craft_review');assert.ok(craft);assert.equal(craft.minimumScore,85);assert.deepEqual(gated.dependencies['human-craft-review'],['qc']);assert.equal(withHumanCraftGate(gated,'c').actions.filter(a=>a.type==='craft_review').length,1)});

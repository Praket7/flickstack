import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLoudnessPlan, buildAudioRepairPlan, createAutomationLane, sampleAutomation } from '../src/index.ts';

test('audio automation is deterministic and interpolates gain', () => {
  const lane = createAutomationLane('gainDb', [{ frame: 0, value: -12 }, { frame: 30, value: 0 }]);
  assert.equal(sampleAutomation(lane, 15), -6);
  assert.equal(sampleAutomation(lane, 30), 0);
});

test('loudness planner targets delivery LUFS without pretending to measure unavailable audio', () => {
  const plan = analyzeLoudnessPlan({ measuredLufs: -20, targetLufs: -14, truePeakDbtp: -3 });
  assert.equal(plan.gainDb, 6);
  assert.equal(plan.targetLufs, -14);
  assert.ok(plan.limiterCeilingDbtp <= -1);
});

test('repair plan is explicit and non-destructive', () => {
  const repair = buildAudioRepairPlan({ noise: 0.7, clipping: true, dialogue: true });
  assert.ok(repair.steps.some((step) => step.kind === 'denoise'));
  assert.ok(repair.steps.some((step) => step.kind === 'declip'));
  assert.equal(repair.destructive, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOperation, type EditOperation } from './apply.ts';
import type { FlickProject } from '../../schema/src/project.ts';

function project(): FlickProject {
  return {
    version: 1, id: 'p', name: 'P',
    format: { width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 }, audioSampleRate: 48000 },
    assets: [{ id: 'a', path: '/media/a.mp4', kind: 'video', duration: 300 }],
    tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [{ id: 'c1', assetId: 'a', start: 0, duration: 90, sourceIn: 0 }] }],
    markers: [], style: {}, provenance: [], checkpoints: [], branches: []
  };
}

test('add_clip is immutable and returns diff/checkpoint/receipt', () => {
  const before = project();
  const op: EditOperation = { type: 'add_clip', trackId: 'v1', clip: { id: 'c2', assetId: 'a', start: 120, duration: 30, sourceIn: 90 }, intent: 'add ending shot' };
  const result = applyOperation(before, op);
  assert.equal(before.tracks[0].clips.length, 1);
  assert.equal(result.project.tracks[0].clips.length, 2);
  assert.match(result.checkpointId, /^cp_/);
  assert.equal(result.diff.changes[0].kind, 'clip_added');
  assert.equal(result.receipt.intent, 'add ending shot');
  assert.deepEqual(result.receipt.affectedRanges, [{ trackId: 'v1', start: 120, end: 150 }]);
});

test('split_clip preserves total duration and source continuity', () => {
  const result = applyOperation(project(), { type: 'split_clip', trackId: 'v1', clipId: 'c1', at: 30, rightClipId: 'c1b' });
  const clips = result.project.tracks[0].clips;
  assert.deepEqual(clips.map(c => [c.id, c.start, c.duration, c.sourceIn]), [
    ['c1', 0, 30, 0], ['c1b', 30, 60, 30]
  ]);
});

test('ripple_delete closes the gap for subsequent clips', () => {
  const p = project();
  p.tracks[0].clips.push({ id: 'c2', assetId: 'a', start: 100, duration: 20, sourceIn: 100 });
  const result = applyOperation(p, { type: 'ripple_delete', trackId: 'v1', clipId: 'c1' });
  assert.deepEqual(result.project.tracks[0].clips.map(c => [c.id, c.start]), [['c2', 10]]);
});

test('locked clip rejects mutation with actionable error', () => {
  const p = project();
  p.tracks[0].clips[0].locked = true;
  assert.throws(() => applyOperation(p, { type: 'trim_clip', trackId: 'v1', clipId: 'c1', start: 0, duration: 30, sourceIn: 0 }), /locked.*c1/i);
});

test('overlapping video clips on same track are rejected', () => {
  assert.throws(() => applyOperation(project(), { type: 'add_clip', trackId: 'v1', clip: { id: 'c2', assetId: 'a', start: 80, duration: 30, sourceIn: 0 } }), /overlap/i);
});

test('semantic preserve lock blocks destructive edits but allows safe volume changes', () => {
  const p = project();
  p.semanticLocks = [{ id: 'lock-hook', label: 'Preserve founder hook', rule: 'preserve', trackId: 'v1', clipId: 'c1' }];
  assert.throws(() => applyOperation(p, { type: 'ripple_delete', trackId: 'v1', clipId: 'c1', intent: 'shorten opening' }), /semantic lock.*Preserve founder hook/i);
  const safe = applyOperation(p, { type: 'set_volume', trackId: 'v1', clipId: 'c1', volume: 0.9, intent: 'lower hook audio' });
  assert.deepEqual(safe.receipt.semanticLocksRespected, ['lock-hook']);
});

test('semantic position lock prevents move and trim while preserving content', () => {
  const p = project();
  p.semanticLocks = [{ id: 'lock-cta', label: 'CTA timing', rule: 'position', trackId: 'v1', clipId: 'c1' }];
  assert.throws(() => applyOperation(p, { type: 'move_clip', trackId: 'v1', clipId: 'c1', start: 10 }), /semantic lock.*CTA timing/i);
  assert.throws(() => applyOperation(p, { type: 'trim_clip', trackId: 'v1', clipId: 'c1', start: 0, duration: 80, sourceIn: 0 }), /semantic lock.*CTA timing/i);
});

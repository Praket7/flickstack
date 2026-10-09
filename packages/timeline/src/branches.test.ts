import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoGitStore } from './branches.ts';
import { applyOperation } from './apply.ts';
import type { FlickProject } from '../../schema/src/project.ts';

function base(): FlickProject {
  return {
    version: 1, id: 'p', name: 'P',
    format: { width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 }, audioSampleRate: 48000 },
    assets: [{ id: 'a', path: '/m/a.mp4', kind: 'video', duration: 300 }],
    tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [{ id: 'c1', assetId: 'a', start: 0, duration: 90, sourceIn: 0 }] }],
    markers: [], style: {}, provenance: [], checkpoints: [], branches: []
  };
}

test('editing a branch never mutates its parent branch', () => {
  const store = new VideoGitStore(base());
  store.createBranch('energetic', 'main');
  const edited = applyOperation(store.get('energetic'), { type: 'set_speed', trackId: 'v1', clipId: 'c1', speed: 1.25 });
  store.update('energetic', edited.project, edited.receipt);
  assert.equal(store.get('main').tracks[0].clips[0].speed, undefined);
  assert.equal(store.get('energetic').tracks[0].clips[0].speed, 1.25);
});

test('intent diff describes semantic edit receipts between branches', () => {
  const store = new VideoGitStore(base());
  store.createBranch('fast', 'main');
  const edited = applyOperation(store.get('fast'), { type: 'set_speed', trackId: 'v1', clipId: 'c1', speed: 1.4, intent: 'make hook feel faster' });
  store.update('fast', edited.project, edited.receipt);
  const diff = store.diffBranches('main', 'fast');
  assert.equal(diff.receipts.length, 1);
  assert.equal(diff.receipts[0].intent, 'make hook feel faster');
  assert.equal(diff.changedClipIds[0], 'c1');
});

test('merge refuses unresolved conflicts instead of silently overwriting', () => {
  const store = new VideoGitStore(base());
  store.createBranch('a', 'main');
  store.createBranch('b', 'main');
  const a = applyOperation(store.get('a'), { type: 'set_speed', trackId: 'v1', clipId: 'c1', speed: 1.2 });
  const b = applyOperation(store.get('b'), { type: 'set_speed', trackId: 'v1', clipId: 'c1', speed: 0.8 });
  store.update('a', a.project, a.receipt);
  store.update('b', b.project, b.receipt);
  assert.throws(() => store.mergeBranch('a', 'b'), /conflict.*c1/i);
});

test('Video Git state round-trips with branches and intent receipts intact', () => {
  const p = base(); const store = new VideoGitStore(p); store.createBranch('energetic');
  const edited = applyOperation(store.get('energetic'), { type:'move_clip', trackId:'v1', clipId:'c1', start:15, intent:'Delay reveal for tension' });
  store.update('energetic', edited.project, edited.receipt);
  const restored = VideoGitStore.fromState(store.exportState());
  assert.equal(restored.get('main').tracks[0].clips[0].start,0);
  assert.equal(restored.get('energetic').tracks[0].clips[0].start,15);
  assert.equal(restored.diffBranches('main','energetic').receipts[0].intent,'Delay reveal for tension');
});

test('undo restores the previous branch snapshot and removes the reverted intent receipt', () => {
  const store = new VideoGitStore(base()); store.createBranch('edit');
  const first = applyOperation(store.get('edit'), { type:'set_speed', trackId:'v1', clipId:'c1', speed:1.2, intent:'speed it up' }); store.update('edit', first.project, first.receipt);
  const second = applyOperation(store.get('edit'), { type:'move_clip', trackId:'v1', clipId:'c1', start:15, intent:'move it later' }); store.update('edit', second.project, second.receipt);
  const undone = store.undo('edit');
  assert.equal(undone.tracks[0].clips[0].start,0);
  assert.equal(undone.tracks[0].clips[0].speed,1.2);
  assert.equal(store.diffBranches('main','edit').receipts.at(-1)?.intent,'speed it up');
});

test('restoreCheckpoint jumps to an exact prior checkpoint and truncates later history', () => {
  const store = new VideoGitStore(base()); store.createBranch('edit');
  const first = applyOperation(store.get('edit'), { type:'set_speed', trackId:'v1', clipId:'c1', speed:1.2, intent:'speed it up' }); store.update('edit', first.project, first.receipt);
  const second = applyOperation(store.get('edit'), { type:'move_clip', trackId:'v1', clipId:'c1', start:15, intent:'move it later' }); store.update('edit', second.project, second.receipt);
  const restored = store.restoreCheckpoint('edit', first.checkpointId);
  assert.equal(restored.tracks[0].clips[0].start,0);
  assert.equal(restored.tracks[0].clips[0].speed,1.2);
  assert.throws(()=>store.restoreCheckpoint('edit',second.checkpointId),/unknown checkpoint/i);
});

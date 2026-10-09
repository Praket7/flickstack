import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1ToV2, parseAnyProject } from '../src/index.ts';
import type { FlickProject } from '../src/project.ts';

function v1(): FlickProject {
  return {
    version: 1, id: 'p', name: 'P', format: { width: 1920, height: 1080, fps: { numerator: 30000, denominator: 1001 }, audioSampleRate: 48000 },
    assets: [{ id: 'a', path: '/tmp/a.mp4', kind: 'video', duration: 300 }],
    tracks: [
      { id: 'v', kind: 'video', name: 'Video', clips: [{ id: 'c', assetId: 'a', start: 0, duration: 120, sourceIn: 3, volume: 0.5 }] },
      { id: 'm', kind: 'motion', name: 'Motion', clips: [{ id: 'mg', start: 10, duration: 30, sourceIn: 0, component: 'kinetic-title', props: { text: 'Hi' } }] },
    ], markers: [], style: {}, provenance: [], checkpoints: [{ id:'cp0', createdAt:'2026-01-01T00:00:00Z' }], branches: [{ name:'main', checkpointId:'cp0' }], semanticLocks:[{id:'lock',label:'keep',rule:'preserve',clipId:'c'}]
  };
}

test('migrates v1 without mutation and preserves exact timing/id semantics', () => {
  const input = v1();
  const before = structuredClone(input);
  const out = migrateV1ToV2(input);
  assert.deepEqual(input, before);
  assert.equal(out.version, 2);
  assert.deepEqual(out.format.fps, { numerator: 30000, denominator: 1001 });
  assert.equal(out.assets[0].id, 'a');
  assert.equal(out.semanticLocks?.[0].id, 'lock');
  assert.equal(out.compositions[0].tracks[0].clips[0].id, 'c');
  assert.equal(out.compositions[0].tracks[0].clips[0].blendMode, 'normal');
  assert.equal(out.compositions[0].tracks[1].clips[0].component, 'kinetic-title');
  assert.equal(out.audioBuses[0].id, 'master');
});

test('parseAnyProject upgrades v1 in memory and accepts v2', () => {
  const migrated = parseAnyProject(v1());
  assert.equal(migrated.version, 2);
  assert.equal(parseAnyProject(migrated).version, 2);
});

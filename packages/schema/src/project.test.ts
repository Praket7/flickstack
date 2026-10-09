import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProject,
  serializeProject,
  rational,
  frameTick,
  type FlickProject,
} from './project.ts';

test('rational preserves NTSC 30000/1001 exactly', () => {
  assert.deepEqual(rational(30000, 1001), { numerator: 30000, denominator: 1001 });
});

test('frame ticks must be integers', () => {
  assert.equal(frameTick(90), 90);
  assert.throws(() => frameTick(90.5), /integer frame tick/i);
});

test('project parser rejects floating-point clip positions', () => {
  const bad = {
    version: 1,
    id: 'p1',
    name: 'Bad',
    format: { width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 }, audioSampleRate: 48000 },
    assets: [],
    tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [{ id: 'c1', assetId: 'a1', start: 1.25, duration: 30, sourceIn: 0 }] }],
    markers: [],
    style: {},
    provenance: [],
    checkpoints: [],
    branches: []
  };
  assert.throws(() => parseProject(bad), /start.*integer/i);
});

test('minimal project round-trips through canonical serialization', () => {
  const project: FlickProject = {
    version: 1,
    id: 'launch-ad',
    name: 'Launch Ad',
    format: { width: 1080, height: 1920, fps: { numerator: 30000, denominator: 1001 }, audioSampleRate: 48000 },
    assets: [], tracks: [], markers: [], style: {}, provenance: [], checkpoints: [], branches: []
  };
  const parsed = parseProject(JSON.parse(serializeProject(project)));
  assert.deepEqual(parsed, project);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { conformRelink, exportEdl, exportFcpXml, exportOtioV3, importOtioV3 } from '../src/index.ts';

const project = {
  projectVersion: 3,
  id: 'p1',
  name: 'Roundtrip',
  revision: 1,
  format: { width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 }, pixelAspectRatio: 1 },
  assets: [
    { id: 'a1', kind: 'video', uri: 'media/hero.mov', contentHash: 'sha256:abc' },
    { id: 'a2', kind: 'audio', uri: 'media/music.wav', contentHash: 'sha256:def' },
  ],
  timeline: {
    rootCompositionId: 'root',
    compositions: [{
      id: 'root',
      name: 'Master',
      duration: 120,
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: [{ id: 'c1', assetId: 'a1', start: 15, in: 30, duration: 60, enabled: true }] },
        { id: 'a1-track', kind: 'audio', name: 'A1', clips: [{ id: 'c2', assetId: 'a2', start: 0, in: 0, duration: 120, enabled: true }] },
      ],
    }],
  },
};

test('OTIO v3 bridge exports real tracks and round-trips canonical project identity', () => {
  const otio: any = exportOtioV3(project as never);
  assert.equal(otio.tracks.children.length, 2);
  assert.equal(otio.tracks.children[0].kind, 'Video');
  assert.equal(otio.tracks.children[0].children[0].OTIO_SCHEMA, 'Gap.1');
  assert.equal(otio.tracks.children[0].children[1].OTIO_SCHEMA, 'Clip.2');
  assert.equal(otio.tracks.children[0].children[1].media_reference.target_url, 'media/hero.mov');
  const imported = importOtioV3(otio);
  assert.equal(imported.name, 'Roundtrip');
  assert.equal(imported.assets[0]?.uri, 'media/hero.mov');
  assert.equal(imported.timeline.compositions[0].tracks[0].clips[0].start, 15);
});

test('imports external OTIO tracks even without FlickSmith snapshot metadata', () => {
  const otio: any = exportOtioV3(project as never);
  delete otio.metadata.flicksmith.snapshot;
  const imported = importOtioV3(otio);
  assert.equal(imported.assets.length, 2);
  assert.equal(imported.timeline.compositions[0].tracks.length, 2);
  assert.equal(imported.timeline.compositions[0].tracks[0].clips[0].in, 30);
});

test('exports safe FCPXML and CMX3600 EDL with actual clip timing', () => {
  const fcpxml = exportFcpXml(project as never);
  assert.match(fcpxml, /<fcpxml/);
  assert.match(fcpxml, /<asset-clip[^>]+offset="0\.5s"[^>]+start="1s"[^>]+duration="2s"/);
  assert.doesNotMatch(fcpxml, /<!DOCTYPE|<!ENTITY/i);
  const edl = exportEdl(project as never);
  assert.match(edl, /TITLE: Roundtrip/);
  assert.match(edl, /00:00:01:00 00:00:03:00 00:00:00:15 00:00:02:15/);
  assert.match(edl, /hero\.mov/);
});

test('conform relink prefers content hash and reports unresolved media explicitly', () => {
  const result = conformRelink(project as never, [
    { uri: '/mnt/new/hero.mov', contentHash: 'sha256:abc' },
  ]);
  assert.equal(result.resolved[0]?.assetId, 'a1');
  assert.equal(result.unresolved[0]?.assetId, 'a2');
});

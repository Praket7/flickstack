import test from 'node:test';
import assert from 'node:assert/strict';
import { conformRelink, exportEdl, exportFcpXml, exportOtioV3, importOtioV3 } from '../src/index.ts';

const project = {
  projectVersion: 3,
  id: 'p1',
  name: 'Roundtrip',
  revision: 1,
  frameRate: 30,
  width: 1920,
  height: 1080,
  durationFrames: 120,
  assets: [{ id: 'a1', kind: 'video', uri: 'media/hero.mov', contentHash: 'sha256:abc' }],
  compositions: [],
};

test('OTIO v3 bridge round-trips project identity and media references', () => {
  const otio = exportOtioV3(project as never);
  const imported = importOtioV3(otio);
  assert.equal(imported.name, 'Roundtrip');
  assert.equal(imported.assets[0]?.uri, 'media/hero.mov');
});

test('exports safe FCPXML and CMX3600 EDL without external entities', () => {
  const fcpxml = exportFcpXml(project as never);
  assert.match(fcpxml, /<fcpxml/);
  assert.doesNotMatch(fcpxml, /<!DOCTYPE|<!ENTITY/i);
  const edl = exportEdl(project as never);
  assert.match(edl, /TITLE: Roundtrip/);
});

test('conform relink prefers content hash and reports unresolved media explicitly', () => {
  const result = conformRelink(project as never, [
    { uri: '/mnt/new/hero.mov', contentHash: 'sha256:abc' },
  ]);
  assert.equal(result.resolved[0]?.assetId, 'a1');
  assert.equal(result.unresolved.length, 0);
});

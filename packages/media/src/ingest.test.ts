import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { probeMedia, normalizeMediaTiming, createProxy } from './ingest.ts';

function makeVideo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'flicksmith-media-'));
  const file = join(dir, 'source.mp4');
  const r = spawnSync('ffmpeg', ['-y','-f','lavfi','-i','color=c=blue:s=320x240:r=30:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file], { encoding:'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return file;
}

test('probeMedia returns normalized video/audio metadata', () => {
  const file = makeVideo();
  const meta = probeMedia(file);
  assert.equal(meta.video?.width, 320);
  assert.equal(meta.video?.height, 240);
  assert.deepEqual(meta.video?.fps, { numerator: 30, denominator: 1 });
  assert.ok((meta.durationSeconds ?? 0) > 0.9);
  assert.ok(meta.audio?.sampleRate);
});

test('normalizeMediaTiming distinguishes variable frame rate metadata', () => {
  const timing = normalizeMediaTiming({ r_frame_rate: '30/1', avg_frame_rate: '24000/1001', time_base: '1/90000' });
  assert.equal(timing.variableFrameRate, true);
  assert.deepEqual(timing.fps, { numerator: 24000, denominator: 1001 });
});

test('missing and corrupt files return explicit errors', () => {
  assert.throws(() => probeMedia('/definitely/missing/flicksmith.mp4'), /does not exist/i);
  const dir = mkdtempSync(join(tmpdir(), 'flicksmith-corrupt-'));
  const bad = join(dir, 'bad.mp4');
  writeFileSync(bad, 'not-a-video');
  assert.throws(() => probeMedia(bad), /ffprobe failed/i);
});

test('createProxy writes a new proxy without overwriting source', () => {
  const file = makeVideo();
  const output = join(file.replace(/source\.mp4$/, ''), 'proxy.mp4');
  const result = createProxy(file, output, { maxWidth: 160, crf: 30 });
  assert.equal(result, output);
  assert.equal(existsSync(file), true);
  assert.equal(existsSync(output), true);
  assert.equal(probeMedia(output).video?.width, 160);
});

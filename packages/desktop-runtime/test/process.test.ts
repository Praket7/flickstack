import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { RestrictedProcessRunner, probeFFmpegCapability, probeDesktopGpuCapability } from '../src/process.ts';

const sleep = (ms:number) => new Promise(r => setTimeout(r, ms));

test('restricted runner rejects executable and working-root escapes', async () => {
  const root = mkdtempSync(join(tmpdir(),'flick-runner-'));
  try {
    const node = realpathSync(process.execPath);
    const runner = new RestrictedProcessRunner({ allowedExecutables:[node], allowedRoots:[root] });
    await assert.rejects(() => runner.run('/bin/sh',['-c','echo bad'],{cwd:root,timeoutMs:1000}), /not allowlisted/i);
    await assert.rejects(() => runner.run(node,['-e','process.exit(0)'],{cwd:dirname(root),timeoutMs:1000}), /outside allowed roots/i);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('restricted runner kills on timeout and AbortSignal cancellation', async () => {
  const root = mkdtempSync(join(tmpdir(),'flick-runner-'));
  try {
    const node = realpathSync(process.execPath);
    const runner = new RestrictedProcessRunner({ allowedExecutables:[node], allowedRoots:[root] });
    const timed = await runner.run(node,['-e','setTimeout(()=>{},10000)'],{cwd:root,timeoutMs:30});
    assert.equal(timed.timedOut,true);
    const controller = new AbortController();
    const pending = runner.run(node,['-e','setTimeout(()=>{},10000)'],{cwd:root,timeoutMs:5000,signal:controller.signal});
    await sleep(20); controller.abort();
    const cancelled = await pending;
    assert.equal(cancelled.cancelled,true);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('desktop capability probes return structured FFmpeg and GPU metadata', async () => {
  const ff = await probeFFmpegCapability();
  assert.equal(typeof ff.ffmpeg.available,'boolean');
  assert.equal(typeof ff.ffprobe.available,'boolean');
  if (ff.ffmpeg.available) assert.match(ff.ffmpeg.version ?? '', /ffmpeg version/i);
  const gpu = await probeDesktopGpuCapability();
  assert.equal(typeof gpu.webViewGpu,'string');
  assert.equal(typeof gpu.nativeWgpuAvailable,'boolean');
});

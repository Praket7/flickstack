import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(process.cwd(), 'benchmarks', 'v0.4');

function readJson(path:string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

test('v0.4 benchmark corpus contains ten editable professional-motion fixtures with pinned release thresholds', () => {
  const manifest = readJson(join(root, 'expected', 'manifest.json')) as {
    version:string;
    parity:{rgbRmseMax:number;alphaRmseMax:number;timingErrorFrames:number};
    premium:{endCardHoldFrames30fps:number;minGeneratedUiTextPx:number;staticFrameRatioMax:number;multiPropertyShotCoverageMin:number;layeredMotionCoverageMin:number};
    scenes:Array<{id:string;file:string;requiredCapabilities:string[];targetFrames:number[];cpu:{hash:string|null;tolerance:number}}>;
  };

  assert.equal(manifest.version, '0.4');
  assert.equal(manifest.parity.rgbRmseMax, 0.02);
  assert.equal(manifest.parity.alphaRmseMax, 0.005);
  assert.equal(manifest.parity.timingErrorFrames, 0);
  assert.equal(manifest.premium.endCardHoldFrames30fps, 45);
  assert.equal(manifest.premium.minGeneratedUiTextPx, 18);
  assert.equal(manifest.premium.staticFrameRatioMax, 0.5);
  assert.equal(manifest.premium.multiPropertyShotCoverageMin, 0.5);
  assert.equal(manifest.premium.layeredMotionCoverageMin, 0.4);
  assert.equal(manifest.scenes.length, 10);

  const ids = new Set(manifest.scenes.map((s) => s.id));
  assert.deepEqual(ids, new Set([
    'kinetic-type','dense-ui-closeup','responsive-layout','nested-masks-mattes','parallax-camera',
    'dof-motion-blur','effect-graph','shared-element-transition','procedural-falloff','audio-reactive',
  ]));

  const diskFiles = new Set(readdirSync(join(root, 'scenes')).filter((f) => f.endsWith('.flick.json')));
  for (const scene of manifest.scenes) {
    assert.ok(diskFiles.has(scene.file), `missing ${scene.file}`);
    assert.ok(scene.requiredCapabilities.length > 0, `${scene.id} must declare capabilities`);
    assert.ok(scene.targetFrames.length >= 3, `${scene.id} must pin target frames`);
    assert.equal(scene.cpu.hash, null, `${scene.id} starts without a golden until native CPU renderer exists`);
    assert.ok(scene.cpu.tolerance > 0);

    const project = readJson(join(root, 'scenes', scene.file)) as any;
    assert.equal(project.version, 3);
    assert.ok(Array.isArray(project.motionCompositions) && project.motionCompositions.length > 0, `${scene.id} needs editable motion composition`);
    const layers = project.motionCompositions.flatMap((c:any) => c.layers ?? []);
    assert.ok(layers.length > 0, `${scene.id} needs editable layers`);
    const generatedClipProxy = (project.assets ?? []).some((a:any) => a?.props?.generatedVisualProxy === true || a?.props?.flattenedGeneratedScene === true);
    assert.equal(generatedClipProxy, false, `${scene.id} may not use flattened generated visual proxies`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { IsolatedOpenFxHost } from '../src/index.ts';

test('OpenFX host runs out of process with shell disabled and permitted plugin roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flick-openfx-'));
  const plugin = join(root, 'effect.ofx');
  const hostScript = join(root, 'host.mjs');
  await writeFile(plugin, 'fixture');
  await writeFile(hostScript, "if (!process.argv.includes('--plugin')) process.exit(2); process.exit(0);\n");
  const host = new IsolatedOpenFxHost({ hostExecutable: process.execPath, hostArguments: [hostScript], permittedPluginRoots: [root], timeoutMs: 2_000 });
  const result = await host.render({ pluginPath: plugin, effectId: 'com.example.effect', inputPath: join(root, 'in.rgba'), outputPath: join(root, 'out.rgba'), frame: 0 });
  assert.equal(result.ok, true);
  await assert.rejects(() => host.render({ pluginPath: join(root, '..', 'escape.ofx'), effectId: 'bad', inputPath: 'in', outputPath: 'out', frame: 0 }), /outside permitted roots/);
});

test('OpenFX host kills hung plugin processes without crashing the editor process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flick-openfx-timeout-'));
  const plugin = join(root, 'effect.ofx');
  const hostScript = join(root, 'hang.mjs');
  await writeFile(plugin, 'fixture');
  await writeFile(hostScript, 'setInterval(() => {}, 1000);\n');
  const host = new IsolatedOpenFxHost({ hostExecutable: process.execPath, hostArguments: [hostScript], permittedPluginRoots: [root], timeoutMs: 100 });
  const result = await host.render({ pluginPath: plugin, effectId: 'hang', inputPath: join(root, 'in'), outputPath: join(root, 'out'), frame: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
});

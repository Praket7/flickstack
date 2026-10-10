import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionRegistry, validateExtensionManifest } from '../src/index.ts';

test('SDK accepts permissioned extensions and rejects general shell/project authority', () => {
  const manifest = validateExtensionManifest({
    id: 'example.generator', version: '1.0.0', apiVersion: 1, kind: 'generation-provider',
    permissions: ['network', 'write-staging', 'credential-handle'], entrypoint: './index.js',
  });
  assert.equal(manifest.id, 'example.generator');
  assert.throws(() => validateExtensionManifest({ ...manifest, permissions: ['shell'] as never }), /permission/i);
  assert.throws(() => validateExtensionManifest({ ...manifest, permissions: ['write-project'] as never }), /permission/i);
});

test('registry rejects duplicate ids and incompatible API versions', () => {
  const registry = new ExtensionRegistry({ apiVersion: 1 });
  registry.register({ id: 'qc.a', version: '1.0.0', apiVersion: 1, kind: 'qc-rule', permissions: ['read-project-assets'], entrypoint: './qc.js' });
  assert.throws(() => registry.register({ id: 'qc.a', version: '1.1.0', apiVersion: 1, kind: 'qc-rule', permissions: [], entrypoint: './qc2.js' }), /already registered/i);
  assert.throws(() => registry.register({ id: 'qc.b', version: '1.0.0', apiVersion: 2, kind: 'qc-rule', permissions: [], entrypoint: './qc.js' }), /API version/i);
});

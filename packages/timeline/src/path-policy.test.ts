import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePermittedPath } from './path-policy.ts';

test('accepts a path inside an allowed root', () => {
  assert.equal(validatePermittedPath('/media/project/a.mp4', ['/media/project']), '/media/project/a.mp4');
});

test('rejects path traversal and sibling-prefix tricks', () => {
  assert.throws(() => validatePermittedPath('/media/project/../secret.txt', ['/media/project']), /outside permitted/i);
  assert.throws(() => validatePermittedPath('/media/project-evil/a.mp4', ['/media/project']), /outside permitted/i);
});

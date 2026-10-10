import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptWorkerResult, createWorkerEnvelope, validateWorkerJob } from '../src/index.ts';

const job = { id: 'j1', engineVersion: '0.5.0', projectHash: 'sha256:project', cacheKey: 'sha256:cache', output: { format: 'mp4', path: 'out.mp4' } };

test('render worker envelope never grants editor mutation authority', () => {
  const envelope = createWorkerEnvelope(job, { engineVersion: '0.5.0' });
  assert.equal(envelope.editorAuthority, false);
  assert.equal(envelope.job.projectHash, 'sha256:project');
});

test('workers reject engine mismatch and result provenance mismatch', () => {
  assert.throws(() => validateWorkerJob(job, { engineVersion: '0.4.0' }), /version/i);
  assert.throws(() => acceptWorkerResult(job, { jobId: 'j1', engineVersion: '0.5.0', projectHash: 'sha256:other', cacheKey: 'sha256:cache', outputHash: 'sha256:o' }), /project hash/i);
});

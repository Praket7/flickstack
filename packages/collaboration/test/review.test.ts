import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewThread, reviewAnchorStatus, approveReviewThread } from '../src/index.ts';

test('review anchors distinguish fresh, ancestor, stale and missing targets', () => {
  const anchor = { branch: 'main', checkpointId: 'cp-10', revision: 'r10', compositionId: 'hero' };
  assert.equal(reviewAnchorStatus(anchor, { branch: 'main', revision: 'r10', ancestorRevisions: [], existingCheckpointIds: ['cp-10'] }), 'fresh');
  assert.equal(reviewAnchorStatus(anchor, { branch: 'main', revision: 'r12', ancestorRevisions: ['r10'], existingCheckpointIds: ['cp-10'] }), 'ancestor');
  assert.equal(reviewAnchorStatus(anchor, { branch: 'other', revision: 'r12', ancestorRevisions: [], existingCheckpointIds: ['cp-10'] }), 'stale');
  assert.equal(reviewAnchorStatus(anchor, { branch: 'main', revision: 'r12', ancestorRevisions: ['r10'], existingCheckpointIds: [] }), 'missing-anchor');
});

test('approval is immutable evidence tied to exact review anchor', () => {
  const thread = createReviewThread({ id: 't1', anchor: { branch: 'main', checkpointId: 'cp', revision: 'r1' }, author: 'editor', body: 'Ship this cut' });
  const approved = approveReviewThread(thread, { reviewer: 'producer', decision: 'approved', at: '2026-10-10T00:00:00Z' });
  assert.equal(approved.approvals[0]?.anchorRevision, 'r1');
  assert.equal(thread.approvals.length, 0);
});

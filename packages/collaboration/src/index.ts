export interface ReviewAnchor {
  branch: string;
  checkpointId: string;
  revision: string;
  compositionId?: string;
  layerId?: string;
  frame?: number;
}
export interface ReviewMessage { id: string; author: string; body: string; at: string }
export interface ReviewApproval { reviewer: string; decision: 'approved' | 'changes-requested'; at: string; anchorRevision: string; anchorCheckpointId: string }
export interface ReviewThread { id: string; anchor: ReviewAnchor; messages: ReviewMessage[]; approvals: ReviewApproval[]; createdAt: string }
export type ReviewAnchorStatus = 'fresh' | 'ancestor' | 'stale' | 'missing-anchor';

function validAnchor(anchor: ReviewAnchor): void {
  if (!anchor.branch?.trim() || !anchor.checkpointId?.trim() || !anchor.revision?.trim()) throw new Error('Review anchor requires branch, checkpointId, and revision');
  if (anchor.frame !== undefined && (!Number.isInteger(anchor.frame) || anchor.frame < 0)) throw new Error('Review anchor frame is invalid');
}

export function createReviewThread(input: { id: string; anchor: ReviewAnchor; author: string; body: string; at?: string }): ReviewThread {
  validAnchor(input.anchor);
  if (!input.id?.trim() || !input.author?.trim() || !input.body?.trim()) throw new Error('Review id, author, and body are required');
  const at = input.at ?? new Date().toISOString();
  return { id: input.id, anchor: structuredClone(input.anchor), messages: [{ id: `${input.id}:1`, author: input.author, body: input.body, at }], approvals: [], createdAt: at };
}

export function addReviewMessage(thread: ReviewThread, input: { author: string; body: string; at?: string }): ReviewThread {
  if (!input.author?.trim() || !input.body?.trim()) throw new Error('Review author and body are required');
  const next = structuredClone(thread);
  next.messages.push({ id: `${thread.id}:${next.messages.length + 1}`, author: input.author, body: input.body, at: input.at ?? new Date().toISOString() });
  return next;
}

export function approveReviewThread(thread: ReviewThread, input: { reviewer: string; decision: ReviewApproval['decision']; at?: string }): ReviewThread {
  if (!input.reviewer?.trim()) throw new Error('Reviewer is required');
  const next = structuredClone(thread);
  next.approvals.push({ reviewer: input.reviewer, decision: input.decision, at: input.at ?? new Date().toISOString(), anchorRevision: thread.anchor.revision, anchorCheckpointId: thread.anchor.checkpointId });
  return next;
}

export function reviewAnchorStatus(anchor: ReviewAnchor, current: { branch: string; revision: string; ancestorRevisions: string[]; existingCheckpointIds: string[] }): ReviewAnchorStatus {
  validAnchor(anchor);
  if (!current.existingCheckpointIds.includes(anchor.checkpointId)) return 'missing-anchor';
  if (anchor.branch !== current.branch) return 'stale';
  if (anchor.revision === current.revision) return 'fresh';
  if (current.ancestorRevisions.includes(anchor.revision)) return 'ancestor';
  return 'stale';
}

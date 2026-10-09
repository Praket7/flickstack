import { createHash } from 'node:crypto';
import type { Clip, FlickProject, Track } from '../../schema/src/project.ts';
import { assertNoCredentialFields } from '../../schema/src/secrets.ts';

export type EditOperation =
  | { type: 'add_clip'; trackId: string; clip: Clip; intent?: string }
  | { type: 'remove_clip'; trackId: string; clipId: string; intent?: string }
  | { type: 'split_clip'; trackId: string; clipId: string; at: number; rightClipId: string; intent?: string }
  | { type: 'trim_clip'; trackId: string; clipId: string; start: number; duration: number; sourceIn: number; intent?: string }
  | { type: 'move_clip'; trackId: string; clipId: string; start: number; intent?: string }
  | { type: 'ripple_delete'; trackId: string; clipId: string; intent?: string }
  | { type: 'set_speed'; trackId: string; clipId: string; speed: number; intent?: string }
  | { type: 'set_volume'; trackId: string; clipId: string; volume: number; intent?: string }
  | { type: 'add_text'; trackId: string; clip: Clip; intent?: string }
  | { type: 'add_motion_graphic'; trackId: string; clip: Clip; intent?: string };

export interface DiffChange {
  kind: 'clip_added' | 'clip_removed' | 'clip_updated' | 'clip_split' | 'timeline_shifted';
  trackId: string;
  clipId?: string;
  before?: unknown;
  after?: unknown;
}

export interface ProjectDiff { changes: DiffChange[] }
export interface AffectedRange { trackId: string; start: number; end: number }
export interface EditReceipt {
  operation: EditOperation['type'];
  intent?: string;
  affectedRanges: AffectedRange[];
  checkpointId: string;
  semanticLocksRespected?: string[];
}
export interface EditResult {
  project: FlickProject;
  diff: ProjectDiff;
  warnings: string[];
  checkpointId: string;
  receipt: EditReceipt;
}

function cloneProject(project: FlickProject): FlickProject {
  return structuredClone(project);
}

function track(project: FlickProject, id: string): Track {
  const value = project.tracks.find(t => t.id === id);
  if (!value) throw new Error(`Unknown track: ${id}`);
  if (value.locked) throw new Error(`Track is locked: ${id}`);
  return value;
}

function clip(trackValue: Track, id: string): Clip {
  const value = trackValue.clips.find(c => c.id === id);
  if (!value) throw new Error(`Unknown clip: ${id}`);
  if (value.locked) throw new Error(`Locked clip ${id} cannot be edited`);
  return value;
}

function assertIntegerTick(value: number, name: string, positive = false): void {
  if (!Number.isInteger(value) || value < (positive ? 1 : 0)) throw new Error(`${name} must be an integer frame tick`);
}

function validateNoOverlap(t: Track): void {
  if (t.kind === 'audio' || t.kind === 'caption') return;
  const ordered = [...t.clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (prev.start + prev.duration > cur.start) {
      throw new Error(`Clip overlap on track ${t.id}: ${prev.id} overlaps ${cur.id}`);
    }
  }
}

function checkpointFor(project: FlickProject, op: EditOperation): string {
  return 'cp_' + createHash('sha256').update(JSON.stringify([project.id, project.checkpoints.length, op])).digest('hex').slice(0, 12);
}

function rangeFor(trackId: string, c: Clip): AffectedRange {
  return { trackId, start: c.start, end: c.start + c.duration };
}

function semanticLocksFor(project: FlickProject, op: EditOperation): string[] {
  const targetClipId = 'clipId' in op ? op.clipId : 'clip' in op ? op.clip.id : undefined;
  const targetAssetId = 'clip' in op ? op.clip.assetId : targetClipId ? project.tracks.find(t => t.id === op.trackId)?.clips.find(c => c.id === targetClipId)?.assetId : undefined;
  const matching = (project.semanticLocks ?? []).filter(lock =>
    (!lock.trackId || lock.trackId === op.trackId) &&
    (!lock.clipId || lock.clipId === targetClipId) &&
    (!lock.assetId || lock.assetId === targetAssetId));
  for (const lock of matching) {
    const destructive = op.type === 'remove_clip' || op.type === 'ripple_delete';
    const positionChanging = op.type === 'move_clip' || op.type === 'trim_clip' || op.type === 'split_clip' || op.type === 'ripple_delete' || op.type === 'remove_clip';
    const contentChanging = op.type === 'trim_clip' || op.type === 'split_clip' || op.type === 'set_speed' || op.type === 'remove_clip' || op.type === 'ripple_delete';
    if ((lock.rule === 'preserve' && destructive) || (lock.rule === 'position' && positionChanging) || (lock.rule === 'content' && contentChanging)) {
      throw new Error(`Semantic lock "${lock.label}" (${lock.id}) blocks ${op.type}`);
    }
  }
  return matching.map(lock => lock.id);
}

export function applyOperation(input: FlickProject, op: EditOperation): EditResult {
  assertNoCredentialFields(op,'editOperation');
  const respectedLocks = semanticLocksFor(input, op);
  const project = cloneProject(input);
  const t = track(project, op.trackId);
  const diff: ProjectDiff = { changes: [] };
  const affectedRanges: AffectedRange[] = [];

  switch (op.type) {
    case 'add_clip':
    case 'add_text':
    case 'add_motion_graphic': {
      if (t.clips.some(c => c.id === op.clip.id)) throw new Error(`Duplicate clip id: ${op.clip.id}`);
      assertIntegerTick(op.clip.start, 'clip.start');
      assertIntegerTick(op.clip.duration, 'clip.duration', true);
      assertIntegerTick(op.clip.sourceIn, 'clip.sourceIn');
      t.clips.push(structuredClone(op.clip));
      validateNoOverlap(t);
      diff.changes.push({ kind: 'clip_added', trackId: t.id, clipId: op.clip.id, after: op.clip });
      affectedRanges.push(rangeFor(t.id, op.clip));
      break;
    }
    case 'remove_clip': {
      const c = clip(t, op.clipId);
      const idx = t.clips.indexOf(c);
      t.clips.splice(idx, 1);
      diff.changes.push({ kind: 'clip_removed', trackId: t.id, clipId: c.id, before: c });
      affectedRanges.push(rangeFor(t.id, c));
      break;
    }
    case 'split_clip': {
      const c = clip(t, op.clipId);
      assertIntegerTick(op.at, 'split position', true);
      if (op.at <= c.start || op.at >= c.start + c.duration) throw new Error(`Split must fall inside clip ${c.id}`);
      if (t.clips.some(existing => existing.id === op.rightClipId)) throw new Error(`Duplicate clip id: ${op.rightClipId}`);
      const offset = op.at - c.start;
      const before = structuredClone(c);
      const right: Clip = { ...structuredClone(c), id: op.rightClipId, start: op.at, duration: c.duration - offset, sourceIn: c.sourceIn + offset };
      c.duration = offset;
      t.clips.push(right);
      t.clips.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
      diff.changes.push({ kind: 'clip_split', trackId: t.id, clipId: c.id, before, after: [structuredClone(c), right] });
      affectedRanges.push(rangeFor(t.id, before));
      break;
    }
    case 'trim_clip': {
      const c = clip(t, op.clipId);
      assertIntegerTick(op.start, 'trim.start');
      assertIntegerTick(op.duration, 'trim.duration', true);
      assertIntegerTick(op.sourceIn, 'trim.sourceIn');
      const before = structuredClone(c);
      c.start = op.start; c.duration = op.duration; c.sourceIn = op.sourceIn;
      validateNoOverlap(t);
      diff.changes.push({ kind: 'clip_updated', trackId: t.id, clipId: c.id, before, after: structuredClone(c) });
      affectedRanges.push(rangeFor(t.id, c));
      break;
    }
    case 'move_clip': {
      const c = clip(t, op.clipId);
      assertIntegerTick(op.start, 'move.start');
      const before = structuredClone(c);
      c.start = op.start;
      validateNoOverlap(t);
      diff.changes.push({ kind: 'clip_updated', trackId: t.id, clipId: c.id, before, after: structuredClone(c) });
      affectedRanges.push(rangeFor(t.id, c));
      break;
    }
    case 'ripple_delete': {
      const c = clip(t, op.clipId);
      const before = structuredClone(c);
      const end = c.start + c.duration;
      t.clips = t.clips.filter(item => item.id !== c.id).map(item => item.start >= end ? { ...item, start: item.start - c.duration } : item);
      diff.changes.push({ kind: 'clip_removed', trackId: t.id, clipId: c.id, before });
      diff.changes.push({ kind: 'timeline_shifted', trackId: t.id, before: { from: end }, after: { by: -c.duration } });
      affectedRanges.push(rangeFor(t.id, before));
      break;
    }
    case 'set_speed': {
      const c = clip(t, op.clipId);
      if (!Number.isFinite(op.speed) || op.speed <= 0) throw new Error('speed must be > 0');
      const before = structuredClone(c); c.speed = op.speed;
      diff.changes.push({ kind: 'clip_updated', trackId: t.id, clipId: c.id, before, after: structuredClone(c) });
      affectedRanges.push(rangeFor(t.id, c));
      break;
    }
    case 'set_volume': {
      const c = clip(t, op.clipId);
      if (!Number.isFinite(op.volume)) throw new Error('volume must be finite');
      const before = structuredClone(c); c.volume = op.volume;
      diff.changes.push({ kind: 'clip_updated', trackId: t.id, clipId: c.id, before, after: structuredClone(c) });
      affectedRanges.push(rangeFor(t.id, c));
      break;
    }
  }

  const checkpointId = checkpointFor(input, op);
  project.checkpoints.push({
    id: checkpointId,
    createdAt: new Date().toISOString(),
    parentId: input.checkpoints.at(-1)?.id,
    intent: op.intent,
  });

  return {
    project,
    diff,
    warnings: [],
    checkpointId,
    receipt: { operation: op.type, intent: op.intent, affectedRanges, checkpointId, ...(respectedLocks.length ? { semanticLocksRespected: respectedLocks } : {}) },
  };
}

export function applyOperations(project: FlickProject, operations: EditOperation[]): EditResult[] {
  const results: EditResult[] = [];
  let current = project;
  for (const operation of operations) {
    const result = applyOperation(current, operation);
    results.push(result);
    current = result.project;
  }
  return results;
}

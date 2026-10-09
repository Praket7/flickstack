import type { FlickProject } from '../../schema/src/project.ts';
import type { EditReceipt } from './apply.ts';

export interface BranchHistoryEntry { checkpointId: string; project: FlickProject; receipt?: EditReceipt }
export interface BranchState {
  project: FlickProject;
  parent?: string;
  forkProject: FlickProject;
  receipts: EditReceipt[];
  history: BranchHistoryEntry[];
}


export interface VideoGitSnapshot {
  version: 1;
  branches: Array<{name:string;parent?:string;project:FlickProject;forkProject:FlickProject;receipts:EditReceipt[];history?:BranchHistoryEntry[]}>;
}

export interface BranchDiff {
  from: string;
  to: string;
  changedClipIds: string[];
  receipts: EditReceipt[];
}

function clone<T>(value: T): T { return structuredClone(value); }

function clipMap(project: FlickProject): Map<string, string> {
  const result = new Map<string, string>();
  for (const track of project.tracks) {
    for (const clip of track.clips) result.set(`${track.id}/${clip.id}`, JSON.stringify(clip));
  }
  return result;
}

function changedSince(base: FlickProject, current: FlickProject): Set<string> {
  const a = clipMap(base); const b = clipMap(current); const changed = new Set<string>();
  for (const key of new Set([...a.keys(), ...b.keys()])) if (a.get(key) !== b.get(key)) changed.add(key.split('/')[1]);
  return changed;
}

export class VideoGitStore {
  readonly #branches = new Map<string, BranchState>();

  constructor(initial: FlickProject) {
    this.#branches.set('main', { project: clone(initial), forkProject: clone(initial), receipts: [], history: [{checkpointId: initial.checkpoints.at(-1)?.id ?? 'root', project: clone(initial)}] });
  }

  exportState(): VideoGitSnapshot {
    return {
      version: 1,
      branches: [...this.#branches.entries()].map(([name,state]) => ({
        name,
        ...(state.parent ? { parent: state.parent } : {}),
        project: clone(state.project),
        forkProject: clone(state.forkProject),
        receipts: clone(state.receipts),
        history: clone(state.history),
      })),
    };
  }

  static fromState(snapshot: VideoGitSnapshot): VideoGitStore {
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.branches) || snapshot.branches.length === 0) throw new Error('Invalid Video Git snapshot');
    const main = snapshot.branches.find(branch => branch.name === 'main');
    if (!main) throw new Error('Video Git snapshot is missing main branch');
    const store = new VideoGitStore(main.project);
    store.#branches.clear();
    for (const branch of snapshot.branches) {
      if (!branch.name || !branch.project || !branch.forkProject || !Array.isArray(branch.receipts)) throw new Error(`Invalid Video Git branch snapshot: ${branch.name ?? 'unknown'}`);
      const history = Array.isArray(branch.history) && branch.history.length
        ? clone(branch.history)
        : [{ checkpointId: branch.project.checkpoints.at(-1)?.id ?? 'root', project: clone(branch.project) }];
      store.#branches.set(branch.name, {
        project: clone(branch.project),
        forkProject: clone(branch.forkProject),
        receipts: clone(branch.receipts),
        history,
        ...(branch.parent ? { parent: branch.parent } : {}),
      });
    }
    return store;
  }

  get(name: string): FlickProject {
    const branch = this.#branches.get(name);
    if (!branch) throw new Error(`Unknown branch: ${name}`);
    return clone(branch.project);
  }

  createBranch(name: string, from = 'main'): void {
    if (this.#branches.has(name)) throw new Error(`Branch already exists: ${name}`);
    const source = this.#branches.get(from);
    if (!source) throw new Error(`Unknown source branch: ${from}`);
    const snapshot = clone(source.project);
    this.#branches.set(name, { project: snapshot, forkProject: clone(snapshot), parent: from, receipts: [], history: [{checkpointId: snapshot.checkpoints.at(-1)?.id ?? 'root', project: clone(snapshot)}] });
  }

  update(name: string, project: FlickProject, receipt?: EditReceipt): void {
    const branch = this.#branches.get(name);
    if (!branch) throw new Error(`Unknown branch: ${name}`);
    branch.project = clone(project);
    if (receipt) branch.receipts.push(clone(receipt));
    const checkpointId = receipt?.checkpointId ?? project.checkpoints.at(-1)?.id ?? `state_${branch.history.length}`;
    branch.history.push({ checkpointId, project: clone(project), ...(receipt ? { receipt: clone(receipt) } : {}) });
  }

  undo(name: string): FlickProject {
    const branch = this.#branches.get(name);
    if (!branch) throw new Error(`Unknown branch: ${name}`);
    if (branch.history.length <= 1) throw new Error(`No earlier checkpoint to undo on branch ${name}`);
    branch.history.pop();
    const head = branch.history.at(-1)!;
    branch.project = clone(head.project);
    branch.receipts = branch.history.flatMap(entry => entry.receipt ? [clone(entry.receipt)] : []);
    return clone(branch.project);
  }

  restoreCheckpoint(name: string, checkpointId: string): FlickProject {
    const branch = this.#branches.get(name);
    if (!branch) throw new Error(`Unknown branch: ${name}`);
    const index = branch.history.findIndex(entry => entry.checkpointId === checkpointId);
    if (index < 0) throw new Error(`Unknown checkpoint ${checkpointId} on branch ${name}`);
    branch.history = branch.history.slice(0, index + 1);
    branch.project = clone(branch.history[index].project);
    branch.receipts = branch.history.flatMap(entry => entry.receipt ? [clone(entry.receipt)] : []);
    return clone(branch.project);
  }

  diffBranches(from: string, to: string): BranchDiff {
    const a = this.#branches.get(from); const b = this.#branches.get(to);
    if (!a || !b) throw new Error(`Unknown branch in diff: ${from} -> ${to}`);
    return { from, to, changedClipIds: [...changedSince(a.project, b.project)].sort(), receipts: clone(b.receipts) };
  }

  mergeBranch(targetName: string, sourceName: string): FlickProject {
    const target = this.#branches.get(targetName); const source = this.#branches.get(sourceName);
    if (!target || !source) throw new Error(`Unknown branch in merge: ${targetName} <- ${sourceName}`);

    const targetChanged = changedSince(target.forkProject, target.project);
    const sourceChanged = changedSince(source.forkProject, source.project);
    const conflicts = [...targetChanged].filter(id => sourceChanged.has(id));
    if (conflicts.length) throw new Error(`Merge conflict on clips: ${conflicts.join(', ')}`);

    const merged = clone(target.project);
    const sourceMap = new Map(source.project.tracks.map(t => [t.id, t]));
    for (const track of merged.tracks) {
      const sourceTrack = sourceMap.get(track.id);
      if (!sourceTrack) continue;
      for (const id of sourceChanged) {
        const sourceClip = sourceTrack.clips.find(c => c.id === id);
        const index = track.clips.findIndex(c => c.id === id);
        if (sourceClip) {
          if (index >= 0) track.clips[index] = clone(sourceClip); else track.clips.push(clone(sourceClip));
        } else if (index >= 0) track.clips.splice(index, 1);
      }
    }
    target.project = clone(merged);
    target.receipts.push(...clone(source.receipts));
    target.history.push({checkpointId:`merge_${targetName}_${sourceName}_${target.history.length}`,project:clone(merged)});
    return clone(merged);
  }
}

import { assertNoCredentialFields } from './secrets.ts';
export type Rational = Readonly<{ numerator: number; denominator: number }>;
export type FrameTick = number;
export type TrackKind = 'video' | 'audio' | 'motion' | 'caption';

export interface ProjectFormat {
  width: number;
  height: number;
  fps: Rational;
  audioSampleRate: number;
}

export interface Asset {
  id: string;
  path: string;
  kind: 'video' | 'audio' | 'image';
  duration?: FrameTick;
  proxyPath?: string;
  metadata?: Record<string, unknown>;
}

export interface Clip {
  id: string;
  assetId?: string;
  start: FrameTick;
  duration: FrameTick;
  sourceIn: FrameTick;
  speed?: number;
  volume?: number;
  text?: string;
  component?: string;
  props?: Record<string, unknown>;
  locked?: boolean;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Clip[];
  locked?: boolean;
  muted?: boolean;
}

export interface Marker {
  id: string;
  at: FrameTick;
  label: string;
  color?: string;
}

export interface ProvenanceRecord {
  assetId?: string;
  provider?: string;
  creator?: string;
  sourceUrl?: string;
  license?: string;
  commercialAllowed?: boolean | null;
  attributionRequired?: boolean;
  retrievedAt?: string;
}

export interface Checkpoint {
  id: string;
  createdAt: string;
  label?: string;
  parentId?: string;
  branch?: string;
  intent?: string;
}

export interface BranchRef {
  name: string;
  checkpointId: string;
  parent?: string;
}

export interface SemanticLock {
  id: string;
  label: string;
  rule: 'preserve' | 'position' | 'content';
  trackId?: string;
  clipId?: string;
  assetId?: string;
  start?: FrameTick;
  end?: FrameTick;
}

export interface FlickProject {
  version: 1;
  id: string;
  name: string;
  format: ProjectFormat;
  assets: Asset[];
  tracks: Track[];
  markers: Marker[];
  style: Record<string, unknown>;
  provenance: ProvenanceRecord[];
  checkpoints: Checkpoint[];
  branches: BranchRef[];
  semanticLocks?: SemanticLock[];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, path: string, min = 0): number {
  invariant(typeof value === 'number' && Number.isInteger(value), `${path} must be an integer frame tick`);
  invariant(value >= min, `${path} must be >= ${min}`);
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  return integer(value, path, 1);
}

function stringValue(value: unknown, path: string): string {
  invariant(typeof value === 'string' && value.length > 0, `${path} must be a non-empty string`);
  return value;
}

export function rational(numerator: number, denominator: number): Rational {
  invariant(Number.isInteger(numerator) && numerator > 0, 'rational numerator must be a positive integer');
  invariant(Number.isInteger(denominator) && denominator > 0, 'rational denominator must be a positive integer');
  return Object.freeze({ numerator, denominator });
}

export function frameTick(value: number): FrameTick {
  return integer(value, 'frame value');
}

function parseFormat(value: unknown): ProjectFormat {
  invariant(isRecord(value), 'format must be an object');
  invariant(isRecord(value.fps), 'format.fps must be an object');
  return {
    width: positiveInteger(value.width, 'format.width'),
    height: positiveInteger(value.height, 'format.height'),
    fps: rational(
      positiveInteger(value.fps.numerator, 'format.fps.numerator'),
      positiveInteger(value.fps.denominator, 'format.fps.denominator'),
    ),
    audioSampleRate: positiveInteger(value.audioSampleRate, 'format.audioSampleRate'),
  };
}

function parseAsset(value: unknown, index: number): Asset {
  invariant(isRecord(value), `assets[${index}] must be an object`);
  const kind = value.kind;
  invariant(kind === 'video' || kind === 'audio' || kind === 'image', `assets[${index}].kind is invalid`);
  const asset: Asset = {
    id: stringValue(value.id, `assets[${index}].id`),
    path: stringValue(value.path, `assets[${index}].path`),
    kind,
  };
  if (value.duration !== undefined) asset.duration = integer(value.duration, `assets[${index}].duration`);
  if (value.proxyPath !== undefined) asset.proxyPath = stringValue(value.proxyPath, `assets[${index}].proxyPath`);
  if (value.metadata !== undefined) {
    invariant(isRecord(value.metadata), `assets[${index}].metadata must be an object`);
    asset.metadata = value.metadata;
  }
  return asset;
}

function parseClip(value: unknown, trackIndex: number, clipIndex: number): Clip {
  invariant(isRecord(value), `tracks[${trackIndex}].clips[${clipIndex}] must be an object`);
  const prefix = `tracks[${trackIndex}].clips[${clipIndex}]`;
  const clip: Clip = {
    id: stringValue(value.id, `${prefix}.id`),
    start: integer(value.start, `${prefix}.start`),
    duration: positiveInteger(value.duration, `${prefix}.duration`),
    sourceIn: integer(value.sourceIn, `${prefix}.sourceIn`),
  };
  if (value.assetId !== undefined) clip.assetId = stringValue(value.assetId, `${prefix}.assetId`);
  if (value.speed !== undefined) {
    invariant(typeof value.speed === 'number' && Number.isFinite(value.speed) && value.speed > 0, `${prefix}.speed must be > 0`);
    clip.speed = value.speed;
  }
  if (value.volume !== undefined) {
    invariant(typeof value.volume === 'number' && Number.isFinite(value.volume), `${prefix}.volume must be finite`);
    clip.volume = value.volume;
  }
  if (value.text !== undefined) clip.text = stringValue(value.text, `${prefix}.text`);
  if (value.component !== undefined) clip.component = stringValue(value.component, `${prefix}.component`);
  if (value.props !== undefined) {
    invariant(isRecord(value.props), `${prefix}.props must be an object`);
    clip.props = value.props;
  }
  if (value.locked !== undefined) {
    invariant(typeof value.locked === 'boolean', `${prefix}.locked must be boolean`);
    clip.locked = value.locked;
  }
  return clip;
}

function parseTrack(value: unknown, index: number): Track {
  invariant(isRecord(value), `tracks[${index}] must be an object`);
  const kind = value.kind;
  invariant(kind === 'video' || kind === 'audio' || kind === 'motion' || kind === 'caption', `tracks[${index}].kind is invalid`);
  invariant(Array.isArray(value.clips), `tracks[${index}].clips must be an array`);
  return {
    id: stringValue(value.id, `tracks[${index}].id`),
    kind,
    name: stringValue(value.name, `tracks[${index}].name`),
    clips: value.clips.map((clip, clipIndex) => parseClip(clip, index, clipIndex)),
    ...(value.locked === undefined ? {} : { locked: Boolean(value.locked) }),
    ...(value.muted === undefined ? {} : { muted: Boolean(value.muted) }),
  };
}

function ensureUniqueIds<T extends {id: string}>(values: T[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    invariant(!seen.has(value.id), `${label} contains duplicate id ${value.id}`);
    seen.add(value.id);
  }
}

export function parseProject(input: unknown): FlickProject {
  invariant(isRecord(input), 'project must be an object');
  invariant(input.version === 1, 'project.version must be 1');
  invariant(Array.isArray(input.assets), 'assets must be an array');
  invariant(Array.isArray(input.tracks), 'tracks must be an array');
  invariant(Array.isArray(input.markers), 'markers must be an array');
  invariant(isRecord(input.style), 'style must be an object');
  invariant(Array.isArray(input.provenance), 'provenance must be an array');
  invariant(Array.isArray(input.checkpoints), 'checkpoints must be an array');
  invariant(Array.isArray(input.branches), 'branches must be an array');

  const assets = input.assets.map(parseAsset);
  const tracks = input.tracks.map(parseTrack);
  ensureUniqueIds(assets, 'assets');
  ensureUniqueIds(tracks, 'tracks');
  for (const track of tracks) ensureUniqueIds(track.clips, `track ${track.id} clips`);

  const markers: Marker[] = input.markers.map((value, index) => {
    invariant(isRecord(value), `markers[${index}] must be an object`);
    return {
      id: stringValue(value.id, `markers[${index}].id`),
      at: integer(value.at, `markers[${index}].at`),
      label: stringValue(value.label, `markers[${index}].label`),
      ...(value.color === undefined ? {} : { color: stringValue(value.color, `markers[${index}].color`) }),
    };
  });

  const provenance = input.provenance.map((value, index) => {
    invariant(isRecord(value), `provenance[${index}] must be an object`);
    return { ...value } as ProvenanceRecord;
  });
  const checkpoints = input.checkpoints.map((value, index) => {
    invariant(isRecord(value), `checkpoints[${index}] must be an object`);
    return {
      id: stringValue(value.id, `checkpoints[${index}].id`),
      createdAt: stringValue(value.createdAt, `checkpoints[${index}].createdAt`),
      ...(value.label === undefined ? {} : { label: String(value.label) }),
      ...(value.parentId === undefined ? {} : { parentId: String(value.parentId) }),
      ...(value.branch === undefined ? {} : { branch: String(value.branch) }),
      ...(value.intent === undefined ? {} : { intent: String(value.intent) }),
    };
  });
  const branches = input.branches.map((value, index) => {
    invariant(isRecord(value), `branches[${index}] must be an object`);
    return {
      name: stringValue(value.name, `branches[${index}].name`),
      checkpointId: stringValue(value.checkpointId, `branches[${index}].checkpointId`),
      ...(value.parent === undefined ? {} : { parent: String(value.parent) }),
    };
  });

  const semanticLocks: SemanticLock[] = input.semanticLocks === undefined ? [] : (() => {
    invariant(Array.isArray(input.semanticLocks), 'semanticLocks must be an array');
    return input.semanticLocks.map((value, index) => {
      invariant(isRecord(value), `semanticLocks[${index}] must be an object`);
      const rule = value.rule;
      invariant(rule === 'preserve' || rule === 'position' || rule === 'content', `semanticLocks[${index}].rule is invalid`);
      return {
        id: stringValue(value.id, `semanticLocks[${index}].id`),
        label: stringValue(value.label, `semanticLocks[${index}].label`),
        rule,
        ...(value.trackId === undefined ? {} : { trackId: stringValue(value.trackId, `semanticLocks[${index}].trackId`) }),
        ...(value.clipId === undefined ? {} : { clipId: stringValue(value.clipId, `semanticLocks[${index}].clipId`) }),
        ...(value.assetId === undefined ? {} : { assetId: stringValue(value.assetId, `semanticLocks[${index}].assetId`) }),
        ...(value.start === undefined ? {} : { start: integer(value.start, `semanticLocks[${index}].start`) }),
        ...(value.end === undefined ? {} : { end: integer(value.end, `semanticLocks[${index}].end`) }),
      };
    });
  })();

  return {
    version: 1,
    id: stringValue(input.id, 'id'),
    name: stringValue(input.name, 'name'),
    format: parseFormat(input.format),
    assets,
    tracks,
    markers,
    style: { ...input.style },
    provenance,
    checkpoints,
    branches,
    ...(semanticLocks.length ? { semanticLocks } : {}),
  };
}

export function serializeProject(project: FlickProject): string {
  assertNoCredentialFields(project);
  const parsed = parseProject(project);
  return JSON.stringify(parsed, null, 2) + '\n';
}

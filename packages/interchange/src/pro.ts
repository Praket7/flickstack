type ProjectLike = Record<string, any>;

const clone = <T>(value: T): T => structuredClone(value);
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const basename = (uri: string) => uri.replace(/\\/g, '/').split('/').pop() ?? uri;

export function exportOtioV3(project: ProjectLike): Record<string, unknown> {
  if (!project || typeof project !== 'object') throw new Error('Project is required');
  const assets = Array.isArray(project.assets) ? project.assets : [];
  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: String(project.name ?? 'FlickSmith Project'),
    metadata: {
      flicksmith: {
        version: Number(project.version ?? project.projectVersion ?? 3),
        projectId: String(project.id ?? ''),
        snapshot: clone(project),
      },
    },
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      children: [],
    },
    media_references: assets.map((asset: any) => ({
      asset_id: String(asset.id ?? ''),
      target_url: String(asset.uri ?? asset.path ?? ''),
      content_hash: asset.contentHash ?? asset.hash ?? null,
    })),
  };
}

export function importOtioV3(input: unknown): ProjectLike {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('OTIO document must be an object');
  const doc = input as any;
  if (doc.OTIO_SCHEMA !== 'Timeline.1') throw new Error('Unsupported OTIO schema');
  const snapshot = doc.metadata?.flicksmith?.snapshot;
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) return clone(snapshot);
  const refs = Array.isArray(doc.media_references) ? doc.media_references : [];
  return {
    projectVersion: 3,
    id: String(doc.metadata?.flicksmith?.projectId ?? 'otio-import'),
    name: String(doc.name ?? 'OTIO Import'),
    revision: 0,
    assets: refs.map((ref: any, index: number) => ({
      id: String(ref.asset_id ?? `asset-${index + 1}`),
      kind: 'video',
      uri: String(ref.target_url ?? ''),
      ...(ref.content_hash ? { contentHash: String(ref.content_hash) } : {}),
    })),
    compositions: [],
  };
}

export function exportFcpXml(project: ProjectLike): string {
  const assets = Array.isArray(project.assets) ? project.assets : [];
  const assetXml = assets.map((asset: any, index: number) => {
    const src = String(asset.uri ?? asset.path ?? '');
    return `      <asset id="r${index + 1}" name="${esc(asset.id ?? basename(src))}" src="${esc(src)}"/>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<fcpxml version="1.11">\n  <resources>\n${assetXml}\n  </resources>\n  <library>\n    <event name="${esc(project.name ?? 'FlickSmith')}">\n      <project name="${esc(project.name ?? 'FlickSmith')}"><sequence/></project>\n    </event>\n  </library>\n</fcpxml>`;
}

function tc(frames: number, fps: number): string {
  const f = Math.max(0, Math.floor(frames));
  const ff = f % fps;
  const totalSeconds = Math.floor(f / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return [hh, mm, ss, ff].map((v) => String(v).padStart(2, '0')).join(':');
}

export function exportEdl(project: ProjectLike): string {
  const fps = Number(project.frameRate ?? project.format?.fps?.numerator ?? 30) || 30;
  const lines = [`TITLE: ${String(project.name ?? 'FlickSmith')}`, 'FCM: NON-DROP FRAME', ''];
  const assets = Array.isArray(project.assets) ? project.assets : [];
  let cursor = 0;
  assets.forEach((asset: any, index: number) => {
    const duration = Number(asset.durationFrames ?? asset.duration ?? fps);
    const reel = String(asset.id ?? `A${index + 1}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || `A${index + 1}`;
    lines.push(`${String(index + 1).padStart(3, '0')}  ${reel.padEnd(8)} V     C        ${tc(0, fps)} ${tc(duration, fps)} ${tc(cursor, fps)} ${tc(cursor + duration, fps)}`);
    lines.push(`* FROM CLIP NAME: ${basename(String(asset.uri ?? asset.path ?? asset.id ?? ''))}`);
    cursor += duration;
  });
  return lines.join('\n');
}

export interface RelinkCandidate { uri: string; contentHash?: string; sizeBytes?: number }
export interface RelinkResult {
  resolved: Array<{ assetId: string; uri: string; reason: 'content-hash' | 'basename' }>;
  unresolved: Array<{ assetId: string; originalUri: string }>;
  ambiguous: Array<{ assetId: string; candidates: string[] }>;
}

export function conformRelink(project: ProjectLike, candidates: RelinkCandidate[]): RelinkResult {
  const resolved: RelinkResult['resolved'] = [];
  const unresolved: RelinkResult['unresolved'] = [];
  const ambiguous: RelinkResult['ambiguous'] = [];
  for (const asset of Array.isArray(project.assets) ? project.assets : []) {
    const assetId = String(asset.id ?? '');
    const originalUri = String(asset.uri ?? asset.path ?? '');
    const hash = asset.contentHash ?? asset.hash;
    const hashMatches = hash ? candidates.filter((candidate) => candidate.contentHash === hash) : [];
    if (hashMatches.length === 1) {
      resolved.push({ assetId, uri: hashMatches[0]!.uri, reason: 'content-hash' });
      continue;
    }
    if (hashMatches.length > 1) {
      ambiguous.push({ assetId, candidates: hashMatches.map((candidate) => candidate.uri) });
      continue;
    }
    const nameMatches = candidates.filter((candidate) => basename(candidate.uri).toLowerCase() === basename(originalUri).toLowerCase());
    if (nameMatches.length === 1) resolved.push({ assetId, uri: nameMatches[0]!.uri, reason: 'basename' });
    else if (nameMatches.length > 1) ambiguous.push({ assetId, candidates: nameMatches.map((candidate) => candidate.uri) });
    else unresolved.push({ assetId, originalUri });
  }
  return { resolved, unresolved, ambiguous };
}

type ProjectLike = Record<string, any>;

const clone = <T>(value: T): T => structuredClone(value);
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const basename = (uri: string) => uri.replace(/\\/g, '/').split('/').pop() ?? uri;

function frameRate(project: ProjectLike): number {
  const formatRate = Number(project.format?.fps?.numerator) / Number(project.format?.fps?.denominator || 1);
  const legacyRate = Number(project.frameRate);
  const value = Number.isFinite(formatRate) && formatRate > 0 ? formatRate : legacyRate;
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function rootComposition(project: ProjectLike): any | undefined {
  const compositions = Array.isArray(project.timeline?.compositions) ? project.timeline.compositions : [];
  return compositions.find((composition: any) => composition.id === project.timeline?.rootCompositionId) ?? compositions[0];
}

function timelineTracks(project: ProjectLike): any[] {
  const composition = rootComposition(project);
  return Array.isArray(composition?.tracks) ? composition.tracks : [];
}

function clipDuration(clip: any): number {
  return Math.max(0, Number(clip?.duration ?? 0));
}

function rationalTime(value: number, rate: number) {
  return { OTIO_SCHEMA: 'RationalTime.1', value, rate };
}

function timeRange(start: number, duration: number, rate: number) {
  return {
    OTIO_SCHEMA: 'TimeRange.1',
    start_time: rationalTime(start, rate),
    duration: rationalTime(duration, rate),
  };
}

function assetMap(project: ProjectLike): Map<string, any> {
  return new Map((Array.isArray(project.assets) ? project.assets : []).map((asset: any) => [String(asset.id ?? ''), asset]));
}

function mediaReference(asset: any) {
  const uri = String(asset?.uri ?? asset?.path ?? '');
  return {
    OTIO_SCHEMA: 'ExternalReference.1',
    target_url: uri,
    metadata: {
      flicksmith: {
        assetId: String(asset?.id ?? ''),
        contentHash: asset?.contentHash ?? asset?.hash ?? null,
      },
    },
  };
}

export function exportOtioV3(project: ProjectLike): Record<string, unknown> {
  if (!project || typeof project !== 'object') throw new Error('Project is required');
  const rate = frameRate(project);
  const assets = assetMap(project);
  const tracks = timelineTracks(project).map((track: any) => {
    const clips = Array.isArray(track.clips) ? [...track.clips].sort((a, b) => Number(a.start ?? 0) - Number(b.start ?? 0)) : [];
    let cursor = 0;
    const children: any[] = [];
    for (const clip of clips) {
      const start = Math.max(0, Number(clip.start ?? 0));
      const duration = clipDuration(clip);
      if (start > cursor) {
        children.push({ OTIO_SCHEMA: 'Gap.1', source_range: timeRange(0, start - cursor, rate) });
      }
      const asset = assets.get(String(clip.assetId ?? ''));
      children.push({
        OTIO_SCHEMA: 'Clip.2',
        name: String(clip.name ?? asset?.id ?? clip.id ?? 'Clip'),
        source_range: timeRange(Number(clip.in ?? 0), duration, rate),
        media_reference: mediaReference(asset),
        metadata: {
          flicksmith: {
            clipId: String(clip.id ?? ''),
            assetId: String(clip.assetId ?? ''),
            timelineStart: start,
            trackId: String(track.id ?? ''),
            enabled: clip.enabled !== false,
          },
        },
      });
      cursor = Math.max(cursor, start + duration);
    }
    return {
      OTIO_SCHEMA: 'Track.1',
      name: String(track.name ?? track.id ?? 'Track'),
      kind: track.kind === 'audio' ? 'Audio' : 'Video',
      children,
      metadata: { flicksmith: { trackId: String(track.id ?? ''), locked: Boolean(track.locked), muted: Boolean(track.muted) } },
    };
  });

  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: String(project.name ?? 'FlickSmith Project'),
    global_start_time: rationalTime(0, rate),
    metadata: {
      flicksmith: {
        version: Number(project.version ?? project.projectVersion ?? 3),
        projectId: String(project.id ?? ''),
        rootCompositionId: String(project.timeline?.rootCompositionId ?? ''),
        snapshot: clone(project),
      },
    },
    tracks: { OTIO_SCHEMA: 'Stack.1', children: tracks },
  };
}

function otioTimeValue(value: any): number {
  return Math.max(0, Number(value?.value ?? 0));
}

export function importOtioV3(input: unknown): ProjectLike {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('OTIO document must be an object');
  const doc = input as any;
  if (doc.OTIO_SCHEMA !== 'Timeline.1') throw new Error('Unsupported OTIO schema');
  const snapshot = doc.metadata?.flicksmith?.snapshot;
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) return clone(snapshot);

  const rate = Number(doc.global_start_time?.rate ?? 30) || 30;
  const assets: any[] = [];
  const assetIds = new Set<string>();
  const tracks = (Array.isArray(doc.tracks?.children) ? doc.tracks.children : []).map((track: any, trackIndex: number) => {
    let cursor = 0;
    const clips: any[] = [];
    for (const item of Array.isArray(track.children) ? track.children : []) {
      const duration = otioTimeValue(item.source_range?.duration);
      if (String(item.OTIO_SCHEMA ?? '').startsWith('Gap.')) {
        cursor += duration;
        continue;
      }
      if (!String(item.OTIO_SCHEMA ?? '').startsWith('Clip.')) continue;
      const metadata = item.metadata?.flicksmith ?? {};
      const ref = item.media_reference ?? {};
      const uri = String(ref.target_url ?? '');
      const assetId = String(metadata.assetId ?? ref.metadata?.flicksmith?.assetId ?? `asset-${assets.length + 1}`);
      if (!assetIds.has(assetId)) {
        assetIds.add(assetId);
        assets.push({
          id: assetId,
          kind: track.kind === 'Audio' ? 'audio' : 'video',
          uri,
          ...(ref.metadata?.flicksmith?.contentHash ? { contentHash: String(ref.metadata.flicksmith.contentHash) } : {}),
        });
      }
      clips.push({
        id: String(metadata.clipId ?? `clip-${trackIndex + 1}-${clips.length + 1}`),
        assetId,
        start: Number.isFinite(Number(metadata.timelineStart)) ? Number(metadata.timelineStart) : cursor,
        in: otioTimeValue(item.source_range?.start_time),
        duration,
        enabled: metadata.enabled !== false,
      });
      cursor = Math.max(cursor, clips[clips.length - 1]!.start + duration);
    }
    return {
      id: String(track.metadata?.flicksmith?.trackId ?? `track-${trackIndex + 1}`),
      kind: track.kind === 'Audio' ? 'audio' : 'video',
      name: String(track.name ?? `Track ${trackIndex + 1}`),
      locked: Boolean(track.metadata?.flicksmith?.locked),
      muted: Boolean(track.metadata?.flicksmith?.muted),
      clips,
    };
  });
  const rootId = String(doc.metadata?.flicksmith?.rootCompositionId ?? 'otio-root');
  const duration = tracks.flatMap((track: any) => track.clips).reduce((max: number, clip: any) => Math.max(max, clip.start + clip.duration), 0);

  return {
    projectVersion: 3,
    id: String(doc.metadata?.flicksmith?.projectId ?? 'otio-import'),
    name: String(doc.name ?? 'OTIO Import'),
    revision: 0,
    assets,
    format: { width: 1920, height: 1080, fps: { numerator: rate, denominator: 1 }, pixelAspectRatio: 1 },
    timeline: {
      rootCompositionId: rootId,
      compositions: [{ id: rootId, name: String(doc.name ?? 'OTIO Import'), duration, tracks }],
    },
  };
}

function seconds(frames: number, fps: number): string {
  const value = Math.max(0, frames) / fps;
  return `${Number(value.toFixed(6))}s`;
}

export function exportFcpXml(project: ProjectLike): string {
  const rate = frameRate(project);
  const assets = Array.isArray(project.assets) ? project.assets : [];
  const refs = new Map<string, string>();
  const assetXml = assets.map((asset: any, index: number) => {
    const id = `r${index + 2}`;
    refs.set(String(asset.id ?? ''), id);
    const src = String(asset.uri ?? asset.path ?? '');
    return `      <asset id="${id}" name="${esc(asset.id ?? basename(src))}" src="${esc(src)}"/>`;
  }).join('\n');
  const composition = rootComposition(project);
  const duration = Math.max(0, Number(composition?.duration ?? 0));
  const clips = timelineTracks(project).flatMap((track: any, trackIndex: number) =>
    (Array.isArray(track.clips) ? track.clips : []).map((clip: any) => ({ clip, track, trackIndex })),
  ).sort((a, b) => Number(a.clip.start ?? 0) - Number(b.clip.start ?? 0) || a.trackIndex - b.trackIndex);
  const spine = clips.map(({ clip, track, trackIndex }) => {
    const ref = refs.get(String(clip.assetId ?? ''));
    if (!ref) return '';
    const lane = track.kind === 'audio' ? -(trackIndex + 1) : trackIndex === 0 ? 0 : trackIndex;
    return `          <asset-clip name="${esc(clip.name ?? clip.id ?? 'Clip')}" ref="${ref}" offset="${seconds(Number(clip.start ?? 0), rate)}" start="${seconds(Number(clip.in ?? 0), rate)}" duration="${seconds(clipDuration(clip), rate)}"${lane ? ` lane="${lane}"` : ''}/>`;
  }).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<fcpxml version="1.11">\n  <resources>\n      <format id="r1" name="FFVideoFormat${Math.round(rate)}p" frameDuration="${seconds(1, rate)}" width="${Number(project.format?.width ?? 1920)}" height="${Number(project.format?.height ?? 1080)}"/>\n${assetXml}\n  </resources>\n  <library>\n    <event name="${esc(project.name ?? 'FlickSmith')}">\n      <project name="${esc(project.name ?? 'FlickSmith')}">\n        <sequence format="r1" duration="${seconds(duration, rate)}">\n          <spine>\n${spine}\n          </spine>\n        </sequence>\n      </project>\n    </event>\n  </library>\n</fcpxml>`;
}

function tc(frames: number, fps: number): string {
  const roundedFps = Math.max(1, Math.round(fps));
  const f = Math.max(0, Math.floor(frames));
  const ff = f % roundedFps;
  const totalSeconds = Math.floor(f / roundedFps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return [hh, mm, ss, ff].map((v) => String(v).padStart(2, '0')).join(':');
}

export function exportEdl(project: ProjectLike): string {
  const fps = frameRate(project);
  const lines = [`TITLE: ${String(project.name ?? 'FlickSmith')}`, 'FCM: NON-DROP FRAME', ''];
  const assets = assetMap(project);
  const clips = timelineTracks(project)
    .filter((track: any) => track.kind !== 'audio')
    .flatMap((track: any) => Array.isArray(track.clips) ? track.clips : [])
    .sort((a: any, b: any) => Number(a.start ?? 0) - Number(b.start ?? 0));
  clips.forEach((clip: any, index: number) => {
    const asset = assets.get(String(clip.assetId ?? ''));
    const duration = clipDuration(clip);
    const sourceIn = Number(clip.in ?? 0);
    const recordIn = Number(clip.start ?? 0);
    const reel = String(clip.assetId ?? `A${index + 1}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || `A${index + 1}`;
    lines.push(`${String(index + 1).padStart(3, '0')}  ${reel.padEnd(8)} V     C        ${tc(sourceIn, fps)} ${tc(sourceIn + duration, fps)} ${tc(recordIn, fps)} ${tc(recordIn + duration, fps)}`);
    lines.push(`* FROM CLIP NAME: ${basename(String(asset?.uri ?? asset?.path ?? clip.assetId ?? ''))}`);
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

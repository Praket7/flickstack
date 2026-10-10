import { createHash } from 'node:crypto';

export interface RenderCacheKeyInput {
  renderProgram: unknown;
  assetHashes: string[];
  rendererVersion: string;
  backend: string;
  plugins: Array<{ id: string; version: string }>;
  colorConfig: unknown;
  fonts: Array<{ family: string; hash: string }>;
  quality: string;
  outputFormat: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = canonical((value as Record<string, unknown>)[key]);
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Render cache input contains non-finite number');
  return value;
}

export function renderCacheKey(input: RenderCacheKeyInput): string {
  const normalized = {
    ...input,
    assetHashes: [...input.assetHashes],
    plugins: [...input.plugins].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)),
    fonts: [...input.fonts].sort((a, b) => `${a.family}@${a.hash}`.localeCompare(`${b.family}@${b.hash}`)),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(normalized))).digest('hex')}`;
}

export interface RenderCacheEntry { key: string; artifactHash: string; createdAt: string; sizeBytes: number }
export class RenderCacheIndex {
  #entries = new Map<string, RenderCacheEntry>();
  put(entry: RenderCacheEntry): void {
    if (!entry.key.startsWith('sha256:') || !entry.artifactHash.startsWith('sha256:')) throw new Error('Render cache entries require content hashes');
    this.#entries.set(entry.key, structuredClone(entry));
  }
  get(key: string): RenderCacheEntry | undefined {
    const entry = this.#entries.get(key);
    return entry ? structuredClone(entry) : undefined;
  }
  invalidate(keys: string[]): number {
    let removed = 0;
    for (const key of keys) if (this.#entries.delete(key)) removed += 1;
    return removed;
  }
}

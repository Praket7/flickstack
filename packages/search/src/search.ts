import { DatabaseSync } from 'node:sqlite';

export interface SearchDocument {
  assetId: string;
  start: number;
  end: number;
  transcript: string;
  visual: string;
  tags: string[];
}
export interface SearchResult extends SearchDocument { score: number; evidence: string[] }
export interface SearchOptions { limit?: number; modality?: 'speech' | 'visual' | 'all' }

const SYNONYMS: Record<string, string[]> = {
  closeup: ['close', 'macro', 'detail'],
  close: ['closeup', 'macro', 'detail'],
  strongest: ['best', 'hook', 'hero'],
  product: ['device', 'object'],
  screen: ['dashboard', 'software', 'ui'],
  person: ['human', 'speaker', 'founder'],
};

function tokens(value: string): string[] {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(base);
  for (const token of base) for (const synonym of SYNONYMS[token] ?? []) expanded.add(synonym);
  return [...expanded];
}

function overlap(query: Set<string>, text: string): number {
  const t = new Set(tokens(text));
  let count = 0;
  for (const q of query) if (t.has(q)) count++;
  return count;
}

export class MediaSearchIndex {
  #db: DatabaseSync;
  constructor(path = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL,
      start_tick INTEGER NOT NULL,
      end_tick INTEGER NOT NULL,
      transcript TEXT NOT NULL,
      visual TEXT NOT NULL,
      tags_json TEXT NOT NULL
    )`);
  }
  add(document: SearchDocument): void {
    if (!Number.isInteger(document.start) || !Number.isInteger(document.end) || document.end <= document.start) throw new Error('Search evidence requires valid integer frame range');
    this.#db.prepare('INSERT INTO evidence(asset_id,start_tick,end_tick,transcript,visual,tags_json) VALUES(?,?,?,?,?,?)')
      .run(document.assetId, document.start, document.end, document.transcript, document.visual, JSON.stringify(document.tags));
  }
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const queryTokens = new Set(tokens(query));
    const rows = this.#db.prepare('SELECT asset_id,start_tick,end_tick,transcript,visual,tags_json FROM evidence').all() as any[];
    const modality = options.modality ?? 'all';
    return rows.map(row => {
      const tags: string[] = JSON.parse(row.tags_json);
      const speech = overlap(queryTokens, row.transcript);
      const visual = overlap(queryTokens, row.visual);
      const tag = overlap(queryTokens, tags.join(' '));
      const score = modality === 'speech' ? speech * 4 + tag : modality === 'visual' ? visual * 4 + tag * 2 : speech * 2.5 + visual * 3 + tag * 2;
      const evidence: string[] = [];
      if (speech) evidence.push('transcript');
      if (visual) evidence.push('visual');
      if (tag) evidence.push('tags');
      return { assetId: row.asset_id, start: row.start_tick, end: row.end_tick, transcript: row.transcript, visual: row.visual, tags, score, evidence };
    }).filter(r => r.score > 0).sort((a,b) => b.score - a.score || a.assetId.localeCompare(b.assetId)).slice(0, options.limit ?? 8);
  }
  close(): void { this.#db.close(); }
}

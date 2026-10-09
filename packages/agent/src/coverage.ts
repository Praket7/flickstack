import type { MediaSearchIndex, SearchResult } from '../../search/src/search.ts';

export interface BriefBeat { id: string; query: string; role: 'hook'|'context'|'proof'|'demo'|'emotion'|'cta'|string; required?: boolean }
export interface Brief { id: string; title: string; beats: BriefBeat[] }
export interface CoverageChoice { assetId: string; start: number; end: number; confidence: number; evidence: string[] }
export interface CoverageBeat { beatId: string; role: string; query: string; primary?: CoverageChoice; alternatives: CoverageChoice[] }
export interface CoveragePlan { briefId: string; beats: CoverageBeat[]; uncoveredBeatIds: string[]; coverageDebt: number; coverageRatio: number }

function choice(result: SearchResult): CoverageChoice {
  return {
    assetId: result.assetId,
    start: result.start,
    end: result.end,
    confidence: Math.min(1, result.score / 10),
    evidence: result.evidence,
  };
}

export function planCoverage(brief: Brief, index: MediaSearchIndex): CoveragePlan {
  const beats = brief.beats.map(beat => {
    const results = index.search(beat.query, { limit: 4 });
    return {
      beatId: beat.id,
      role: beat.role,
      query: beat.query,
      ...(results[0] ? { primary: choice(results[0]) } : {}),
      alternatives: results.slice(1).map(choice),
    } satisfies CoverageBeat;
  });
  const uncoveredBeatIds = beats.filter(beat => !beat.primary).map(beat => beat.beatId);
  return {
    briefId: brief.id,
    beats,
    uncoveredBeatIds,
    coverageDebt: uncoveredBeatIds.length,
    coverageRatio: beats.length ? (beats.length - uncoveredBeatIds.length) / beats.length : 1,
  };
}

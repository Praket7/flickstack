import type { MediaSearchIndex, SearchResult } from '../../search/src/search.ts';

export interface EvidenceRequest { query: string; modality?: 'speech' | 'visual' | 'all'; minScore?: number }
export interface EvidenceRound { request: EvidenceRequest; results: SearchResult[]; sufficient: boolean; reason: string }

export function seekEvidence(index: MediaSearchIndex, request: EvidenceRequest): EvidenceRound {
  const results = index.search(request.query, { modality: request.modality ?? 'all', limit: 6 });
  const minScore = request.minScore ?? 2;
  const sufficient = results.length > 0 && results[0].score >= minScore;
  return {
    request,
    results,
    sufficient,
    reason: sufficient ? 'strong local evidence found' : 'evidence is weak; inspect additional keyframes or transcript windows',
  };
}

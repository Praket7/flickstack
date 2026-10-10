import type { MediaSearchIndex, SearchResult } from '../../search/src/search.ts';

export interface BriefBeat { id: string; query: string; role: 'hook'|'context'|'proof'|'demo'|'emotion'|'cta'|string; required?: boolean }
export interface Brief { id: string; title: string; beats: BriefBeat[] }
export interface CoverageChoice { assetId: string; start: number; end: number; confidence: number; evidence: string[] }
export type GenerationEligibility='forbidden'|'allowed'|'required';
export interface CoverageBeat { beatId: string; role: string; query: string; primary?: CoverageChoice; alternatives: CoverageChoice[]; evidenceStrength:number; generationEligibility:GenerationEligibility; generationReason?:string }
export interface CoveragePlan { briefId: string; beats: CoverageBeat[]; uncoveredBeatIds: string[]; coverageDebt: number; coverageRatio: number }
export interface MediaCoverageLocks { lockedAssetIds?:Set<string>; commerciallyUsableAssetIds?:Set<string> }
export interface CoverageRecommendation{beatId:string;action:'use-evidence'|'generate'|'search-more';reason:string}

function choice(result: SearchResult): CoverageChoice {
  return {assetId:result.assetId,start:result.start,end:result.end,confidence:Math.min(1,result.score/10),evidence:result.evidence};
}
function policy(beat:BriefBeat,primary:CoverageChoice|undefined,locks:MediaCoverageLocks):Pick<CoverageBeat,'evidenceStrength'|'generationEligibility'|'generationReason'>{
 const evidenceStrength=primary?.confidence??0;if(!primary)return{evidenceStrength,generationEligibility:beat.required?'required':'allowed',generationReason:beat.required?'required beat has no source evidence':'no source evidence; generation may fill the optional gap'};
 const commercial=locks.commerciallyUsableAssetIds,rightsKnownUsable=!commercial||commercial.has(primary.assetId);if(!rightsKnownUsable)return{evidenceStrength,generationEligibility:'allowed',generationReason:'source evidence exists but rights are incompatible or unconfirmed'};
 if(beat.role==='cta')return{evidenceStrength,generationEligibility:'forbidden',generationReason:'CTA and critical copy remain native editable text'};
 if(locks.lockedAssetIds?.has(primary.assetId))return{evidenceStrength,generationEligibility:'forbidden',generationReason:'locked usable source evidence must be preserved'};
 if(evidenceStrength>=.35)return{evidenceStrength,generationEligibility:'forbidden',generationReason:'strong usable source evidence already covers this beat'};
 return{evidenceStrength,generationEligibility:'allowed',generationReason:'source evidence is weak; generation may fill the coverage gap'};
}
export function planCoverage(brief: Brief, index: MediaSearchIndex, locks:MediaCoverageLocks={}): CoveragePlan {
  const beats = brief.beats.map(beat => {const results=index.search(beat.query,{limit:4}),primary=results[0]?choice(results[0]):undefined;return{beatId:beat.id,role:beat.role,query:beat.query,...(primary?{primary}:{}),alternatives:results.slice(1).map(choice),...policy(beat,primary,locks)} satisfies CoverageBeat;});
  const uncoveredBeatIds=beats.filter(beat=>!beat.primary).map(beat=>beat.beatId);
  return{briefId:brief.id,beats,uncoveredBeatIds,coverageDebt:uncoveredBeatIds.length,coverageRatio:beats.length?(beats.length-uncoveredBeatIds.length)/beats.length:1};
}
export function recommendCoverageActions(plan:CoveragePlan,options:{strongEvidenceThreshold?:number}={}):CoverageRecommendation[]{const threshold=options.strongEvidenceThreshold??.35;return plan.beats.map(beat=>{if(beat.generationEligibility==='required')return{beatId:beat.beatId,action:'generate' as const,reason:beat.generationReason??'required uncovered beat'};if(beat.generationEligibility==='forbidden'&&beat.primary)return{beatId:beat.beatId,action:'use-evidence' as const,reason:beat.generationReason??'usable evidence exists'};if(beat.primary&&beat.evidenceStrength>=threshold)return{beatId:beat.beatId,action:'use-evidence' as const,reason:'existing evidence is strong enough'};return{beatId:beat.beatId,action:beat.generationEligibility==='allowed'?'generate' as const:'search-more' as const,reason:beat.generationReason??'coverage needs improvement'}})}

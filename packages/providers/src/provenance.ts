export interface ProvenanceRecord {
  provider:string; creator?:string; originalUrl:string; license:string;
  commercialAllowed:boolean|null; attributionRequired:boolean; retrievedAt:string;
}
export interface RightsDecision { allowed:boolean; reason?:string }
export function canUseAsset(record:ProvenanceRecord,intendedUse:'commercial'|'noncommercial'):RightsDecision {
  if(!record.originalUrl?.trim()) return {allowed:false,reason:'source URL is missing'};
  if(!record.provider?.trim()) return {allowed:false,reason:'provider is missing'};
  if(!record.license?.trim()||record.license.toLowerCase()==='unknown') return {allowed:false,reason:'license is unknown'};
  if(intendedUse==='commercial'&&record.commercialAllowed!==true) return {allowed:false,reason:'commercial use is not confirmed'};
  if(record.attributionRequired&&!record.creator?.trim()) return {allowed:false,reason:'creator attribution is missing'};
  return {allowed:true};
}
export function buildAttribution(record:ProvenanceRecord):string {
  if(!canUseAsset(record,record.commercialAllowed?'commercial':'noncommercial').allowed) throw new Error('Cannot build attribution for unusable provenance record');
  return `${record.creator??'Unknown creator'} — ${record.license} — ${record.originalUrl}`;
}

export interface ExternalAssetResult { id:string; title:string; previewUrl?:string; downloadUrl:string; provenance:ProvenanceRecord }
export interface MediaProvider {
  id:string;
  search(query:string):Promise<ExternalAssetResult[]>;
  inspect(id:string):Promise<ExternalAssetResult>;
  download(asset:ExternalAssetResult,destination:string):Promise<string>;
}

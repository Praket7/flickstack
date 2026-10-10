export interface HdrMetadata { transfer:'pq'|'hlg'; masteringNits:number; maxCll?:number; maxFall?:number }
export interface ColorPipeline { configId:string; configPath?:string; workingSpace:string; display:string; view:string; look?:string; outputSpace?:string; hdr?:HdrMetadata }
export interface MediaColorTag { assetId:string; inputSpace:string; override:boolean }
export interface ColorTransformDescriptor { status:'ready'|'identity'|'unsupported'; configId:string; configHash?:string; inputSpace:string; workingSpace:string; display?:string; view?:string; look?:string; outputSpace?:string; diagnostic?:string }
export interface ScopeAnalysis { histogram:{r:number[];g:number[];b:number[];luma:number[]}; waveform:number[][]; vectorscope:number[][] }

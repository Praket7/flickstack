import type { ColorPipeline,MediaColorTag } from './types.ts';
const text=(v:unknown,n:string)=>{if(typeof v!=='string'||!v.trim())throw new Error(`${n} is required`);return v};
export function validateColorPipeline(input:ColorPipeline):ColorPipeline{
 text(input.configId,'configId');text(input.workingSpace,'workingSpace');text(input.display,'display');text(input.view,'view');
 if(input.hdr){if(!['pq','hlg'].includes(input.hdr.transfer))throw new Error('Unsupported HDR transfer');for(const [k,v] of Object.entries(input.hdr))if(k!=='transfer'&&v!==undefined&&(!Number.isFinite(v)||Number(v)<0))throw new Error(`Invalid HDR ${k}`)}
 return structuredClone(input);
}
export function validateMediaColorTags(tags:MediaColorTag[],assetIds:Set<string>):MediaColorTag[]{const seen=new Set<string>();for(const t of tags){text(t.assetId,'assetId');text(t.inputSpace,'inputSpace');if(seen.has(t.assetId))throw new Error(`Duplicate media color tag ${t.assetId}`);if(!assetIds.has(t.assetId))throw new Error(`Unknown color-tagged asset ${t.assetId}`);seen.add(t.assetId)}return structuredClone(tags)}

import type { FrameRange, RenderGraph, RenderInvalidation, RenderNodeKind } from './types.ts';
function stable(v:unknown){return JSON.stringify(v);}
function merge(ranges:FrameRange[]):FrameRange[]{const a=[...ranges].sort((x,y)=>x.start-y.start);const out:FrameRange[]=[];for(const r of a){const last=out.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else out.push({...r});}return out;}
function qcFor(kind:RenderNodeKind):string|undefined{if(kind==='text-scene'||kind==='vector-scene'||kind==='matte')return'design-qc';if(kind==='camera'||kind==='motion-blur'||kind==='shared-transition'||kind==='tracking-transform')return'motion-qc';return undefined;}
export function computeInvalidation(before:RenderGraph,after:RenderGraph):RenderInvalidation {
 const bm=new Map(before.nodes.map(n=>[n.id,n])); const am=new Map(after.nodes.map(n=>[n.id,n])); const changed:string[]=[]; const ranges:FrameRange[]=[];const requiredQc=new Set<string>();
 for(const id of new Set([...bm.keys(),...am.keys()])){const b=bm.get(id),a=am.get(id);if(!b||!a||stable(b)!==stable(a)){changed.push(id);const r=a?.range??b?.range;if(r)ranges.push(r);const qc=qcFor((a?.kind??b?.kind)!);if(qc)requiredQc.add(qc);}}
 const downstream=new Set<string>(); let frontier=[...changed]; while(frontier.length){const cur=frontier.shift()!;for(const n of after.nodes)if(n.upstream.includes(cur)&&!downstream.has(n.id)){downstream.add(n.id);frontier.push(n.id);}}
 return {ranges:merge(ranges.filter(r=>r.end>r.start)),changedNodeIds:changed.sort(),downstreamNodeIds:[...downstream].sort(),cacheKeys:[...new Set([...changed,...downstream])].sort(),requiredQcIds:[...requiredQc].sort()};
}

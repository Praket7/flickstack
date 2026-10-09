import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRenderGraph, computeInvalidation, validateCompositionGraph } from '../../packages/render-graph/src/index.ts';
import { applyV3Operation } from '../../packages/timeline/src/v3.ts';
import { evaluateMotionComposition } from '../../packages/motion/src/v3.ts';
import { motionV03Project } from '../fixtures/motion-v03-project.ts';

test('v3 RenderGraph preserves scene timing, professional motion node semantics and deterministic compilation',()=>{
 const p=motionV03Project(),g=compileRenderGraph(p),again=compileRenderGraph(p);assert.deepEqual(g,again);assert.deepEqual(validateCompositionGraph(p).filter(d=>d.severity==='error'),[]);
 const kinds=new Set(g.nodes.map(n=>n.kind));for(const kind of ['motion-source','text-scene','vector-scene','motion-layer','camera','matte','motion-blur','shared-transition','tracking-transform','compositing-node','audio-analysis'])assert.ok(kinds.has(kind as any),`${kind}: ${[...kinds].join(',')}`);
 const titleNode=g.nodes.find(n=>n.id.includes(':layer:title'))!;assert.deepEqual(titleNode.range,{start:0,end:120});assert.ok(evaluateMotionComposition(p.motionCompositions[0],119).layers.some(l=>l.id==='title'));assert.throws(()=>evaluateMotionComposition(p.motionCompositions[0],120),/outside/i);
 const edited=applyV3Operation(p,{type:'set_motion_property',compositionId:'motion-ui',layerId:'title',path:'transform.position',value:[184,176,0]}).project,after=compileRenderGraph(edited),invalid=computeInvalidation(g,after);assert.ok(invalid.changedNodeIds.some(id=>id.includes(':layer:title')));assert.ok(invalid.ranges.some(r=>r.start===0&&r.end===120));assert.ok(invalid.requiredQcIds.includes('design-qc'));
});

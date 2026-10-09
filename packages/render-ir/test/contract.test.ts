import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRenderGraph } from '../../render-graph/src/compile.ts';
import { motionV03Project } from '../../../tests/fixtures/motion-v03-project.ts';
import { compileRenderProgram, validateRenderProgram } from '../src/compile.ts';

test('compileRenderProgram preserves editable v3 semantics without resolved pixels', () => {
  const project=motionV03Project();
  const graph=compileRenderGraph(project);
  const program=compileRenderProgram(project,graph,{compositionId:'motion-ui'});
  assert.equal(program.version,1);
  assert.equal(program.projectVersion,3);
  assert.equal(program.target.compositionId,'motion-ui');
  assert.equal(program.surface.width,1080);
  assert.equal(program.surface.height,1920);
  assert.ok(program.layers.some(l=>l.kind==='text'));
  assert.ok(program.layers.some(l=>l.kind==='camera'));
  assert.ok(program.layers.some(l=>l.matte?.sourceLayerId==='ui-matte'));
  assert.ok(program.graph.nodes.some(n=>n.kind==='compositing-node'));
  assert.equal(JSON.stringify(program).includes('resolvedPixels'),false);
  assert.equal(JSON.stringify(program).includes('flattenedGeneratedScene'),false);
  assert.doesNotThrow(()=>validateRenderProgram(program));
});

test('RenderProgram validation rejects unknown versions, graph cycles, non-finite values and allocation abuse', () => {
  const project=motionV03Project();
  const graph=compileRenderGraph(project);
  const program=compileRenderProgram(project,graph,{compositionId:'motion-ui'});
  assert.throws(()=>validateRenderProgram({...program,version:2} as any),/major version/i);
  const cycle=structuredClone(program); cycle.graph.nodes[0].upstream=[cycle.graph.nodes[0].id];
  assert.throws(()=>validateRenderProgram(cycle),/cycle/i);
  const nonFinite=structuredClone(program); nonFinite.surface.width=Number.POSITIVE_INFINITY;
  assert.throws(()=>validateRenderProgram(nonFinite),/finite/i);
  const huge=structuredClone(program); huge.layers=Array.from({length:4097},(_,i)=>({...huge.layers[0],id:`x${i}`}));
  assert.throws(()=>validateRenderProgram(huge),/layer limit/i);
});

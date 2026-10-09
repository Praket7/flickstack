import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createColorIntent,
  importStructuredLottie,
  importStructuredSvg,
  professionalInterchangeCapabilities,
} from '../src/index.ts';
import { effectHostCapabilities } from '../../effects/src/index.ts';

test('structured SVG adapter preserves safe vector nodes and rejects active/external content',()=>{
  const doc=importStructuredSvg('<svg viewBox="0 0 320 180"><g id="hero"><rect id="card" x="8" y="10" width="120" height="64" rx="12" fill="#fff"/><path id="accent" d="M0 0 L20 20" stroke="#000"/></g></svg>');
  assert.deepEqual(doc.viewBox,[0,0,320,180]);
  assert.deepEqual(doc.nodes.map(n=>n.id).filter(Boolean),['hero','card','accent']);
  assert.equal(doc.nativeExecution,false);
  assert.throws(()=>importStructuredSvg('<svg><script>alert(1)</script></svg>'),/active content|unsafe/i);
  assert.throws(()=>importStructuredSvg('<svg><image href="https://example.com/a.png"/></svg>'),/external|unsupported/i);
  assert.throws(()=>importStructuredSvg('<svg><rect onclick="steal()"/></svg>'),/event|unsafe/i);
});

test('structured Lottie adapter is deterministic and refuses expressions or network assets',()=>{
  const source={v:'5.12.2',fr:30,ip:0,op:90,w:1080,h:1080,layers:[{ind:1,ty:4,nm:'Shape',ip:0,op:90,parent:0}],assets:[]};
  const a=importStructuredLottie(source),b=importStructuredLottie(JSON.stringify(source));
  assert.deepEqual(a,b);assert.equal(a.layers[0].name,'Shape');assert.equal(a.nativeExecution,false);
  assert.throws(()=>importStructuredLottie({...source,layers:[{ind:1,ty:4,nm:'Bad',ip:0,op:90,x:'time*10'}]}),/expression/i);
  assert.throws(()=>importStructuredLottie({...source,assets:[{id:'img',u:'https://evil.example/',p:'x.png'}]}),/external|network/i);
});

test('professional capability and color records clearly separate metadata support from native processing',()=>{
  const caps=professionalInterchangeCapabilities();
  assert.equal(caps.find(c=>c.id==='otio')?.export,'supported');
  assert.equal(caps.find(c=>c.id==='aaf')?.export,'unsupported');
  assert.equal(caps.find(c=>c.id==='ocio')?.processing,'metadata-only');
  const ofx=effectHostCapabilities().find(c=>c.standard==='openfx');assert.equal(ofx?.nativeExecution,false);assert.match(ofx?.diagnostic??'',/disabled|not available/i);
  const intent=createColorIntent({workingSpace:'acescg',displaySpace:'rec709',transfer:'srgb'});assert.equal(intent.processing,'metadata-only');assert.equal(intent.workingSpace,'acescg');
});

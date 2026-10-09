import test from 'node:test';
import assert from 'node:assert/strict';
import { FallbackTextShaper, ReferenceTextShaper, TestFallbackTextShaper, selectorWeights, textBounds, validateNativeTextLayout, type TextLayoutOptions } from '../src/index.ts';

const options:TextLayoutOptions={fontSize:40,lineHeight:48,tracking:0,maxWidth:300,horizontalAlign:'left'};

test('fallback shaper preserves editable unicode clusters and wraps deterministic lines',()=>{
  const layout=new FallbackTextShaper().shape('Hi 👨‍🚀 world again',options);
  assert.ok(layout.clusters.some(c=>c.text==='👨‍🚀'));
  assert.ok(layout.lines.length>=2);
  assert.deepEqual(new FallbackTextShaper().shape('Hi 👨‍🚀 world again',options),layout);
  const b=textBounds(layout);assert.ok(b.width<=300);assert.ok(b.height>0);
});

test('selectors target characters words lines ranges regex and seeded random deterministically',()=>{
  const text='Build fast\nShip safely';
  const layout=new FallbackTextShaper().shape(text,{...options,maxWidth:1000});
  const chars=selectorWeights(text,layout,{id:'c',type:'index-range',start:0,end:5});
  assert.equal(chars.filter(x=>x===1).length,5);
  const words=selectorWeights(text,layout,{id:'w',type:'words',start:1,end:2});
  assert.ok(words.some(x=>x===1));
  assert.ok(words.some(x=>x===0));
  const lines=selectorWeights(text,layout,{id:'l',type:'lines',start:1,end:2});
  assert.ok(lines.slice(layout.lines[0].clusterEnd).every(x=>x===1));
  const regex=selectorWeights(text,layout,{id:'r',type:'regex',pattern:'Ship'});
  assert.equal(regex.reduce((a,b)=>a+b,0),4);
  const randomA=selectorWeights(text,layout,{id:'s',type:'seeded-random',probability:.5,seed:42});
  const randomB=selectorWeights(text,layout,{id:'s',type:'seeded-random',probability:.5,seed:42});
  assert.deepEqual(randomA,randomB);
});

test('production typography contract exposes cluster/glyph provenance and distinguishes test fallback metrics',()=>{
  const ref=new ReferenceTextShaper().shape('office 👨‍🚀 مرحبا',{...options,maxWidth:1000});
  assert.equal(ref.engine,'reference');
  assert.ok(ref.clusters.every(c=>Array.isArray(c.glyphIds)&&c.glyphIds.length>0));
  assert.ok(ref.fontProvenance.length>0);
  assert.equal(ref.direction,'mixed');
  assert.doesNotThrow(()=>validateNativeTextLayout({...ref,engine:'native-parley'}));
  const fallback=new TestFallbackTextShaper().shape('AV fi',{...options,maxWidth:1000});
  assert.equal(fallback.engine,'test-fallback');
  assert.throws(()=>validateNativeTextLayout(fallback),/native text layout/i);
});

test('reference text model keeps emoji and combining sequences atomic for selectors',()=>{
  const text='A e\u0301 👨‍👩‍👧‍👦 B';
  const layout=new ReferenceTextShaper().shape(text,{...options,maxWidth:1000});
  assert.ok(layout.clusters.some(c=>c.text==='e\u0301'));
  assert.ok(layout.clusters.some(c=>c.text==='👨‍👩‍👧‍👦'));
  const emojiIndex=layout.clusters.findIndex(c=>c.text==='👨‍👩‍👧‍👦');
  const weights=selectorWeights(text,layout,{id:'x',type:'index-range',start:emojiIndex,end:emojiIndex+1});
  assert.equal(weights.reduce((a,b)=>a+b,0),1);
});

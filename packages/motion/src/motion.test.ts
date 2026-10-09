import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateGeneratedMotionSource, validateMotionGraph, SvgMotionRenderer, motionComponents } from './index.ts';

test('generated motion source rejects dangerous capabilities before render', () => {
  for (const source of [
    "import fs from 'node:fs'", "require('child_process')", "eval('1+1')", "fetch('https://x')", "process.env.SECRET", "new Function('return 1')"
  ]) assert.throws(() => validateGeneratedMotionSource(source), /forbidden/i, source);
  assert.doesNotThrow(() => validateGeneratedMotionSource('const title = "Hello"; const opacity = 0.8;'));
});

test('motion graph detects cycles and invalid timing', () => {
  assert.throws(() => validateMotionGraph({ width:1080,height:1920,duration:30,nodes:[
    {id:'a',type:'group',start:0,duration:30,parentId:'b'}, {id:'b',type:'group',start:0,duration:30,parentId:'a'}
  ]}), /cycle/i);
  assert.throws(() => validateMotionGraph({ width:1080,height:1920,duration:30,nodes:[{id:'a',type:'text',start:20,duration:20,text:'x'}] }), /duration/i);
});

test('five core motion components render deterministic SVG frames', () => {
  const renderer = new SvgMotionRenderer();
  const names = ['kinetic-title','lower-third','product-card','stat-counter','caption-highlight'] as const;
  for (const name of names) {
    const graph = motionComponents[name]({ title:'FlickSmith', subtitle:'Agent-native', value:92 });
    const a = renderer.renderFrame(graph, 10);
    const b = renderer.renderFrame(graph, 10);
    assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'));
    assert.match(a, /<svg/);
  }
});

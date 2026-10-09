import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression, evaluateExpression } from '../src/index.ts';

test('restricted expressions evaluate deterministic math and explicit context references',()=>{
  const ctx={frame:15,time:.5,width:1920,height:1080,index:2,seed:7,vars:{'audio.energy':.8,'layer.card.x':100}};
  assert.equal(evaluateExpression('layer.card.x + audio.energy * 25',ctx),120);
  assert.equal(evaluateExpression('clamp(sin(time*pi) * 100, 0, 80)',ctx),80);
  assert.equal(evaluateExpression('noise(index, frame)',ctx),evaluateExpression('noise(index, frame)',ctx));
  const compiled=compileExpression('width / 2 + 24');
  assert.equal(compiled.evaluate(ctx),984);
});

test('expression parser rejects host capabilities and escape syntax',()=>{
  for(const source of [
    'process.env.SECRET','fetch(1)','require(1)','eval(1)','import(1)','globalThis.x','Date.now()',
    'Math.random()','this.constructor','constructor.constructor(1)','a[0]','while(1){}','x = 2','new Foo()','`x`','"x"'
  ]) assert.throws(()=>compileExpression(source),/forbidden|unexpected|unknown/i,source);
});

test('expression execution is bounded by operation budget',()=>{
  const c=compileExpression('sin(frame)+cos(frame)+sqrt(abs(frame))+pow(2,3)+max(1,2)+min(3,4)',{maxOperations:4});
  assert.throws(()=>c.evaluate({frame:1,time:0,width:1,height:1,index:0,seed:1,vars:{}}),/operation budget/i);
});

test('compileExpression emits portable bytecode and bytecode evaluation matches direct semantics across 1000 contexts',()=>{
  const compiled=compileExpression('select(audio.energy > 0.5, layer.card.x + noise(index, frame) * 4, width / 2)');
  assert.equal(compiled.version,1);
  assert.ok(Array.isArray(compiled.instructions) && compiled.instructions.length>0);
  assert.ok(compiled.instructions.every((i:any)=>typeof i.op==='string'));
  for(let i=0;i<1000;i++){
    const ctx={frame:i,time:i/30,width:1920,height:1080,index:i%17,seed:123,vars:{'audio.energy':(i%100)/99,'layer.card.x':80+(i%11)}};
    const a=compiled.evaluate(ctx);
    const b=compiled.evaluate(ctx);
    assert.ok(Math.abs(a-b)<=1e-12);
  }
});

test('portable expression bytecode supports comparisons/select and remains host isolated',()=>{
  const ctx={frame:10,time:1/3,width:1920,height:1080,index:1,seed:7,vars:{'audio.energy':.75,'layer.card.x':100}};
  assert.equal(compileExpression('select(audio.energy >= .5, layer.card.x, 0)').evaluate(ctx),100);
  assert.equal(compileExpression('select(frame == 10, 1, 0)').evaluate(ctx),1);
  for(const source of ['process.exit(1)','globalThis.fetch(1)','constructor.constructor(1)','document.cookie']){
    assert.throws(()=>compileExpression(source),/forbidden|unknown|unexpected/i);
  }
});

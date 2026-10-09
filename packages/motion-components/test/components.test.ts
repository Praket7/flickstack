import test from 'node:test';
import assert from 'node:assert/strict';
import { professionalMotionComponents, createMotionComponent } from '../src/index.ts';

const expected=['kinetic-title','paragraph-reveal','lower-third','message-composer','terminal-code','diff-review','command-palette','browser-window','stat-counter','table-list','feature-card','chart','callout','logo-end-card'];

test('professional component library exposes editable semantic motion structures',()=>{
  for(const id of expected){
    const component=professionalMotionComponents[id];assert.ok(component,id);assert.ok(component.composition.layers.length>0,id);assert.ok(component.responsiveVariants?.includes('landscape'),id);assert.ok(component.responsiveVariants?.includes('portrait'),id);
    assert.equal(component.composition.layers.some(l=>l.kind==='video'&&Boolean(l.assetId)),false,`${id} is not baked video`);
  }
});

test('component factory applies semantic text controls without flattening project structure',()=>{
  const a=createMotionComponent('message-composer',{title:'Ship it',subtitle:'Agent response'});
  const b=createMotionComponent('message-composer',{title:'Ship it',subtitle:'Agent response'});
  assert.deepEqual(a,b);
  assert.ok(a.composition.layers.some(l=>l.text==='Ship it'));
  assert.ok(a.soundCues?.some(c=>c.event==='send'));
});

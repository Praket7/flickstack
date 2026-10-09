import test from 'node:test';
import assert from 'node:assert/strict';
import { geometryBounds, trimPath, canMorph, morphGeometry, pointInGeometry, pathLength, sampleGeometryPath } from '../src/index.ts';

test('vector primitives report deterministic bounds',()=>{
  assert.deepEqual(geometryBounds({kind:'rect',width:100,height:50,radius:8}),{x:0,y:0,width:100,height:50});
  assert.deepEqual(geometryBounds({kind:'ellipse',rx:20,ry:10}),{x:-20,y:-10,width:40,height:20});
  assert.deepEqual(geometryBounds({kind:'line',from:[-5,3],to:[15,13]}),{x:-5,y:3,width:20,height:10});
});

test('trim path returns endpoints along polyline length',()=>{
  const out=trimPath({kind:'polygon',points:[[0,0],[100,0],[100,100]]},.25,.75);
  assert.deepEqual(out.points[0],[50,0]);
  assert.deepEqual(out.points.at(-1),[100,50]);
});

test('compatible vector geometries morph structurally while incompatible topology is rejected',()=>{
  const a={kind:'polygon' as const,points:[[0,0],[100,0],[100,100]] as any};
  const b={kind:'polygon' as const,points:[[0,0],[200,0],[200,200]] as any};
  assert.equal(canMorph(a,b),true);
  assert.deepEqual(morphGeometry(a,b,.5),{kind:'polygon',points:[[0,0],[150,0],[150,150]]});
  assert.equal(canMorph(a,{kind:'rect',width:10,height:10}),false);
});

test('point-in-geometry handles common masks',()=>{
  assert.equal(pointInGeometry({kind:'rect',width:100,height:100},[50,50]),true);
  assert.equal(pointInGeometry({kind:'ellipse',rx:50,ry:20},[60,0]),false);
  assert.equal(pointInGeometry({kind:'polygon',points:[[0,0],[100,0],[0,100]]},[10,10]),true);
});

test('sampled vector paths expose deterministic length and positions for renderer instances',()=>{
  const g={kind:'path' as const,closed:false,points:[{point:[0,0] as [number,number]},{point:[100,0] as [number,number]},{point:[100,100] as [number,number]}]};
  assert.equal(pathLength(g),200);
  assert.deepEqual(sampleGeometryPath(g,.25),[50,0]);
  assert.deepEqual(sampleGeometryPath(g,.75),[100,50]);
});

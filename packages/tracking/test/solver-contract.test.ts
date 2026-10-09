import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  deriveStabilizationTrack,
  solverCapability,
  trackingRecordFromPointResult,
  trackingRecordFromPlanarResult,
  type PointTrackResult,
  type PlanarTrackResult,
} from '../src/index.ts';

test('solver capability distinguishes record interpolation from native OpenCV solving',()=>{
  assert.equal(solverCapability('point',{opencv:false}).supported,false);
  assert.match(solverCapability('point',{opencv:false}).reason??'',/opencv|native/i);
  assert.equal(solverCapability('planar',{opencv:true}).supported,true);
  assert.equal(solverCapability('camera-3d',{opencv:true}).supported,false);
});

test('point solver result preserves per-frame error confidence and converts to an editable tracking record',()=>{
  const result:PointTrackResult={kind:'point',algorithm:'opencv-pyr-lk',algorithmVersion:'0.4',seed:[100,100],frames:[
    {frame:0,point:[100,100],status:'tracked',forwardBackwardError:0.1,confidence:0.99},
    {frame:1,point:[104,98],status:'tracked',forwardBackwardError:0.2,confidence:0.96},
    {frame:2,point:[108,96],status:'occluded',forwardBackwardError:4.2,confidence:0.12},
  ]};
  const record=trackingRecordFromPointResult('track-1',result);
  assert.equal(record.kind,'point');
  assert.equal(record.supported,true);
  assert.deepEqual(record.keyframes.map(k=>k.value),[[100,100],[104,98],[108,96]]);
  assert.equal(record.keyframes[2].confidence,0.12);
  assert.match(record.diagnostics?.[2]??'',/frame 2.*occluded.*4\.2/i);
});

test('planar result converts homography-derived corner data and stabilization derives inverse motion',()=>{
  const result:PlanarTrackResult={kind:'planar',algorithm:'opencv-orb-ransac',algorithmVersion:'0.4',referenceQuad:[[10,10],[110,10],[110,60],[10,60]],frames:[
    {frame:0,quad:[[10,10],[110,10],[110,60],[10,60]],homography:[1,0,0,0,1,0,0,0,1],status:'tracked',reprojectionError:0.1,inlierRatio:0.95,confidence:0.97},
    {frame:1,quad:[[15,12],[115,12],[115,62],[15,62]],homography:[1,0,5,0,1,2,0,0,1],status:'tracked',reprojectionError:0.2,inlierRatio:0.9,confidence:0.94},
  ]};
  const record=trackingRecordFromPlanarResult('plane-1',result);
  assert.equal(record.kind,'planar');
  assert.deepEqual((record.keyframes[1].value as any).quad,result.frames[1].quad);
  const stab=deriveStabilizationTrack('stab-1',result);
  assert.equal(stab.kind,'stabilization');
  assert.deepEqual(stab.keyframes[0].value,{x:0,y:0,rotation:0,scale:1});
  const v=stab.keyframes[1].value as any;
  assert.ok(v.x<0 && v.y<0,'stabilization must invert camera translation');
});

test('native tracker crate is feature-gated and contains actual LK, homography and diagnostics paths',()=>{
  const cargo=readFileSync(new URL('../../../crates/flick-tracking-opencv/Cargo.toml',import.meta.url),'utf8');
  const point=readFileSync(new URL('../../../crates/flick-tracking-opencv/src/point.rs',import.meta.url),'utf8');
  const planar=readFileSync(new URL('../../../crates/flick-tracking-opencv/src/planar.rs',import.meta.url),'utf8');
  const lib=readFileSync(new URL('../../../crates/flick-tracking-opencv/src/lib.rs',import.meta.url),'utf8');
  assert.match(cargo,/opencv-backend/);
  assert.match(cargo,/opencv\s*=.*optional\s*=\s*true/s);
  assert.match(point,/calc_optical_flow_pyr_lk/);
  assert.match(point,/forward_backward|forward.*backward/is);
  assert.match(planar,/find_homography/);
  assert.match(planar,/RANSAC|ransac/);
  assert.match(lib,/Unavailable|unavailable/);
});

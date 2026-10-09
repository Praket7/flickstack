import test from 'node:test';
import assert from 'node:assert/strict';
import { trackingCapability, sampleTrackingRecord, attachPointTrack } from '../src/index.ts';
import type { TrackingRecord } from '../../schema/src/v3/project.ts';

const point:TrackingRecord={id:'p',algorithm:'local',algorithmVersion:'1',kind:'point',supported:true,keyframes:[{frame:0,value:[0,0]},{frame:10,value:[100,50]}]};

test('tracking capabilities distinguish implemented records from reserved future kinds',()=>{
  for(const kind of ['point','planar','corner-pin','stabilization','mask'] as const)assert.equal(trackingCapability(kind).supported,true,kind);
  for(const kind of ['object','camera-3d','surface'] as const)assert.equal(trackingCapability(kind).supported,false,kind);
});

test('tracking sampler interpolates deterministic numeric structures',()=>{
  assert.deepEqual(sampleTrackingRecord(point,5),[50,25]);
  assert.deepEqual(sampleTrackingRecord(point,5),sampleTrackingRecord(point,5));
  const planar:TrackingRecord={id:'pl',algorithm:'local',algorithmVersion:'1',kind:'planar',supported:true,keyframes:[{frame:0,value:{x:0,y:0,scale:1,rotation:0}},{frame:10,value:{x:20,y:10,scale:2,rotation:10}}]};
  assert.deepEqual(sampleTrackingRecord(planar,5),{x:10,y:5,scale:1.5,rotation:5});
});

test('point attachments add tracked motion explicitly and unsupported tracker records fail loudly',()=>{
  assert.deepEqual(attachPointTrack([10,20,3],point,5),[60,45,3]);
  assert.throws(()=>sampleTrackingRecord({...point,kind:'object',supported:false},5),/unsupported/i);
});

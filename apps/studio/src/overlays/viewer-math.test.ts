import test from 'node:test';import assert from 'node:assert/strict';
import {composeTransform3D,multiply4,invert4,transformPoint,worldToScreen,screenToWorldAtCameraDepth,snapTransformDelta,GestureTransaction} from './viewer-math.ts';

test('screen world and layer coordinates round trip under parenting and perspective camera',()=>{
 const parent=composeTransform3D({position:[140,70,-40],anchor:[0,0,0],scale:[1.2,.8,1],rotation:[0,12,6]});
 const local=composeTransform3D({position:[30,-20,-420],anchor:[5,5,0],scale:[1,1,1],rotation:[3,-8,15]});const world=multiply4(parent,local);
 const camera=composeTransform3D({position:[0,0,200],anchor:[0,0,0],scale:[1,1,1],rotation:[0,0,0]});const view=invert4(camera);
 const layerPoint:[number,number,number]=[22,18,0],wp=transformPoint(world,layerPoint),screen=worldToScreen(wp,view,{width:1920,height:1080,focalLengthMm:50});const back=screenToWorldAtCameraDepth(screen,transformPoint(view,wp)[2],view,{width:1920,height:1080,focalLengthMm:50});const layerBack=transformPoint(invert4(world),back);
 for(let i=0;i<3;i++)assert.ok(Math.abs(layerBack[i]-layerPoint[i])<1e-6,`${i}: ${layerBack[i]}`);
});

test('transform delta snapping is modifier controlled and frame deterministic',()=>{assert.deepEqual(snapTransformDelta([13.2,27.7,4.9],{grid:10,enabled:true}),[10,30,0]);assert.deepEqual(snapTransformDelta([13.2,27.7,4.9],{grid:10,enabled:false}),[13.2,27.7,4.9]);});

test('gesture transaction publishes transient values but commits exactly once',()=>{const transient:number[]=[];const commits:number[]=[];const g=new GestureTransaction<number>(v=>transient.push(v),v=>commits.push(v));g.update(1);g.update(2);g.update(3);g.commit();g.commit();assert.deepEqual(transient,[1,2,3]);assert.deepEqual(commits,[3]);});

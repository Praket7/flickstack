import test from 'node:test';
import assert from 'node:assert/strict';
import { exportOtio } from './export.ts';
import type { FlickProject } from '../../schema/src/project.ts';
import { migrateV1ToV2, migrateV2ToV3, animated, defaultMotionTransform } from '../../schema/src/index.ts';

test('OTIO exporter preserves tracks clips timing and FlickSmith metadata',()=>{
 const p:FlickProject={version:1,id:'p',name:'P',format:{width:1920,height:1080,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:'/m/a.mp4',kind:'video',duration:100}],tracks:[{id:'v1',kind:'video',name:'V1',clips:[{id:'c1',assetId:'a',start:10,duration:30,sourceIn:5,speed:1.2}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 const otio=exportOtio(p) as any;
 assert.equal(otio.OTIO_SCHEMA,'Timeline.1');
 assert.equal(otio.tracks.children[0].children[0].name,'c1');
 assert.equal(otio.tracks.children[0].children[0].source_range.duration.value,30);
 assert.equal(otio.tracks.children[0].children[0].metadata.flicksmith.speed,1.2);
});

test('OTIO v3 export preserves editorial ranges and motion metadata without flattening it away',()=>{
 const p1:FlickProject={version:1,id:'p3',name:'P3',format:{width:1920,height:1080,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[{id:'m',at:12,label:'beat'}],style:{},provenance:[],checkpoints:[],branches:[]};
 const p=migrateV2ToV3(migrateV1ToV2(p1));p.motionCompositions.push({id:'motion',name:'Motion',width:1920,height:1080,duration:60,background:'transparent',layers:[]});p.motionStyles.push({id:'ui-native',name:'UI Native',curve:{type:'ease'}});
 const otio=exportOtio(p) as any;assert.equal(otio.metadata.flicksmith.version,3);assert.deepEqual(otio.metadata.flicksmith.motion.compositionIds,['motion']);assert.deepEqual(otio.metadata.flicksmith.motion.styleIds,['ui-native']);assert.equal(otio.metadata.flicksmith.markers[0].id,'m');
});


test('OTIO v3 export preserves structured motion metadata without flattening it into media',()=>{
 const base:FlickProject={version:1,id:'v3',name:'Motion',format:{width:1080,height:1920,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 const p=migrateV2ToV3(migrateV1ToV2(base));p.motionStyles.push({id:'ui',name:'UI Native',durationFrames:8,curve:{type:'ease'}});
 p.motionCompositions.push({id:'hero',name:'Hero',width:1080,height:1920,duration:90,background:'#000',layers:[{id:'title',kind:'text',name:'Title',start:0,duration:90,enabled:true,locked:false,zIndex:1,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,text:'Ship faster',textStyle:{fontSize:animated(96)}}]});
 const otio=exportOtio(p) as any;assert.equal(otio.metadata.flicksmith.version,3);assert.equal(otio.metadata.flicksmith.motion.compositions[0].id,'hero');assert.equal(otio.metadata.flicksmith.motion.compositions[0].layers[0].id,'title');assert.equal(otio.metadata.flicksmith.motion.styles[0].id,'ui');
});

test('OTIO v2/v3 editorial clip metadata preserves professional gain instead of reading v1-only volume fields',()=>{
 const base:FlickProject={version:1,id:'gain',name:'Gain',format:{width:1920,height:1080,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'a',path:'/m/a.wav',kind:'audio',duration:90}],tracks:[{id:'a1',kind:'audio',name:'A1',clips:[{id:'c',assetId:'a',start:0,duration:30,sourceIn:0,volume:.5}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 const v2=migrateV1ToV2(base),otio=exportOtio(v2) as any,meta=otio.tracks.children[0].children[0].metadata.flicksmith;
 assert.equal(meta.volume,undefined);assert.ok(Math.abs(meta.gainDb-(-6.020599913279624))<1e-9);
});

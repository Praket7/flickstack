import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV2ToV3,type FlickProjectV2,animated,defaultMotionTransform,type LayeredImageScene } from '../../schema/src/index.ts';
import { applyV3Operation } from '../../timeline/src/v3.ts';

function project(){
 const v2:FlickProjectV2={version:2,id:'p',name:'P',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'source',path:'/source.png',kind:'image'},{id:'layer',path:'/layer.png',kind:'image'}],rootCompositionId:'root',compositions:[{id:'root',name:'Root',width:640,height:360,tracks:[]}],audioBuses:[],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:false},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 const p=migrateV2ToV3(v2);
 p.motionCompositions.push({id:'generated',name:'Generated',width:640,height:360,duration:90,background:'transparent',layers:[{id:'scene:hero',kind:'image',name:'Hero',start:0,duration:90,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,assetId:'layer',props:{generatedSceneId:'scene',sourceLayerId:'hero'}}]});
 return p;
}
const scene:LayeredImageScene={id:'scene',sourceAssetId:'source',layerAssetIds:['layer'],cleanPlateAssetIds:['plate-a','plate-b'],decompositionProvider:'fixture',layers:[{id:'hero',assetId:'layer',name:'Hero',z:1,bounds:{x:0,y:0,width:640,height:360},maskAssetId:'hero-mask'}],diagnostics:[]};

test('generated-scene attachment rejects dangling mask and clean-plate references',()=>{
 const p=project();
 assert.throws(()=>applyV3Operation(p,{type:'attach_generated_scene',compositionId:'generated',scene}),/missing asset/);
 p.assets.push({id:'hero-mask',path:'/hero-mask.png',kind:'image'},{id:'plate-a',path:'/plate-a.png',kind:'image'},{id:'plate-b',path:'/plate-b.png',kind:'image'});
 const result=applyV3Operation(p,{type:'attach_generated_scene',compositionId:'generated',scene});
 assert.equal(result.project.generatedScenes?.[0].id,'scene');
 assert.deepEqual(result.project.generatedScenes?.[0].cleanPlateAssetIds,['plate-a','plate-b']);
});

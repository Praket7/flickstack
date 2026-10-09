import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateV1ToV2, migrateV2ToV3, animated, defaultMotionTransform, type FlickProject } from '../../../packages/schema/src/index.ts';
import { parseProjectV3 } from '../../../packages/schema/src/v3/parse.ts';
import { V3FlickSmithHost } from './host-v3.ts';

function project(){
 const v1:FlickProject={version:1,id:'p',name:'V3 Host',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 return migrateV2ToV3(migrateV1ToV2(v1));
}
const textLayer:any={id:'title',kind:'text',name:'Title',start:0,duration:60,enabled:true,locked:false,zIndex:1,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true,text:'Hello',textStyle:{fontSize:animated(48)}};

test('v3 host applies typed edits, persists atomically, and detects stale revisions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fsmcpv3-'));
 try{
  const path=join(dir,'project.flick.json');writeFileSync(path,JSON.stringify(project()));
  const host=new V3FlickSmithHost({project:project(),projectPath:path,permittedRoots:[dir]});
  const initial:any=await host.call('get_timeline',{});const r0=initial.revision;
  const created:any=await host.call('create_motion_composition',{expectedRevision:r0,composition:{id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',layers:[]},intent:'create motion scene'});
  assert.equal(created.ok,true);assert.ok(created.result.receipt.checkpointId);
  const stale:any=await host.call('set_motion_style',{expectedRevision:r0,style:{id:'late',name:'Late',curve:{type:'linear'}}});
  assert.equal(stale.ok,false);assert.equal(stale.conflict.currentRevision,host.revision);
  const added:any=await host.call('add_motion_layer',{expectedRevision:host.revision,compositionId:'mc',layer:textLayer,intent:'add title'});assert.equal(added.ok,true);
  const changed:any=await host.call('set_motion_property',{expectedRevision:host.revision,compositionId:'mc',layerId:'title',path:'opacity',value:.5});assert.equal(changed.ok,true);
  const saved=parseProjectV3(JSON.parse(readFileSync(path,'utf8')));assert.equal(saved.motionCompositions[0].layers[0].opacity.baseValue,.5);
  host.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('v3 host enforces locks and property paths and supports undo/redo',async()=>{
 const host=new V3FlickSmithHost({project:project()});
 await host.call('create_motion_composition',{expectedRevision:host.revision,composition:{id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',layers:[]}});
 await host.call('add_motion_layer',{expectedRevision:host.revision,compositionId:'mc',layer:textLayer});
 const before=host.revision;
 await host.call('set_motion_property',{expectedRevision:before,compositionId:'mc',layerId:'title',path:'opacity',value:.4});
 assert.equal(host.project.motionCompositions[0].layers[0].opacity.baseValue,.4);
 const undo:any=await host.call('undo',{expectedRevision:host.revision});assert.equal(undo.ok,true);assert.equal(host.project.motionCompositions[0].layers[0].opacity.baseValue,1);
 const redo:any=await host.call('redo',{expectedRevision:host.revision});assert.equal(redo.ok,true);assert.equal(host.project.motionCompositions[0].layers[0].opacity.baseValue,.4);
 await assert.rejects(()=>host.call('set_motion_property',{expectedRevision:host.revision,compositionId:'mc',layerId:'title',path:'__proto__.x',value:1}),/property path/i);
 await host.call('set_layer_metadata',{expectedRevision:host.revision,compositionId:'mc',layerId:'title',locked:true});
 await assert.rejects(()=>host.call('set_motion_property',{expectedRevision:host.revision,compositionId:'mc',layerId:'title',path:'opacity',value:.2}),/locked/i);
});

test('v3 diagnostics compile a native render program without mutating revision',async()=>{
 const host=new V3FlickSmithHost({project:project()});
 await host.call('create_motion_composition',{expectedRevision:host.revision,composition:{id:'mc',name:'Motion',width:640,height:360,duration:60,background:'transparent',layers:[]}});
 await host.call('add_motion_layer',{expectedRevision:host.revision,compositionId:'mc',layer:textLayer});
 const before=host.revision;const result:any=await host.call('get_render_diagnostics_v3',{compositionId:'mc'});
 assert.equal(result.projectVersion,3);assert.equal(result.compositionId,'mc');assert.equal(result.layerCount,1);assert.equal(host.revision,before);
});

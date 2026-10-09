import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1ToV2, migrateV2ToV3, animated, defaultMotionTransform, type FlickProject } from '../../packages/schema/src/index.ts';
import { runtimeForProject, createRpcHandler } from '../../apps/mcp/src/server.ts';

function project(){
 const v1:FlickProject={version:1,id:'p',name:'V3 Acceptance',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'img',path:'/tmp/hero.png',kind:'image'}],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 return migrateV2ToV3(migrateV1ToV2(v1));
}
const base=(id:string,kind:string,zIndex:number)=>({id,kind,name:id,start:0,duration:90,enabled:true,locked:false,zIndex,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true});

test('MCP v3 public RPC flow builds a typed editable motion scene with receipts and conflict safety',async()=>{
 const runtime=runtimeForProject(project());const rpc=createRpcHandler(runtime);
 const listed=await rpc({jsonrpc:'2.0',id:1,method:'tools/list'});const names=listed.result.tools.map((x:any)=>x.name);
 assert.ok(names.includes('create_motion_composition'));assert.ok(names.includes('set_motion_keyframes'));assert.ok(names.includes('redo'));
 let id=2;
 const call=async(name:string,args:Record<string,unknown>)=>rpc({jsonrpc:'2.0',id:id++,method:'tools/call',params:{name,arguments:args}});
 const timeline=await call('get_timeline',{});let revision=timeline.result.structuredContent.revision;
 const receipts:string[]=[];
 const mutate=async(name:string,args:Record<string,unknown>)=>{
  const response=await call(name,{expectedRevision:revision,...args});assert.equal(response.result.isError,undefined,JSON.stringify(response));
  const out=response.result.structuredContent;assert.equal(out.ok,true,JSON.stringify(out));assert.ok(out.result.receipt.checkpointId);receipts.push(out.result.receipt.checkpointId);revision=out.revision;return out;
 };
 await mutate('create_motion_composition',{composition:{id:'mc',name:'Hero',width:640,height:360,duration:90,background:'transparent',layers:[]},intent:'create scene'});
 await mutate('add_motion_layer',{compositionId:'mc',layer:{...base('title','text',2),text:'Launch',textStyle:{fontSize:animated(54)}},intent:'add title'});
 await mutate('add_motion_layer',{compositionId:'mc',layer:{...base('hero','image',1),assetId:'img'},intent:'add hero image'});
 await mutate('add_motion_layer',{compositionId:'mc',layer:{...base('camera','camera',10),motionBlur:false,camera:{focalLength:animated(50)}},intent:'add camera'});
 await mutate('set_motion_keyframes',{compositionId:'mc',layerId:'hero',path:'transform.position',keyframes:[{frame:0,value:[0,0,0],interpolation:'linear'},{frame:60,value:[30,0,-80],interpolation:'ease'}],intent:'parallax move'});
 await mutate('add_mask',{compositionId:'mc',layerId:'hero',mask:{id:'crop',kind:'rect',geometry:{kind:'rect',width:640,height:360},feather:animated(0),expansion:animated(0),invert:false,combine:'add'},intent:'mask hero'});
 await mutate('set_matte',{compositionId:'mc',layerId:'hero',matte:{sourceLayerId:'title',mode:'alpha'},intent:'matte hero'});
 await mutate('set_motion_style',{style:{id:'premium',name:'Premium',curve:{type:'ease'}},intent:'set motion style'});
 assert.ok(receipts.length>=8);
 const current=revision;
 const stale=await call('set_motion_style',{expectedRevision:'stale-revision',style:{id:'bad',name:'Bad',curve:{type:'linear'}}});
 assert.equal(stale.result.structuredContent.ok,false);assert.equal(stale.result.structuredContent.conflict.currentRevision,current);
 const injected=await call('set_motion_style',{expectedRevision:current,style:{id:'secret',name:'Secret',curve:{type:'linear'},metadata:{apiKey:'do-not-store'}}});
 assert.equal(injected.result.isError,true);assert.match(injected.result.content[0].text,/credential|secret|api.?key/i);
 const final=await call('get_timeline',{});assert.equal(final.result.structuredContent.revision,current);assert.equal(final.result.structuredContent.project.motionCompositions[0].layers.length,3);
 runtime.host.close?.();
});

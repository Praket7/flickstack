import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FlickProjectV2 } from '../../../packages/schema/src/v2/project.ts';
import { V2FlickSmithHost } from './host-v2.ts';
import { v2ToolCatalog } from './tools.ts';

function project(): FlickProjectV2 {
  return {
    version:2,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[
      {id:'a',path:'/tmp/a.mp4',kind:'video'},{id:'b',path:'/tmp/b.mp4',kind:'video'},
    ],rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks:[{id:'v',kind:'video',name:'V',clips:[{
      id:'c',assetId:'a',start:0,duration:30,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,
    }]}]}],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[{
      id:'mc',name:'Interview',angles:[{id:'A',assetId:'a',sourceOffset:10,confidence:1},{id:'B',assetId:'b',sourceOffset:20,confidence:1}],program:[{start:0,end:15,angleId:'A'},{start:15,end:30,angleId:'B'}],
    }],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[],masks:[],
  };
}

test('v2 MCP host uses checkpointed revision-safe mutations and persists canonical v2 state',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fsmcpv2-'));
  try{
    const path=join(dir,'project.flick.json');writeFileSync(path,JSON.stringify(project()));
    const host=new V2FlickSmithHost({project:project(),projectPath:path,permittedRoots:[dir]});
    const initial=await host.call('get_timeline',{}) as any;
    assert.equal(initial.project.version,2);assert.equal(typeof initial.revision,'string');
    const changed=await host.call('set_transform',{expectedRevision:initial.revision,compositionId:'root',clipId:'c',transform:{x:12},intent:'move right'}) as any;
    assert.equal(changed.ok,true);assert.equal(changed.result.project.compositions[0].tracks[0].clips[0].transform.x,12);assert.match(changed.result.checkpointId,/^cp_/);
    const stale=await host.call('set_opacity',{expectedRevision:initial.revision,compositionId:'root',clipId:'c',opacity:.5}) as any;
    assert.equal(stale.ok,false);assert.equal(stale.conflict.currentRevision,changed.revision);
    const disk=JSON.parse(readFileSync(path,'utf8'));assert.equal(disk.version,2);assert.equal(disk.compositions[0].tracks[0].clips[0].transform.x,12);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('v2 MCP host switches and materializes multicam through canonical project state',async()=>{
  const host=new V2FlickSmithHost({project:project()});
  const before=await host.call('get_timeline',{}) as any;
  const switched=await host.call('switch_multicam_angle',{expectedRevision:before.revision,groupId:'mc',start:0,end:15,angleId:'B',intent:'choose B'}) as any;
  assert.equal(switched.ok,true);
  const materialized=await host.call('materialize_multicam',{expectedRevision:switched.revision,groupId:'mc',compositionId:'root',trackId:'program',intent:'commit program'}) as any;
  assert.equal(materialized.ok,true);
  const track=materialized.result.project.compositions[0].tracks.find((t:any)=>t.id==='program');
  assert.ok(track);assert.deepEqual(track.clips.map((c:any)=>c.assetId),['b']);
  assert.equal(materialized.result.receipt.operation,'materialize_multicam');
});

test('v2 MCP catalog exposes professional editing verbs and no arbitrary execution',()=>{
  const names=v2ToolCatalog.map(t=>t.name);
  for(const name of ['get_timeline','set_transform','set_opacity','add_effect','set_keyframes','set_audio_bus_gain','switch_multicam_angle','materialize_multicam','render_final_v2','get_preview_capabilities','get_render_diagnostics']) assert.ok(names.includes(name),name);
  assert.equal(names.some(n=>/shell|exec|command|raw_fs/.test(n)),false);
});

test('v2 MCP host exposes explicit preview capability and render diagnostics',async()=>{
  const host=new V2FlickSmithHost({project:project(),previewEnvironment:{webGpu:false,webCodecs:false,nativeGpu:false,software:true}});
  const preview=await host.call('get_preview_capabilities',{}) as any;
  assert.equal(preview.backend,'software');assert.equal(preview.available,true);
  const diag=await host.call('get_render_diagnostics',{}) as any;
  assert.ok(diag.nodeCount>0);assert.deepEqual(diag.errors,[]);
});

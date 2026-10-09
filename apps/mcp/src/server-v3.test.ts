import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { migrateV1ToV2, migrateV2ToV3, type FlickProject } from '../../../packages/schema/src/index.ts';

function project(){
 const v1:FlickProject={version:1,id:'p',name:'V3 Server',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};
 return migrateV2ToV3(migrateV1ToV2(v1));
}

test('configured MCP server selects v3 host and advertises the v3 professional tool surface',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fsmcpserverv3-'));
 try{
  const path=join(dir,'project.flick.json');writeFileSync(path,JSON.stringify(project()));
  const input=[
   JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize'}),
   JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'}),
   JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_timeline',arguments:{}}}),
  ].join('\n')+'\n';
  const r=spawnSync(process.execPath,['--experimental-strip-types',resolve('apps/mcp/src/server.ts')],{cwd:resolve('.'),env:{...process.env,FLICKSMITH_PROJECT:path,FLICKSMITH_MEDIA_ROOTS:dir},input,encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  const lines=r.stdout.trim().split(/\n/).map(x=>JSON.parse(x));
  assert.equal(lines[0].result.serverInfo.version,'0.5.0-dev');
  const tools=lines[1].result.tools.map((t:any)=>t.name);
  assert.ok(tools.includes('create_motion_composition'));assert.ok(tools.includes('render_final_v3'));assert.ok(tools.includes('redo'));
  assert.equal(tools.includes('set_transform'),false);assert.equal(tools.includes('add_clip'),false);
  assert.equal(lines[2].result.structuredContent.project.version,3);assert.equal(typeof lines[2].result.structuredContent.revision,'string');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProjectV2 } from '../../../packages/schema/src/v2/project.ts';

function project():FlickProjectV2{return{version:2,id:'p',name:'V2 Server',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks:[]}],masks:[],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}

test('configured MCP server selects v2 host and advertises only the v2 professional tool surface',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fsmcpserverv2-'));
 try{
  const path=join(dir,'project.flick.json');writeFileSync(path,JSON.stringify(project()));
  const input=[
   JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}),
   JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_timeline',arguments:{}}}),
  ].join('\n')+'\n';
  const r=spawnSync(process.execPath,['--experimental-strip-types',resolve('apps/mcp/src/server.ts')],{cwd:resolve('.'),env:{...process.env,FLICKSMITH_PROJECT:path,FLICKSMITH_MEDIA_ROOTS:dir},input,encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  const lines=r.stdout.trim().split(/\n/).map(x=>JSON.parse(x));
  const tools=lines[0].result.tools.map((t:any)=>t.name);
  assert.ok(tools.includes('set_transform'));assert.ok(tools.includes('render_final_v2'));assert.equal(tools.includes('add_clip'),false);
  assert.equal(lines[1].result.structuredContent.project.version,2);assert.equal(typeof lines[1].result.structuredContent.revision,'string');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

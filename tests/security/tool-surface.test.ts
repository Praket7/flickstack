import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { toolCatalog, v2ToolCatalog } from '../../apps/mcp/src/tools.ts';
import { FlickSmithHost } from '../../apps/mcp/src/host.ts';
import type { FlickProject } from '../../packages/schema/src/project.ts';
import type { FlickProjectV2 } from '../../packages/schema/src/v2/project.ts';
import { serializeProject } from '../../packages/schema/src/project.ts';
import { serializeProjectV2 } from '../../packages/schema/src/v2/parse.ts';
import { applyV2Operation } from '../../packages/timeline/src/v2.ts';
import { applyOperation } from '../../packages/timeline/src/apply.ts';

function v1():FlickProject{return{version:1,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[{id:'v',kind:'video',name:'V',clips:[]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}
function v2():FlickProjectV2{return{version:2,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],rootCompositionId:'root',compositions:[{id:'root',name:'Main',width:64,height:64,tracks:[]}],masks:[],audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{},provenance:[],checkpoints:[],branches:[]};}

test('MCP catalogs expose no arbitrary execution or raw filesystem bypass',()=>{
 for(const catalog of [toolCatalog,v2ToolCatalog])for(const tool of catalog){assert.equal(/shell|exec|command|raw_fs|read_file|write_file/i.test(tool.name),false,tool.name);}
});

test('local import rejects URL and metadata-service style paths outside permitted roots',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flick-security-'));try{const host=new FlickSmithHost({project:v1(),permittedRoots:[dir]});await assert.rejects(()=>host.call('import_asset',{path:'http://169.254.169.254/latest/meta-data'}),/outside permitted media roots/);host.close();}finally{rmSync(dir,{recursive:true,force:true});}
});

test('project serializers refuse credential-shaped fields instead of persisting secrets',()=>{
 const a=v1();a.style={apiKey:'sk-secret'};assert.throws(()=>serializeProject(a),/secret|credential|apiKey/i);
 const b=v2();b.style={accessToken:'token-secret'};assert.throws(()=>serializeProjectV2(b),/secret|credential|accessToken/i);
});


test('canonical mutation engines reject credential-bearing edit payloads before state changes',()=>{
 const a=v1();assert.throws(()=>applyOperation(a,{type:'add_clip',trackId:'v',clip:{id:'c',assetId:'a',start:0,duration:1,sourceIn:0,props:{apiKey:'secret'}}}),/credential|secret/i);assert.equal(a.tracks[0].clips.length,0);
 const b=v2();b.compositions[0].tracks.push({id:'v',kind:'video',name:'V',clips:[{id:'c',assetId:'a',start:0,duration:1,sourceIn:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true}]});
 assert.throws(()=>applyV2Operation(b,{type:'add_effect',compositionId:'root',clipId:'c',effect:{id:'fx',type:'custom',enabled:true,params:{accessToken:'secret'}}}),/credential|secret/i);assert.equal(b.compositions[0].tracks[0].clips[0].effectStack.length,0);
});

test('runtime dependency audit distinguishes system FFmpeg licensing and bundled policy',()=>{
 const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/audit-runtime-deps.ts'],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout.trim().split(/\n/).at(-1)!);
 assert.equal(j.repositoryLicense,'Apache-2.0');assert.equal(j.ffmpeg.policy,'system-provided');assert.equal(j.ffmpeg.bundled,false);assert.equal(typeof j.ffmpeg.gplEnabled,'boolean');assert.equal(j.tesseract.bundled,false);assert.deepEqual(j.npmRuntimeDependencies,[]);
});

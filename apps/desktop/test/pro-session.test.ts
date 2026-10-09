import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';

const clientUrl = new URL('../web-src/mcp-client.js', import.meta.url);

test('desktop MCP client initializes, reads canonical timeline, and sends revision-safe professional edits', async () => {
  const calls:any[]=[];
  const server=createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));calls.push(body);
    let result:any={};
    if(body.method==='initialize') result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'flicksmith',version:'0.4.0'}};
    if(body.method==='tools/call'&&body.params.name==='get_timeline') result={structuredContent:{project:{version:2,id:'p',rootCompositionId:'root',compositions:[],audioBuses:[],multicamGroups:[]},revision:'rev-1'}};
    if(body.method==='tools/call'&&body.params.name==='set_opacity') result={structuredContent:{ok:true,result:{diff:{afterRevision:'rev-2'}}}};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const addr=server.address();assert.ok(addr&&typeof addr!=='string');
  const { McpDesktopClient }=await import(clientUrl.href);
  const c=new McpDesktopClient(`http://127.0.0.1:${addr.port}/mcp`);
  await c.initialize();
  const timeline=await c.getTimeline();assert.equal(timeline.revision,'rev-1');
  const edit=await c.callTool('set_opacity',{expectedRevision:timeline.revision,compositionId:'root',clipId:'c',opacity:.6});
  assert.equal(edit.ok,true);
  assert.deepEqual(calls.map(x=>x.method),['initialize','tools/call','tools/call']);
  assert.equal(calls[2].params.arguments.expectedRevision,'rev-1');
  server.close();
});

test('packaged desktop shell exposes real professional panels and canonical edit actions',()=>{
  const html=readFileSync(new URL('../web-src/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../web-src/app.js',import.meta.url),'utf8');
  const client=readFileSync(new URL('../web-src/mcp-client.js',import.meta.url),'utf8');
  for(const id of ['projectPath','openProject','programMonitor','timelinePanel','effectsPanel','audioMixer','multicamPanel','evidencePanel','repairPanel','diagnosticsPanel']) assert.match(html,new RegExp(`id=["']${id}["']`),`missing ${id}`);
  for(const tool of ['set_transform','set_opacity','set_audio_bus_gain','switch_multicam_angle','get_preview_capabilities','get_render_diagnostics']) assert.match(app,new RegExp(tool),`desktop shell must call ${tool}`);
  assert.match(client,/start_project_session/);
  assert.match(app,/McpDesktopClient/);
});

test('Tauri source owns canonical MCP lifecycle rather than asking the user to start a second engine',()=>{
  const main=readFileSync(new URL('../src-tauri/src/main.rs',import.meta.url),'utf8');
  const lifecycle=readFileSync(new URL('../src-tauri/src/mcp.rs',import.meta.url),'utf8');
  assert.match(main,/start_project_session/);assert.match(main,/stop_project_session/);
  assert.match(lifecycle,/127\.0\.0\.1/);assert.match(lifecycle,/FLICKSMITH_HTTP_PORT/);assert.match(lifecycle,/server\.ts/);assert.match(lifecycle,/--experimental-strip-types/);
});

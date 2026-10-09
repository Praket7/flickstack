import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc } from './server.ts';

test('MCP tools/call reaches real host and returns structured content',async()=>{
 const create=await handleRpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_project',arguments:{name:'RPC Demo',width:640,height:360}}});
 assert.equal(create.result.isError,undefined);
 const timeline=await handleRpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_timeline',arguments:{}}});
 assert.equal(timeline.result.structuredContent.project.name,'RPC Demo');
});

test('MCP unknown tool returns safe tool error rather than shell access',async()=>{
 const response=await handleRpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'exec',arguments:{command:'whoami'}}});
 assert.equal(response.result.isError,true);
 assert.match(response.result.content[0].text,/Unknown FlickSmith tool/);
});

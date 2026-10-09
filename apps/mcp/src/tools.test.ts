import test from 'node:test';
import assert from 'node:assert/strict';
import { toolCatalog } from './tools.ts';

test('MCP catalog exposes stable editing contracts and no arbitrary shell',()=>{
 const names=toolCatalog.map(t=>t.name);
 for(const name of ['create_project','get_timeline','add_clip','split_clip','ripple_delete','render_final','review_render','branch_project','diff_branches']) assert.ok(names.includes(name),name);
 assert.equal(names.some(n=>/shell|exec|command/.test(n)),false);
 for(const tool of toolCatalog){assert.ok(tool.inputSchema); assert.ok(tool.description.length>10);}
});

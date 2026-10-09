import test from 'node:test';
import assert from 'node:assert/strict';
import { toolCatalog, v2ToolCatalog, v3ToolCatalog } from './tools.ts';

test('MCP catalog exposes stable editing contracts and no arbitrary shell',()=>{
 const names=toolCatalog.map(t=>t.name);
 for(const name of ['create_project','get_timeline','add_clip','split_clip','ripple_delete','render_final','review_render','branch_project','diff_branches']) assert.ok(names.includes(name),name);
 assert.equal(names.some(n=>/shell|exec|command/.test(n)),false);
 for(const tool of toolCatalog){assert.ok(tool.inputSchema); assert.ok(tool.description.length>10);}
});

test('v2 catalog remains stable while v3 adds the professional motion surface',()=>{
 const v2Names=v2ToolCatalog.map(t=>t.name);
 assert.ok(v2Names.includes('set_transform'));
 assert.ok(v2Names.includes('render_final_v2'));
 assert.equal(v2Names.includes('create_motion_composition'),false);

 const names=v3ToolCatalog.map(t=>t.name);
 for(const name of [
  'get_timeline','create_motion_composition','add_motion_layer','remove_motion_layer','set_layer_metadata','set_layer_timing',
  'reparent_motion_layer','set_motion_property','set_motion_keyframes','set_motion_expression','add_motion_behavior',
  'reorder_motion_behaviors','set_text_style','set_text_selector','set_layout_constraints','add_mask','set_mask','set_matte',
  'set_camera','add_shared_transition','remove_shared_transition','set_compositing_graph','create_motion_rig','remove_motion_rig',
  'set_rig_control','bind_rig_control','set_responsive_variant','attach_tracking_data','analyze_audio','set_motion_style',
  'undo','redo','render_final_v3','get_render_diagnostics_v3'
 ]) assert.ok(names.includes(name),name);
 assert.equal(names.some(n=>/shell|exec|command/.test(n)),false);
});

test('every mutating v3 tool requires expectedRevision and exposes no executable payload',()=>{
 const readOnly=new Set(['get_timeline','render_final_v3','get_render_diagnostics_v3']);
 for(const tool of v3ToolCatalog){
  assert.ok(tool.inputSchema);
  assert.ok(tool.description.length>10);
  const schema=tool.inputSchema as {required?:string[];properties?:Record<string,unknown>};
  if(!readOnly.has(tool.name)) assert.ok(schema.required?.includes('expectedRevision'),`${tool.name} must require expectedRevision`);
  const serialized=JSON.stringify(tool.inputSchema).toLowerCase();
  assert.equal(/\b(shell|command|javascript|eval|executable)\b/.test(serialized),false,tool.name);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {callCraftTool,craftToolCatalog} from './craft-tools.ts';
test('craft catalog exposes planning and professional review without mutation authority',()=>{assert.deepEqual(craftToolCatalog.map(t=>t.name).sort(),['plan_human_craft_v3','review_human_craft_v3']);for(const tool of craftToolCatalog)assert.equal((tool.inputSchema as any).properties?.expectedRevision,undefined)});
test('craft review returns score and localized repair plan',async()=>{const result:any=await callCraftTool('review_human_craft_v3',{shots:[{durationFrames:30,transition:'zoom',cameraMove:'push',purpose:'hero'},{durationFrames:30,transition:'zoom',cameraMove:'push',purpose:'hero'},{durationFrames:30,transition:'zoom',cameraMove:'push',purpose:'hero'}],typographyStyles:['center','center','center'],soundEvents:[],brandSpecificChoices:0});assert.ok(result.report.score<60);assert.ok(result.repairPlan.length>0)});

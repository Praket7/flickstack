import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioState, studioReducer } from './view-model.ts';

test('studio state exposes branch coverage receipts locks and QC lanes',()=>{
 let s=createStudioState();
 s=studioReducer(s,{type:'branch',name:'minimal'});
 s=studioReducer(s,{type:'select_evidence',assetId:'macro'});
 s=studioReducer(s,{type:'lock',id:'founder-line',label:'Keep founder quote intact'});
 s=studioReducer(s,{type:'receipt',receipt:{id:'cp_1',intent:'speed up hook',ops:4}});
 assert.equal(s.branch,'minimal'); assert.equal(s.selectedAssetId,'macro');
 assert.equal(s.locks[0].label,'Keep founder quote intact'); assert.equal(s.receipts[0].ops,4); assert.equal(s.coverageDebt,0);
});

test('professional workspaces preserve selection and expose graph snapping and QC navigation state',()=>{
 let s=createStudioState();
 s=studioReducer(s,{type:'workspace',workspace:'motion'});
 s=studioReducer(s,{type:'select_project_item',id:'title'});
 s=studioReducer(s,{type:'workspace',workspace:'graph'});
 s=studioReducer(s,{type:'graph_mode',mode:'curve'});
 s=studioReducer(s,{type:'snapping',beat:true,keyframe:true});
 s=studioReducer(s,{type:'qc_focus',issueId:'dq_001'});
 assert.equal(s.workspace,'graph');assert.equal(s.selectedProjectItemId,'title');assert.equal(s.graphMode,'curve');
 assert.deepEqual(s.snapping,{beat:true,keyframe:true});assert.equal(s.focusedQcIssueId,'dq_001');
});

test('revision conflicts are visible and clearable instead of overwriting project state',()=>{
 let s=createStudioState();
 s=studioReducer(s,{type:'revision_conflict',expectedRevision:'old',currentRevision:'new'});
 assert.equal(s.revisionConflict?.currentRevision,'new');
 s=studioReducer(s,{type:'clear_revision_conflict'});assert.equal(s.revisionConflict,undefined);
});

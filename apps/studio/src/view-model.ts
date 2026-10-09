export interface StudioReceipt {id:string;intent:string;ops:number}
export interface SemanticLock {id:string;label:string}
export type StudioWorkspace='edit'|'motion'|'graph'|'audio'|'director';
export type StudioGraphMode='timeline'|'curve'|'nodes'|'audio';
export interface StudioRevisionConflict {expectedRevision:string;currentRevision:string}
export interface StudioState {branch:string;selectedAssetId?:string;selectedProjectItemId?:string;selectedProjectItemIds:string[];playhead:number;timelineZoom:number;coverageDebt:number;locks:SemanticLock[];receipts:StudioReceipt[];activePanel:'agent'|'coverage'|'qc'|'receipts';workspace:StudioWorkspace;graphMode:StudioGraphMode;snapping:{beat:boolean;keyframe:boolean};focusedQcIssueId?:string;revisionConflict?:StudioRevisionConflict}
export type StudioAction=
 |{type:'branch';name:string}|{type:'select_evidence';assetId:string}|{type:'lock';id:string;label:string}|{type:'unlock';id:string}|{type:'receipt';receipt:StudioReceipt}|{type:'panel';panel:StudioState['activePanel']}|{type:'coverage_debt';count:number}
 |{type:'workspace';workspace:StudioWorkspace}|{type:'select_project_item';id?:string}|{type:'select_project_items';ids:string[]}|{type:'playhead';frame:number}|{type:'timeline_zoom';zoom:number}|{type:'graph_mode';mode:StudioGraphMode}|{type:'snapping';beat:boolean;keyframe:boolean}|{type:'qc_focus';issueId?:string}|{type:'revision_conflict';expectedRevision:string;currentRevision:string}|{type:'clear_revision_conflict'};
export function createStudioState():StudioState{return{branch:'energetic',selectedProjectItemIds:[],playhead:0,timelineZoom:1,coverageDebt:0,locks:[],receipts:[],activePanel:'agent',workspace:'edit',graphMode:'timeline',snapping:{beat:true,keyframe:true}};}
export function studioReducer(state:StudioState,action:StudioAction):StudioState{
 switch(action.type){
  case 'branch':return{...state,branch:action.name};
  case 'select_evidence':return{...state,selectedAssetId:action.assetId};
  case 'lock':return{...state,locks:[...state.locks.filter(l=>l.id!==action.id),{id:action.id,label:action.label}]};
  case 'unlock':return{...state,locks:state.locks.filter(l=>l.id!==action.id)};
  case 'receipt':return{...state,receipts:[...state.receipts,action.receipt]};
  case 'panel':return{...state,activePanel:action.panel};
  case 'coverage_debt':return{...state,coverageDebt:Math.max(0,Math.floor(action.count))};
  case 'workspace':return{...state,workspace:action.workspace};
  case 'select_project_item':return{...state,selectedProjectItemId:action.id,selectedProjectItemIds:action.id?[action.id]:[]};
  case 'select_project_items':return{...state,selectedProjectItemIds:[...new Set(action.ids)],selectedProjectItemId:action.ids.at(-1)};
  case 'playhead':return{...state,playhead:Math.max(0,Math.round(action.frame))};
  case 'timeline_zoom':return{...state,timelineZoom:Math.min(8,Math.max(.125,action.zoom))};
  case 'graph_mode':return{...state,graphMode:action.mode};
  case 'snapping':return{...state,snapping:{beat:action.beat,keyframe:action.keyframe}};
  case 'qc_focus':return{...state,focusedQcIssueId:action.issueId};
  case 'revision_conflict':return{...state,revisionConflict:{expectedRevision:action.expectedRevision,currentRevision:action.currentRevision}};
  case 'clear_revision_conflict':return{...state,revisionConflict:undefined};
 }
}

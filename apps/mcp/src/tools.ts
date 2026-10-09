export interface McpTool {name:string;description:string;inputSchema:Record<string,unknown>}
const object=(properties:Record<string,unknown>,required:string[]=[]):Record<string,unknown>=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string'}; const integer={type:'integer',minimum:0}; const branch={type:'string'}; const intent={type:'string'};
export const toolCatalog:McpTool[]=[
 {name:'create_project',description:'Create a canonical FlickSmith project with typed tracks and format settings.',inputSchema:object({name:str,width:integer,height:integer},['name'])},
 {name:'import_asset',description:'Import and probe a local media asset inside permitted roots.',inputSchema:object({path:str,branch},['path'])},
 {name:'inspect_asset',description:'Return deterministic ffprobe metadata for an imported asset.',inputSchema:object({assetId:str,branch},['assetId'])},
 {name:'analyze_asset',description:'Analyze local scenes and optional whisper.cpp transcript evidence for an asset.',inputSchema:object({assetId:str,sceneThreshold:{type:'number',exclusiveMinimum:0,exclusiveMaximum:1},branch},['assetId'])},
 {name:'search_assets',description:'Search persisted local speech and visual evidence with time-ranged results.',inputSchema:object({query:str,limit:{type:'integer',minimum:1,maximum:100},branch},['query'])},
 {name:'get_timeline',description:'Return the canonical project timeline and current branch state.',inputSchema:object({})},
 {name:'add_clip',description:'Add a clip with validated integer frame timing and return a checkpoint diff.',inputSchema:object({trackId:str,assetId:str,start:integer,duration:integer,sourceIn:integer,clipId:str,branch,intent},['trackId','assetId','start','duration'])},
 {name:'split_clip',description:'Split one clip at an integer frame and preserve source continuity.',inputSchema:object({trackId:str,clipId:str,at:integer,rightClipId:str,branch,intent},['trackId','clipId','at'])},
 {name:'trim_clip',description:'Trim a clip non-destructively and return a structured edit receipt.',inputSchema:object({trackId:str,clipId:str,start:integer,duration:integer,sourceIn:integer,branch,intent},['trackId','clipId','start','duration','sourceIn'])},
 {name:'move_clip',description:'Move a clip while validating track overlap and user locks.',inputSchema:object({trackId:str,clipId:str,start:integer,branch,intent},['trackId','clipId','start'])},
 {name:'ripple_delete',description:'Delete a clip and close its downstream gap deterministically.',inputSchema:object({trackId:str,clipId:str,branch,intent},['trackId','clipId'])},
 {name:'set_speed',description:'Set playback speed on a clip while preserving timeline source data.',inputSchema:object({trackId:str,clipId:str,speed:{type:'number',exclusiveMinimum:0},branch,intent},['trackId','clipId','speed'])},
 {name:'set_volume',description:'Set clip volume through a typed edit operation.',inputSchema:object({trackId:str,clipId:str,volume:{type:'number'},branch,intent},['trackId','clipId','volume'])},
 {name:'add_motion_graphic',description:'Add a renderer-neutral FlickSmith motion component to the motion track.',inputSchema:object({trackId:str,component:str,start:integer,duration:integer,clipId:str,props:{type:'object'},branch,intent},['trackId','component','start','duration'])},
 {name:'checkpoint',description:'Create a named reversible project checkpoint before exploratory edits.',inputSchema:object({label:str})},
 {name:'branch_project',description:'Create an isolated Video Git branch sharing original media.',inputSchema:object({name:str,from:str},['name'])},
 {name:'diff_branches',description:'Compare branches including semantic edit receipts and changed clips.',inputSchema:object({from:str,to:str},['from','to'])},
 {name:'undo',description:'Undo the latest reversible edit on a Video Git branch and persist the restored head.',inputSchema:object({branch})},
 {name:'restore_checkpoint',description:'Restore a branch to an exact persisted checkpoint and truncate later branch history.',inputSchema:object({checkpointId:str,branch},['checkpointId'])},
 {name:'render_proxy',description:'Render a fast local preview from canonical timeline data.',inputSchema:object({output:str,branch},['output'])},
 {name:'render_final',description:'Render a deterministic final MP4 with FFmpeg from canonical timeline data.',inputSchema:object({output:str,branch},['output'])},
 {name:'review_render',description:'Run deterministic render QC and produce localized repair-lane issues.',inputSchema:object({path:str,branch},['path'])},
 {name:'repair_segment',description:'Create a localized repair plan for one QC issue without rebuilding the project.',inputSchema:object({issueId:str},['issueId'])},
];


const anyObject={type:'object',additionalProperties:true};
const anyArray={type:'array'};
const revision={type:'string',minLength:1};
export const v2ToolCatalog:McpTool[]=[
 {name:'get_timeline',description:'Return the canonical v2 project and content revision for conflict-safe edits.',inputSchema:object({})},
 {name:'set_transform',description:'Set a v2 clip transform through the canonical checkpointed mutation engine.',inputSchema:object({expectedRevision:revision,compositionId:str,clipId:str,transform:anyObject,intent},['expectedRevision','compositionId','clipId','transform'])},
 {name:'set_opacity',description:'Set v2 clip opacity with revision conflict protection and an intent receipt.',inputSchema:object({expectedRevision:revision,compositionId:str,clipId:str,opacity:{type:'number',minimum:0,maximum:1},intent},['expectedRevision','compositionId','clipId','opacity'])},
 {name:'add_effect',description:'Add a typed effect to a v2 clip and return a reversible checkpoint receipt.',inputSchema:object({expectedRevision:revision,compositionId:str,clipId:str,effect:anyObject,intent},['expectedRevision','compositionId','clipId','effect'])},
 {name:'reorder_effects',description:'Reorder every effect in a v2 clip deterministically.',inputSchema:object({expectedRevision:revision,compositionId:str,clipId:str,effectIds:{type:'array',items:str},intent},['expectedRevision','compositionId','clipId','effectIds'])},
 {name:'set_keyframes',description:'Set parameter keyframes on a v2 effect using integer project frames.',inputSchema:object({expectedRevision:revision,compositionId:str,clipId:str,effectId:str,param:str,keyframes:anyArray,intent},['expectedRevision','compositionId','clipId','effectId','param','keyframes'])},
 {name:'set_audio_bus_gain',description:'Set professional v2 audio bus gain through the shared mutation engine.',inputSchema:object({expectedRevision:revision,busId:str,gainDb:{type:'number'},intent},['expectedRevision','busId','gainDb'])},
 {name:'set_audio_bus_effects',description:'Replace a v2 audio bus effect chain with typed processors.',inputSchema:object({expectedRevision:revision,busId:str,effects:anyArray,intent},['expectedRevision','busId','effects'])},
 {name:'switch_multicam_angle',description:'Switch a multicam program range to another angle reversibly.',inputSchema:object({expectedRevision:revision,groupId:str,start:integer,end:integer,angleId:str,intent},['expectedRevision','groupId','start','end','angleId'])},
 {name:'materialize_multicam',description:'Materialize the current multicam program into ordinary renderable timeline clips.',inputSchema:object({expectedRevision:revision,groupId:str,compositionId:str,trackId:str,intent},['expectedRevision','groupId','compositionId','trackId'])},
 {name:'render_final_v2',description:'Render the canonical v2 project deterministically through the FFmpeg reference backend.',inputSchema:object({output:str},['output'])},
 {name:'get_preview_capabilities',description:'Return explicit interactive preview backend availability and fallback state.',inputSchema:object({})},
 {name:'get_render_diagnostics',description:'Compile the render graph and report unsupported or approximate renderer capabilities before rendering.',inputSchema:object({})},
];

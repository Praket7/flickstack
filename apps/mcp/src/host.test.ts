import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FlickProject } from '../../../packages/schema/src/project.ts';
import { FlickSmithHost } from './host.ts';

const project=():FlickProject=>({version:1,id:'demo',name:'Demo',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'asset',path:'/tmp/source.mp4',kind:'video',duration:300}],tracks:[{id:'v1',kind:'video',name:'V1',clips:[]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]});

test('MCP host applies typed edits, persists canonical state, and returns receipts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-host-')); const path=join(dir,'project.flick.json');
 const host=new FlickSmithHost({project:project(),projectPath:path,permittedRoots:['/tmp']});
 const result=await host.call('add_clip',{trackId:'v1',assetId:'asset',start:0,duration:90,sourceIn:10,intent:'Use the strongest opening'});
 assert.equal((result as any).checkpointId.startsWith('cp_'),true);
 assert.equal((result as any).receipt.intent,'Use the strongest opening');
 const saved=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(saved.tracks[0].clips[0].duration,90);
 const timeline=await host.call('get_timeline',{});
 assert.equal((timeline as any).project.tracks[0].clips.length,1);
});

test('MCP host creates isolated branches and returns semantic branch diffs',async()=>{
 const host=new FlickSmithHost({project:project(),permittedRoots:['/tmp']});
 await host.call('branch_project',{name:'energetic',from:'main'});
 await host.call('add_clip',{trackId:'v1',assetId:'asset',start:0,duration:60,sourceIn:0,intent:'Faster hook',branch:'energetic'});
 const diff=await host.call('diff_branches',{from:'main',to:'energetic'});
 assert.deepEqual((diff as any).changedClipIds,[(diff as any).changedClipIds[0]]);
 assert.equal((diff as any).receipts[0].intent,'Faster hook');
 assert.equal((await host.call('get_timeline',{branch:'main'}) as any).project.tracks[0].clips.length,0);
});

test('MCP host rejects unknown tools instead of exposing arbitrary execution',async()=>{
 const host=new FlickSmithHost({project:project(),permittedRoots:['/tmp']});
 await assert.rejects(()=>host.call('exec',{command:'rm -rf /'}),/Unknown FlickSmith tool/);
});

test('MCP analyze_asset runs local scene analysis and indexes searchable evidence',async()=>{
 const { spawnSync } = await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-host-analysis-')); const media=join(dir,'product-demo.mp4');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=magenta:s=320x240:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p',media],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const p=project(); p.assets=[{id:'product',path:media,kind:'video',duration:30}];
 const host=new FlickSmithHost({project:p,permittedRoots:[dir]});
 const analysis=await host.call('analyze_asset',{assetId:'product'}) as any;
 assert.ok(Array.isArray(analysis.scenes)); assert.equal(analysis.scenes[0].startFrame,0);
 const search=await host.call('search_assets',{query:'product demo'}) as any[];
 assert.equal(search[0].assetId,'product');
});

test('project-backed MCP host persists semantic evidence across restarts',async()=>{
 const { spawnSync }=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-host-persist-')); const media=join(dir,'dashboard-demo.mp4'); const projectPath=join(dir,'project.flick.json');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=green:s=160x120:r=30:d=0.5','-c:v','libx264','-pix_fmt','yuv420p',media],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const p=project(); p.assets=[{id:'dashboard',path:media,kind:'video',duration:15}];
 const first=new FlickSmithHost({project:p,projectPath,permittedRoots:[dir]}); await first.call('analyze_asset',{assetId:'dashboard'}); first.close();
 const second=new FlickSmithHost({project:p,projectPath,permittedRoots:[dir]}); const results=await second.call('search_assets',{query:'dashboard demo'}) as any[]; second.close();
 assert.equal(results[0].assetId,'dashboard');
});

test('project-backed MCP host restores Video Git branches and receipts after restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-host-git-')); const projectPath=join(dir,'project.flick.json');
 const first=new FlickSmithHost({project:project(),projectPath,permittedRoots:[dir,'/tmp']});
 await first.call('branch_project',{name:'cinematic',from:'main'});
 await first.call('add_clip',{trackId:'v1',assetId:'asset',start:0,duration:45,sourceIn:0,intent:'Add a slower cinematic opening',branch:'cinematic'});
 first.close();
 const second=new FlickSmithHost({project:project(),projectPath,permittedRoots:[dir,'/tmp']});
 const diff=await second.call('diff_branches',{from:'main',to:'cinematic'}) as any; second.close();
 assert.equal(diff.receipts[0].intent,'Add a slower cinematic opening');
 assert.ok(diff.changedClipIds.length>0);
});

test('MCP undo is a real reversible engine operation and persists branch head',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-host-undo-')); const projectPath=join(dir,'project.flick.json');
 const host=new FlickSmithHost({project:project(),projectPath,permittedRoots:[dir,'/tmp']});
 await host.call('branch_project',{name:'edit'});
 await host.call('add_clip',{trackId:'v1',assetId:'asset',start:0,duration:45,sourceIn:0,branch:'edit',intent:'add opening'});
 await host.call('move_clip',{trackId:'v1',clipId:(await host.call('get_timeline',{branch:'edit'}) as any).project.tracks[0].clips[0].id,start:30,branch:'edit',intent:'move opening'});
 const undone=await host.call('undo',{branch:'edit'}) as any;
 assert.equal(undone.project.tracks[0].clips[0].start,0);
 host.close();
 const reopened=new FlickSmithHost({project:project(),projectPath,permittedRoots:[dir,'/tmp']});
 assert.equal((await reopened.call('get_timeline',{branch:'edit'}) as any).project.tracks[0].clips[0].start,0); reopened.close();
});

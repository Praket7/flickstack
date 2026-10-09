import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProject } from '../../packages/schema/src/project.ts';
import { MediaSearchIndex } from '../../packages/search/src/search.ts';
import { planCoverage } from '../../packages/agent/src/coverage.ts';
import { VideoGitStore } from '../../packages/timeline/src/branches.ts';
import { applyOperation } from '../../packages/timeline/src/apply.ts';
import { motionComponents, SvgMotionRenderer } from '../../packages/motion/src/index.ts';
import { renderProject } from '../../packages/render-ffmpeg/src/render.ts';
import { reviewRender } from '../../packages/qc/src/qc.ts';

function ffmpeg(args:string[]):void{const r=spawnSync('ffmpeg',['-y','-loglevel','error',...args],{encoding:'utf8',timeout:120_000});if(r.status!==0)throw new Error(r.stderr);}
function ffprobe(path:string):any{const r=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return JSON.parse(r.stdout);}

test('canonical 15-second launch ad flows from evidence to branch, motion, render and QC',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-e2e-'));
 const colors=['red','yellow','cyan']; const paths=colors.map((c,i)=>join(dir,`clip-${i}.mp4`));
 paths.forEach((p,i)=>ffmpeg(['-f','lavfi','-i',`color=c=${colors[i]}:s=640x360:r=30:d=5`,'-f','lavfi','-i',`sine=frequency=${440+i*110}:sample_rate=48000:duration=5`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',p]));
 const project:FlickProject={version:1,id:'launch-ad',name:'Launch Ad',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:paths.map((path,i)=>({id:`a${i}`,path,kind:'video',duration:150})),tracks:[{id:'v1',kind:'video',name:'Story',clips:paths.map((_,i)=>({id:`c${i}`,assetId:`a${i}`,start:i*150,duration:150,sourceIn:0}))},{id:'m1',kind:'motion',name:'Motion',clips:[{id:'motion-title',start:30,duration:90,sourceIn:0,component:'kinetic-title',props:{title:'EDIT WITH INTENT'}}]},{id:'c1',kind:'caption',name:'Captions',clips:[{id:'cap',start:0,duration:90,sourceIn:0,text:'Local agent-native editing with reversible intent'}]}],markers:[],style:{captionMaxChars:64},provenance:[],checkpoints:[],branches:[]};
 const index=new MediaSearchIndex();
 index.add({assetId:'a0',start:0,end:150,transcript:'founder launches the new editor',visual:'founder human hook',tags:['hook','founder']});
 index.add({assetId:'a1',start:0,end:150,transcript:'the product renders locally',visual:'product detail interface',tags:['product','proof']});
 index.add({assetId:'a2',start:0,end:150,transcript:'try FlickSmith now',visual:'call to action screen',tags:['cta','screen']});
 const coverage=planCoverage({id:'brief',title:'Launch',beats:[{id:'hook',query:'strongest founder hook',role:'hook'},{id:'proof',query:'product proof detail',role:'proof'},{id:'cta',query:'call to action screen',role:'cta'}]},index);
 assert.equal(coverage.coverageDebt,0); assert.equal(coverage.coverageRatio,1);
 const git=new VideoGitStore(project); git.createBranch('energetic');
 const edited=applyOperation(git.get('energetic'),{type:'set_speed',trackId:'v1',clipId:'c0',speed:1.2,intent:'Make the opening feel faster without deleting the founder hook'}); git.update('energetic',edited.project,edited.receipt);
 assert.equal(git.diffBranches('main','energetic').receipts[0].intent?.startsWith('Make the opening'),true);
 const graph=motionComponents['kinetic-title']({title:'EDIT WITH INTENT'}); const svg=new SvgMotionRenderer().renderFrame(graph,15); assert.match(svg,/EDIT WITH INTENT/);
 const out=join(dir,'launch-ad.mp4'); renderProject(project,out);
 const probe=ffprobe(out); const duration=Number(probe.format.duration); assert.ok(Math.abs(duration-15)<0.15,`duration=${duration}`);
 assert.equal(probe.streams.some((s:any)=>s.codec_type==='video'),true);
 assert.equal(probe.streams.some((s:any)=>s.codec_type==='audio'),true,'final render must preserve audio');
 const qc=reviewRender(out,project); assert.equal(qc.blocking,false); assert.equal(qc.issues.filter(i=>i.type==='black_frames').length,0);
 index.close();
});

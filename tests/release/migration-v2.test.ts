import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FlickProject } from '../../packages/schema/src/project.ts';
import { migrateV1ToV2 } from '../../packages/schema/src/index.ts';
import { renderProject, renderProjectV2 } from '../../packages/render-ffmpeg/src/index.ts';
import { probeMedia } from '../../packages/media/src/ingest.ts';

function make(path:string){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=64x64:r=30:d=1','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}

test('v1→v2 migration preserves video timing and embedded audio without mutating v1',()=>{
 const d=mkdtempSync(join(tmpdir(),'fsmigrate-'));try{const src=join(d,'src.mp4'),a=join(d,'v1.mp4'),b=join(d,'v2.mp4');make(src);const p:FlickProject={version:1,id:'p',name:'P',format:{width:64,height:64,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[{id:'src',path:src,kind:'video'}],tracks:[{id:'v',kind:'video',name:'Video',clips:[{id:'c',assetId:'src',start:0,duration:30,sourceIn:0}]}],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};const before=JSON.stringify(p);renderProject(p,a);const v2=migrateV1ToV2(p);assert.equal(JSON.stringify(p),before);renderProjectV2(v2,b);const pa=probeMedia(a),pb=probeMedia(b);assert.ok(pa.audio,'v1 output has audio');assert.ok(pb.audio,'migrated v2 output must preserve embedded audio');assert.ok(Math.abs((pa.durationSeconds??0)-(pb.durationSeconds??0))<.05);}
 finally{rmSync(d,{recursive:true,force:true});}
});

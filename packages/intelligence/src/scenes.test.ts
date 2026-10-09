import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectScenes } from './scenes.ts';

test('FFmpeg scene detector finds a hard visual cut with frame timing',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flicksmith-scenes-')); const out=join(dir,'two-shots.mp4');
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=red:s=320x240:r=30:d=1','-f','lavfi','-i','color=cyan:s=320x240:r=30:d=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0','-c:v','libx264','-pix_fmt','yuv420p',out],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const scenes=detectScenes(out,{fps:{numerator:30,denominator:1},threshold:0.2});
 assert.equal(scenes[0].startFrame,0);
 assert.ok(scenes.some(s=>Math.abs(s.startFrame-30)<=2),JSON.stringify(scenes));
 assert.equal(scenes.at(-1)!.endFrame>=58,true);
});

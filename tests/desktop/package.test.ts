import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
interface Target {os:'macos'|'windows'|'linux';formats:string[];ffmpeg:string}
interface Manifest {version:string;ffmpegPolicy:string;targets:Target[]}
test('desktop package manifest covers required platforms and isolated web build creates Tauri frontendDist',()=>{
 const m=JSON.parse(readFileSync('apps/desktop/package-manifest.json','utf8')) as Manifest;assert.equal(m.ffmpegPolicy,'system-provided');const by=new Map<string,Target>(m.targets.map((x):[string,Target]=>[x.os,x]));assert.deepEqual(by.get('macos')?.formats,['app','dmg']);assert.ok(by.get('windows')?.formats.includes('msi'));assert.ok(by.get('linux')?.formats.includes('appimage'));
 const root=mkdtempSync(join(tmpdir(),'flick-desktop-package-')),web=join(root,'web-dist'),studio=join(root,'studio-dist'),runtime=join(root,'runtime');
 try{
  const r=spawnSync(process.execPath,['--experimental-strip-types','apps/desktop/build.ts'],{encoding:'utf8',env:{...process.env,FLICKSMITH_DESKTOP_WEB_DIST:web,FLICKSMITH_STUDIO_DIST:studio,FLICKSMITH_DESKTOP_RUNTIME:runtime}});assert.equal(r.status,0,r.stderr);assert.ok(existsSync(join(web,'index.html')));assert.ok(existsSync(join(web,'app.js')));
 }finally{rmSync(root,{recursive:true,force:true});}
});

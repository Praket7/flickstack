import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
interface Target {os:'macos'|'windows'|'linux';formats:string[];ffmpeg:string}
interface Manifest {version:string;ffmpegPolicy:string;targets:Target[]}
test('desktop package manifest covers required platforms and web build creates Tauri frontendDist',()=>{
  const m=JSON.parse(readFileSync('apps/desktop/package-manifest.json','utf8')) as Manifest;
  assert.equal(m.ffmpegPolicy,'system-provided');
  const by=new Map<string,Target>(m.targets.map((x):[string,Target]=>[x.os,x]));
  assert.deepEqual(by.get('macos')?.formats,['app','dmg']);
  assert.ok(by.get('windows')?.formats.includes('msi'));
  assert.ok(by.get('linux')?.formats.includes('appimage'));
  rmSync('apps/desktop/web-dist',{recursive:true,force:true});
  const r=spawnSync(process.execPath,['--experimental-strip-types','apps/desktop/build.ts'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const indexPath='apps/desktop/web-dist/index.html';
  assert.ok(existsSync(indexPath));
  const html=readFileSync(indexPath,'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]);
  assert.ok(scripts.length>0,'built index.html must reference an executable JavaScript bundle');
  for(const src of scripts){
    const clean=src.split(/[?#]/,1)[0].replace(/^\//,'');
    assert.ok(existsSync(resolve('apps/desktop/web-dist',clean)),`missing referenced JavaScript bundle: ${src}`);
  }
});

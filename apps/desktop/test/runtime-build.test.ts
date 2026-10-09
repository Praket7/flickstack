import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

function files(root:string):string[]{
  const out:string[]=[];
  const walk=(dir:string)=>{for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else out.push(p);}};
  walk(root);return out;
}

test('desktop runtime build copies canonical source but excludes tests from packaged runtime',()=>{
  const build=spawnSync(process.execPath,['--experimental-strip-types','apps/desktop/build.ts'],{cwd:process.cwd(),encoding:'utf8',timeout:120000});
  assert.equal(build.status,0,build.stderr);
  const runtime=join(process.cwd(),'apps/desktop/src-tauri/runtime');
  const listed=files(runtime).map(p=>relative(runtime,p).replaceAll('\\','/'));
  assert.equal(listed.some(p=>p.endsWith('.test.ts')||p.includes('/test/')||p.includes('/tests/')),false,`runtime contains tests: ${listed.filter(p=>p.endsWith('.test.ts')||p.includes('/test/')||p.includes('/tests/')).slice(0,10).join(', ')}`);
  const canonical=readFileSync(join(process.cwd(),'packages/audio-preview/src/index.ts'),'utf8');
  const copied=readFileSync(join(runtime,'packages/audio-preview/src/index.ts'),'utf8');
  assert.equal(copied,canonical,'runtime copy must match canonical audio-preview source');
});

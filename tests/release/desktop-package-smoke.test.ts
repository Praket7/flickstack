import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('desktop package smoke reports verified binary evidence or an explicit native-toolchain block',()=>{
 const dir=mkdtempSync(join(tmpdir(),'flick-desktop-smoke-'));
 try{
  const report=join(dir,'report.json');
  const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/smoke-desktop-package.ts',report],{encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);
  const data=JSON.parse(readFileSync(report,'utf8'));
  assert.ok(['verified','blocked'].includes(data.status));
  assert.equal(typeof data.platform,'string');
  if(data.status==='blocked') assert.match(data.reason,/cargo|rust|binary|tauri/i);
  else {assert.equal(data.smoke.paid_apis_required,false);assert.equal(typeof data.artifactPath,'string');}

  const main=readFileSync('apps/desktop/src-tauri/src/main.rs','utf8');
  assert.match(main,/--smoke/);
  const workflow=readFileSync('.github/workflows/desktop-build.yml','utf8');
  assert.match(workflow,/smoke-desktop-package\.ts/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

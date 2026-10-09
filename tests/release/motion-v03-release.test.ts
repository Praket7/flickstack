import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { professionalInterchangeCapabilities } from '../../packages/interchange/src/index.ts';
import { professionalMotionComponents } from '../../packages/motion-components/src/index.ts';

test('v0.3 release metadata and benchmark notes distinguish verified motion core from capability-gated runtimes',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8')),readme=readFileSync('README.md','utf8'),changelog=readFileSync('CHANGELOG.md','utf8'),benchmark=readFileSync('benchmarks/motion-v03/README.md','utf8'),report=JSON.parse(readFileSync('benchmarks/motion-v03/current.json','utf8'));
 const live=spawnSync(process.execPath,['--experimental-strip-types','benchmarks/motion-v03/run.ts'],{encoding:'utf8',timeout:15000});assert.equal(live.status,0,live.stderr);const liveReport=JSON.parse(live.stdout.trim().split(/\n/).at(-1)!);assert.equal(liveReport.kind,'motion-v03-foundation');assert.ok(liveReport.sceneGraphEvaluation.framesPerSecond>0);assert.equal(liveReport.webgpu.status,'blocked');
 assert.equal(report.kind,'motion-v03-foundation');assert.equal(report.webgpu.status,'blocked');assert.ok(report.sceneGraphEvaluation.framesPerSecond>0);
 assert.equal(pkg.version,'0.4.0');assert.match(readme,/Current v0\.4 professional motion engine/i);assert.match(changelog,/## \[0\.3\.0\]/);assert.match(benchmark,/WebGPU.*blocked|blocked.*WebGPU/is);assert.match(benchmark,/Cargo|Rust|native toolchain/i);
 const caps=professionalInterchangeCapabilities();assert.equal(caps.find(c=>c.id==='openfx')?.processing,'metadata-only');assert.equal(caps.find(c=>c.id==='ocio')?.processing,'metadata-only');assert.ok(Object.keys(professionalMotionComponents).length>=14);
 assert.match(readme,/native OpenFX.*disabled|OpenFX.*disabled/is);assert.match(readme,/OCIO\/ACES.*non-stub|non-stub.*OCIO\/ACES/is);
 const desktopPkg=JSON.parse(readFileSync('apps/desktop/package.json','utf8')),tauri=JSON.parse(readFileSync('apps/desktop/src-tauri/tauri.conf.json','utf8')),manifest=JSON.parse(readFileSync('apps/desktop/package-manifest.json','utf8'));
 assert.equal(desktopPkg.version,'0.4.0');assert.equal(tauri.version,'0.4.0');assert.equal(manifest.version,'0.4.0');
 assert.match(readFileSync('apps/desktop/src-tauri/Cargo.toml','utf8'),/^version = \"0\.4\.0\"/m);assert.match(readFileSync('crates/flick-preview/Cargo.toml','utf8'),/^version = \"0\.4\.0\"/m);assert.match(readFileSync('apps/mcp/src/server.ts','utf8'),/version:'0\.5\.0-dev'/);
});

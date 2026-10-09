import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { arch, platform, release } from 'node:os';
import { spawnSync } from 'node:child_process';

const reportPath=resolve(process.argv[2]??'benchmarks/v0.2/desktop-package-current.json');
const candidate=process.argv[3]?resolve(process.argv[3]):undefined;
let report:Record<string,unknown>;
const context={platform:platform(),release:release(),arch:arch(),recordedAt:new Date().toISOString()};
if(candidate&&existsSync(candidate)){
 const run=spawnSync(candidate,['--smoke'],{encoding:'utf8',timeout:15000});
 if(run.status!==0) report={status:'blocked',reason:`desktop binary smoke failed: ${run.stderr||`exit ${run.status}`}`,artifactPath:candidate,...context};
 else {
  try {report={status:'verified',artifactPath:candidate,smoke:JSON.parse(run.stdout.trim()),...context};}
  catch {report={status:'blocked',reason:'desktop binary smoke output was not valid JSON',artifactPath:candidate,...context};}
 }
}else{
 const cargo=spawnSync('cargo',['--version'],{encoding:'utf8'});
 const reason=cargo.error||cargo.status!==0?'Cargo/Rust toolchain unavailable on this runner':candidate?`desktop binary not found: ${candidate}`:'no built desktop binary supplied; native Tauri package not verified on this runner';
 report={status:'blocked',reason,...context};
}
mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(reportPath);console.log(JSON.stringify(report));

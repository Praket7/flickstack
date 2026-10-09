import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const manifest=JSON.parse(readFileSync('apps/desktop/package-manifest.json','utf8'));
function run(exe:string,args:string[]){const r=spawnSync(exe,args,{encoding:'utf8',timeout:10000});return{available:r.status===0,text:(r.stdout||r.stderr||'').trim()};}
const ff=run('ffmpeg',['-version']),tess=run('tesseract',['--version']),cargo=run('cargo',['--version']);
const ffConfig=ff.text.split(/\n/).find(x=>x.startsWith('configuration:'))??'';
const report={
 repositoryLicense:pkg.license??null,
 npmRuntimeDependencies:Object.keys(pkg.dependencies??{}).sort(),
 ffmpeg:{policy:manifest.ffmpegPolicy,bundled:false,available:ff.available,version:ff.text.split(/\n/)[0]??'',gplEnabled:/--enable-gpl(?:\s|$)/.test(ffConfig),configuration:ffConfig},
 tesseract:{bundled:false,available:tess.available,version:tess.text.split(/\n/)[0]??'',licenseNote:'External local runtime; review installed package and language-data licenses.'},
 rust:{available:cargo.available,version:cargo.text.split(/\n/)[0]??''},
 paidApisRequired:false,
};
console.log(JSON.stringify(report));

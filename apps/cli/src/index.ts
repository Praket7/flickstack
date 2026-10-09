import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseProject, serializeProject, type FlickProject } from '../../../packages/schema/src/project.ts';
import { probeMedia } from '../../../packages/media/src/ingest.ts';
import { renderProject } from '../../../packages/render-ffmpeg/src/render.ts';
import { reviewRender } from '../../../packages/qc/src/qc.ts';
import { detectScenes } from '../../../packages/intelligence/src/scenes.ts';
import { MediaSearchIndex } from '../../../packages/search/src/search.ts';

export interface CliIO { log(message:string):void }
function argValue(args:string[],flag:string, fallback?:string):string|undefined { const i=args.indexOf(flag); return i>=0?args[i+1]:fallback; }
function commandExists(name:string):boolean { const r=spawnSync(name,['-version'],{encoding:'utf8'}); return r.status===0; }
function load(path:string):FlickProject{return parseProject(JSON.parse(readFileSync(path,'utf8')));}
function save(path:string,project:FlickProject):void{writeFileSync(path,serializeProject(project));}
function evidenceDb(projectPath:string):string{const dir=join(dirname(resolve(projectPath)),'.flicksmith');mkdirSync(dir,{recursive:true});return join(dir,'evidence.sqlite');}

export function runCli(args:string[],io:CliIO={log:console.log}):number {
 const cmd=args[0];
 try {
  if(cmd==='doctor'){
   const ffmpeg=commandExists('ffmpeg'),ffprobe=commandExists('ffprobe');
   io.log(`ffmpeg: ${ffmpeg?'ok':'missing'}`); io.log(`ffprobe: ${ffprobe?'ok':'missing'}`); io.log('paid APIs: not required');
   return ffmpeg&&ffprobe?0:1;
  }
  if(cmd==='init'){
   const name=args[1]; if(!name) throw new Error('Usage: flicksmith init <name> [--dir PATH]');
   const root=resolve(argValue(args,'--dir','.')!); const dir=join(root,name); mkdirSync(dir,{recursive:true}); mkdirSync(join(dir,'.flicksmith','cache'),{recursive:true});
   const p:FlickProject={version:1,id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,format:{width:1080,height:1920,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[{id:'v1',kind:'video',name:'V1',clips:[]},{id:'a1',kind:'audio',name:'A1',clips:[]},{id:'m1',kind:'motion',name:'Motion',clips:[]},{id:'c1',kind:'caption',name:'Captions',clips:[]}],markers:[],style:{captionMaxChars:42},provenance:[],checkpoints:[],branches:[]};
   writeFileSync(join(dir,'project.flick.json'),serializeProject(p)); io.log(`created ${join(dir,'project.flick.json')}`); return 0;
  }
  if(cmd==='ingest') {
   const source=args[1]; if(!source) throw new Error('Usage: flicksmith ingest <media> [--project FILE]');
   const projectPath=argValue(args,'--project','project.flick.json')!; const project=load(projectPath); const path=resolve(source); const meta=probeMedia(path);
   const stem=basename(path,extname(path)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||`asset-${project.assets.length+1}`; let id=stem; let suffix=2; while(project.assets.some(a=>a.id===id))id=`${stem}-${suffix++}`;
   const duration=Math.max(1,Math.round((meta.durationSeconds??1)*(project.format.fps.numerator/project.format.fps.denominator)));
   project.assets.push({id,path,kind:meta.video?'video':'audio',duration,metadata:{durationSeconds:meta.durationSeconds,video:meta.video,audio:meta.audio}}); save(projectPath,project);
   const index=new MediaSearchIndex(evidenceDb(projectPath)); const descriptor=`${id} ${basename(path)} ${meta.video?'video visual':'audio'}`; const scenes=meta.video?detectScenes(path,{fps:project.format.fps}):[{startFrame:0,endFrame:duration}]; for(const scene of scenes)index.add({assetId:id,start:scene.startFrame,end:scene.endFrame,transcript:'',visual:descriptor,tags:[meta.video?'visual':'audio','imported','scene']}); index.close();
   io.log(JSON.stringify({assetId:id,scenes:scenes.length,path})); return 0;
  }
  if(cmd==='search') {
   const query=args[1]; if(!query) throw new Error('Usage: flicksmith search <query> [--project FILE]'); const projectPath=argValue(args,'--project','project.flick.json')!; load(projectPath); const index=new MediaSearchIndex(evidenceDb(projectPath)); const results=index.search(query,{limit:Number(argValue(args,'--limit','8'))||8}); index.close(); io.log(JSON.stringify(results)); return 0;
  }
  if(cmd==='style') {
   const action=args[1],file=args[2]; if(!action||!file) throw new Error('Usage: flicksmith style <save|apply> <file> [--project FILE]'); const projectPath=argValue(args,'--project','project.flick.json')!; const project=load(projectPath);
   if(action==='save'){writeFileSync(resolve(file),JSON.stringify(project.style,null,2)+'\n');io.log(`saved style ${resolve(file)}`);return 0;}
   if(action==='apply'){const style=JSON.parse(readFileSync(resolve(file),'utf8'));if(!style||typeof style!=='object'||Array.isArray(style))throw new Error('Style package must be a JSON object');project.style=style;save(projectPath,project);io.log(`applied style ${resolve(file)}`);return 0;}
   throw new Error('Usage: flicksmith style <save|apply> <file> [--project FILE]');
  }
  if(cmd==='probe') { const path=args[1]; if(!path) throw new Error('Usage: flicksmith probe <media>'); io.log(JSON.stringify(probeMedia(path),null,2)); return 0; }
  if(cmd==='render') { const projectPath=argValue(args,'--project','project.flick.json')!; const out=argValue(args,'--out','flicksmith-output.mp4')!; renderProject(load(projectPath),out); io.log(`rendered ${out}`); return 0; }
  if(cmd==='qc') { const projectPath=argValue(args,'--project','project.flick.json')!; const render=args[1]; if(!render) throw new Error('Usage: flicksmith qc <render> [--project FILE]'); io.log(JSON.stringify(reviewRender(render,load(projectPath)),null,2)); return 0; }
  if(cmd==='validate'){const path=argValue(args,'--project','project.flick.json')!; load(path); io.log(`${path}: valid`); return 0;}
  io.log('FlickSmith commands: init, doctor, ingest, search, style, probe, validate, render, qc'); return cmd?1:0;
 } catch(error){io.log(`error: ${error instanceof Error?error.message:String(error)}`); return 1;}
}

if(import.meta.url===`file://${process.argv[1]}`) process.exitCode=runCli(process.argv.slice(2));

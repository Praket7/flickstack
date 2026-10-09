import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Clip, FlickProject } from '../../../packages/schema/src/project.ts';
import { MediaSearchIndex } from '../../../packages/search/src/search.ts';
import { detectScenes } from '../../../packages/intelligence/src/scenes.ts';
import { WhisperCppAdapter } from '../../../packages/intelligence/src/transcribe.ts';
import { serializeProject } from '../../../packages/schema/src/project.ts';
import { applyOperation, type EditOperation } from '../../../packages/timeline/src/apply.ts';
import { VideoGitStore } from '../../../packages/timeline/src/branches.ts';
import { validatePermittedPath } from '../../../packages/timeline/src/path-policy.ts';
import { probeMedia } from '../../../packages/media/src/ingest.ts';
import { renderProject } from '../../../packages/render-ffmpeg/src/render.ts';
import { reviewRender, buildRepairPlan } from '../../../packages/qc/src/qc.ts';

export interface FlickSmithHostOptions {
  project: FlickProject;
  projectPath?: string;
  permittedRoots?: string[];
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${name} must be a non-empty string`);
  return value;
}
function integer(value: unknown, name: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}
function numberValue(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

export class FlickSmithHost {
  #git: VideoGitStore;
  #currentBranch = 'main';
  #projectPath?: string;
  #gitPath?: string;
  #roots: string[];
  #lastQc = new Map<string, ReturnType<typeof reviewRender>>();
  #search: MediaSearchIndex;

  constructor(options: FlickSmithHostOptions) {
    this.#projectPath = options.projectPath;
    this.#roots = (options.permittedRoots ?? [process.cwd()]).map(value => resolve(value));
    if (options.projectPath) {
      const dataDir=join(dirname(options.projectPath),'.flicksmith'); mkdirSync(dataDir,{recursive:true});
      this.#gitPath=join(dataDir,'video-git.json');
      this.#git=existsSync(this.#gitPath)?VideoGitStore.fromState(JSON.parse(readFileSync(this.#gitPath,'utf8'))):new VideoGitStore(options.project);
      this.#search=new MediaSearchIndex(join(dataDir,'evidence.sqlite'));
    } else { this.#git=new VideoGitStore(options.project); this.#search=new MediaSearchIndex(); }
  }

  #branch(args: Record<string, unknown>): string {
    return typeof args.branch === 'string' && args.branch ? args.branch : this.#currentBranch;
  }
  #persist(branch: string): void {
    if (this.#projectPath && branch === 'main') writeFileSync(this.#projectPath, serializeProject(this.#git.get('main')));
    this.#persistGit();
  }
  #persistGit(): void { if(this.#gitPath) writeFileSync(this.#gitPath,JSON.stringify(this.#git.exportState(),null,2)+'\n'); }
  #apply(branch: string, operation: EditOperation) {
    const result = applyOperation(this.#git.get(branch), operation);
    this.#git.update(branch, result.project, result.receipt);
    this.#persist(branch);
    return { checkpointId: result.checkpointId, diff: result.diff, warnings: result.warnings, receipt: result.receipt, project: result.project };
  }

  close(): void { this.#search.close(); }

  async call(name: string, rawArgs: unknown): Promise<unknown> {
    const args = (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {}) as Record<string, unknown>;
    const branch = this.#branch(args);
    switch (name) {
      case 'create_project': {
        const project:FlickProject={version:1,id:requiredString(args.name,'name').toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:requiredString(args.name,'name'),format:{width:integer(args.width,'width',1080)||1080,height:integer(args.height,'height',1920)||1920,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[{id:'v1',kind:'video',name:'V1',clips:[]},{id:'a1',kind:'audio',name:'A1',clips:[]},{id:'m1',kind:'motion',name:'Motion',clips:[]},{id:'c1',kind:'caption',name:'Captions',clips:[]}],markers:[],style:{captionMaxChars:42},provenance:[],checkpoints:[],branches:[]};
        this.#git=new VideoGitStore(project); this.#currentBranch='main'; this.#search.close(); if(this.#projectPath){const dataDir=join(dirname(this.#projectPath),'.flicksmith');mkdirSync(dataDir,{recursive:true});this.#search=new MediaSearchIndex(join(dataDir,'evidence.sqlite'));}else this.#search=new MediaSearchIndex(); this.#persist('main'); return {project};
      }
      case 'get_timeline': return { branch, project: this.#git.get(branch) };
      case 'branch_project': {
        const branchName = requiredString(args.name, 'name');
        this.#git.createBranch(branchName, typeof args.from === 'string' ? args.from : branch); this.#persistGit();
        return { branch: branchName, from: typeof args.from === 'string' ? args.from : branch };
      }
      case 'diff_branches': return this.#git.diffBranches(requiredString(args.from,'from'), requiredString(args.to,'to'));
      case 'undo': {
        const project=this.#git.undo(branch); this.#persist(branch); return {branch,project,checkpointId:project.checkpoints.at(-1)?.id??null};
      }
      case 'restore_checkpoint': {
        const checkpointId=requiredString(args.checkpointId,'checkpointId'); const project=this.#git.restoreCheckpoint(branch,checkpointId); this.#persist(branch); return {branch,checkpointId,project};
      }
      case 'add_clip': {
        const trackId=requiredString(args.trackId,'trackId'), assetId=requiredString(args.assetId,'assetId');
        const clip:Clip={id:typeof args.clipId==='string'?args.clipId:`clip_${Date.now().toString(36)}`,assetId,start:integer(args.start,'start'),duration:integer(args.duration,'duration'),sourceIn:integer(args.sourceIn,'sourceIn',0)};
        return this.#apply(branch,{type:'add_clip',trackId,clip,intent:typeof args.intent==='string'?args.intent:undefined});
      }
      case 'split_clip': return this.#apply(branch,{type:'split_clip',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),at:integer(args.at,'at'),rightClipId:typeof args.rightClipId==='string'?args.rightClipId:`clip_${Date.now().toString(36)}_r`,intent:typeof args.intent==='string'?args.intent:undefined});
      case 'trim_clip': return this.#apply(branch,{type:'trim_clip',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),start:integer(args.start,'start'),duration:integer(args.duration,'duration'),sourceIn:integer(args.sourceIn,'sourceIn'),intent:typeof args.intent==='string'?args.intent:undefined});
      case 'move_clip': return this.#apply(branch,{type:'move_clip',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),start:integer(args.start,'start'),intent:typeof args.intent==='string'?args.intent:undefined});
      case 'ripple_delete': return this.#apply(branch,{type:'ripple_delete',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),intent:typeof args.intent==='string'?args.intent:undefined});
      case 'set_speed': return this.#apply(branch,{type:'set_speed',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),speed:numberValue(args.speed,'speed'),intent:typeof args.intent==='string'?args.intent:undefined});
      case 'set_volume': return this.#apply(branch,{type:'set_volume',trackId:requiredString(args.trackId,'trackId'),clipId:requiredString(args.clipId,'clipId'),volume:numberValue(args.volume,'volume'),intent:typeof args.intent==='string'?args.intent:undefined});
      case 'add_motion_graphic': {
        const clip:Clip={id:typeof args.clipId==='string'?args.clipId:`motion_${Date.now().toString(36)}`,start:integer(args.start,'start'),duration:integer(args.duration,'duration'),sourceIn:0,component:requiredString(args.component,'component'),props:args.props && typeof args.props==='object'?args.props as Record<string,unknown>:undefined};
        return this.#apply(branch,{type:'add_motion_graphic',trackId:requiredString(args.trackId,'trackId'),clip,intent:typeof args.intent==='string'?args.intent:undefined});
      }
      case 'analyze_asset': {
        const project=this.#git.get(branch); const asset=project.assets.find(a=>a.id===requiredString(args.assetId,'assetId')); if(!asset) throw new Error(`Unknown asset: ${String(args.assetId)}`); const meta=probeMedia(asset.path);
        const duration=Math.max(1,Math.round((meta.durationSeconds??1)*(project.format.fps.numerator/project.format.fps.denominator)));
        const descriptor=[asset.id,asset.path.split('/').at(-1)??asset.id,meta.video?'video':'audio'].join(' ');
        const scenes=meta.video?detectScenes(asset.path,{fps:project.format.fps,threshold:typeof args.sceneThreshold==='number'?args.sceneThreshold:0.3}):[{startFrame:0,endFrame:duration}];
        for(const scene of scenes)this.#search.add({assetId:asset.id,start:scene.startFrame,end:scene.endFrame,transcript:'',visual:descriptor,tags:[meta.video?'visual':'audio','imported','scene']});
        let transcript:unknown=undefined;
        const whisperBin=process.env.FLICKSMITH_WHISPER_BIN, whisperModel=process.env.FLICKSMITH_WHISPER_MODEL;
        if(meta.audio&&whisperBin&&whisperModel){
          transcript=await new WhisperCppAdapter({binary:whisperBin,model:whisperModel}).transcribe(asset.path,{fps:project.format.fps});
          for(const segment of (transcript as any).segments)this.#search.add({assetId:asset.id,start:segment.startFrame,end:Math.max(segment.startFrame+1,segment.endFrame),transcript:segment.text,visual:'',tags:['speech','transcript']});
        }
        return {assetId:asset.id,metadata:meta,scenes,...(transcript?{transcript}:{}),evidence:scenes.map(scene=>({start:scene.startFrame,end:scene.endFrame,visual:descriptor,tags:[meta.video?'visual':'audio','imported','scene']})),note:transcript?'Local scene and whisper.cpp transcript analysis complete.':'Local scene analysis complete. Configure FLICKSMITH_WHISPER_BIN and FLICKSMITH_WHISPER_MODEL for local transcript evidence.'};
      }
      case 'search_assets': return this.#search.search(requiredString(args.query,'query'),{limit:typeof args.limit==='number'?args.limit:8});
      case 'inspect_asset': {
        const project=this.#git.get(branch); const asset=project.assets.find(a=>a.id===requiredString(args.assetId,'assetId')); if(!asset) throw new Error(`Unknown asset: ${String(args.assetId)}`); return probeMedia(asset.path);
      }
      case 'import_asset': {
        const source=requiredString(args.path,'path'); validatePermittedPath(source,this.#roots); const meta=probeMedia(source); const project=this.#git.get(branch); const id=typeof args.assetId==='string'?args.assetId:`asset_${project.assets.length+1}`;
        project.assets.push({id,path:source,kind:meta.video?'video':'audio',metadata:{durationSeconds:meta.durationSeconds,video:meta.video,audio:meta.audio}}); this.#git.update(branch,project); this.#persist(branch); return {assetId:id,metadata:meta};
      }
      case 'render_proxy':
      case 'render_final': {
        const output=requiredString(args.output,'output'); validatePermittedPath(output,this.#roots); return { output: renderProject(this.#git.get(branch),output), branch };
      }
      case 'review_render': {
        const path=requiredString(args.path,'path'); validatePermittedPath(path,this.#roots); const result=reviewRender(path,this.#git.get(branch)); this.#lastQc.set(path,result); return result;
      }
      case 'repair_segment': {
        const issueId=requiredString(args.issueId,'issueId');
        for(const result of this.#lastQc.values()){const issue=result.issues.find(i=>i.id===issueId); if(issue) return buildRepairPlan(issue,this.#git.get(branch));}
        throw new Error(`Unknown QC issue: ${issueId}`);
      }
      case 'checkpoint': {
        const project=this.#git.get(branch); const checkpointId=`cp_manual_${Date.now().toString(36)}`; project.checkpoints.push({id:checkpointId,createdAt:new Date().toISOString(),parentId:project.checkpoints.at(-1)?.id,label:typeof args.label==='string'?args.label:undefined,branch}); this.#git.update(branch,project); this.#persist(branch); return {branch,checkpointId,label:typeof args.label==='string'?args.label:undefined};
      }
      default: throw new Error(`Unknown FlickSmith tool: ${name}`);
    }
  }
}

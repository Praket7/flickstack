import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export interface RestrictedRunnerOptions { allowedExecutables:string[]; allowedRoots:string[] }
export interface RunOptions { cwd:string; timeoutMs:number; signal?:AbortSignal }
export interface RunResult { status:number|null; stdout:string; stderr:string; timedOut:boolean; cancelled:boolean }
function canonical(path:string):string { return realpathSync(path); }
function inside(root:string,path:string):boolean { const rel=relative(root,path); return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)); }
export class RestrictedProcessRunner {
  private readonly executables:Set<string>; private readonly roots:string[];
  constructor(options:RestrictedRunnerOptions){this.executables=new Set(options.allowedExecutables.map(canonical));this.roots=options.allowedRoots.map(canonical);}
  async run(executable:string,args:string[],options:RunOptions):Promise<RunResult>{
    const exe=canonical(executable); if(!this.executables.has(exe)) throw new Error(`Executable is not allowlisted: ${exe}`);
    const cwd=canonical(options.cwd); if(!this.roots.some(root=>inside(root,cwd))) throw new Error(`Working directory is outside allowed roots: ${cwd}`);
    if(!Number.isFinite(options.timeoutMs)||options.timeoutMs<=0) throw new Error('timeoutMs must be positive');
    return await new Promise<RunResult>((resolve,reject)=>{
      const child=spawn(exe,args,{cwd,stdio:['ignore','pipe','pipe'],shell:false});let stdout='',stderr='',timedOut=false,cancelled=false,settled=false;
      child.stdout?.setEncoding('utf8');child.stderr?.setEncoding('utf8');child.stdout?.on('data',d=>stdout+=d);child.stderr?.on('data',d=>stderr+=d);
      const kill=()=>{try{child.kill('SIGKILL');}catch{}};
      const timer=setTimeout(()=>{timedOut=true;kill();},options.timeoutMs);
      const onAbort=()=>{cancelled=true;kill();}; if(options.signal){if(options.signal.aborted)onAbort();else options.signal.addEventListener('abort',onAbort,{once:true});}
      child.once('error',e=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',onAbort);reject(e);});
      child.once('close',code=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',onAbort);resolve({status:code,stdout,stderr,timedOut,cancelled});});
    });
  }
}
function probe(exe:string){const r=spawnSync(exe,['-version'],{encoding:'utf8',timeout:5000});return{available:r.status===0,version:r.status===0?(r.stdout||r.stderr||'').split('\n')[0]:undefined};}
export async function probeFFmpegCapability(){return{ffmpeg:probe('ffmpeg'),ffprobe:probe('ffprobe')};}
export async function probeDesktopGpuCapability(){const nav=(globalThis as {navigator?:unknown}).navigator;return{webViewGpu:nav?'browser-runtime':'not-running-in-webview',nativeWgpuAvailable:false,detail:'Native wgpu capability is resolved by the Rust preview bridge at desktop runtime'};}

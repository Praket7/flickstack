import { spawnSync } from 'node:child_process';
import { probeMedia, type Rational } from '../../media/src/ingest.ts';

export interface Scene { startFrame:number; endFrame:number; confidence?:number }
export interface SceneOptions { fps:Rational; threshold?:number }

function fpsValue(fps:Rational):number{return fps.numerator/fps.denominator;}

export function detectScenes(path:string,options:SceneOptions):Scene[] {
 const threshold=options.threshold??0.3;
 if(!(threshold>0&&threshold<1))throw new Error('scene threshold must be between 0 and 1');
 const meta=probeMedia(path); const rate=fpsValue(options.fps);
 const totalFrames=Math.max(1,Math.round((meta.durationSeconds??0)*rate));
 const filter=`select='gt(scene,${threshold})',showinfo`;
 const r=spawnSync('ffmpeg',['-hide_banner','-i',path,'-vf',filter,'-an','-f','null','-'],{encoding:'utf8',timeout:120_000});
 if(r.error)throw new Error(`Scene detection failed: ${r.error.message}`);
 if(r.status!==0)throw new Error(`Scene detection failed: ${(r.stderr||'').slice(-3000)}`);
 const starts=[0]; const re=/pts_time:([0-9.]+)/g; let m:RegExpExecArray|null;
 while((m=re.exec(r.stderr||''))){const frame=Math.round(Number(m[1])*rate);if(frame>0&&frame<totalFrames&&Math.abs(frame-starts.at(-1)!)>1)starts.push(frame);}
 starts.sort((a,b)=>a-b);
 return starts.map((start,i)=>({startFrame:start,endFrame:i+1<starts.length?starts[i+1]:totalFrames}));
}

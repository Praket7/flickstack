import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { Rational } from '../../media/src/ingest.ts';

export interface TranscriptWord {text:string;startFrame:number;endFrame:number}
export interface TranscriptSegment {text:string;startFrame:number;endFrame:number}
export interface TranscriptResult {words:TranscriptWord[];segments:TranscriptSegment[];engine:'whisper.cpp'}
export interface RawWord {text:string;startMs:number;endMs:number}
export interface RawSegment {text:string;startMs:number;endMs:number;words?:RawWord[]}
export interface WhisperRunnerResult {segments:RawSegment[]}
export type WhisperRunner=(mediaPath:string)=>Promise<WhisperRunnerResult>;
export interface WhisperOptions {binary?:string;model?:string;runner?:WhisperRunner}

function frame(ms:number,fps:Rational):number{return Math.max(0,Math.round(ms*fps.numerator/(1000*fps.denominator)));}

function normalizeWhisperJson(raw:any):WhisperRunnerResult {
 const source=Array.isArray(raw?.transcription)?raw.transcription:Array.isArray(raw?.segments)?raw.segments:[];
 const segments:RawSegment[]=source.map((s:any)=>{
  const t0=Array.isArray(s?.timestamps?.from)?Number(s.timestamps.from[0]):Number(s.start??s.t0??0)*1000;
  const t1=Array.isArray(s?.timestamps?.to)?Number(s.timestamps.to[0]):Number(s.end??s.t1??0)*1000;
  const tokens=Array.isArray(s?.tokens)?s.tokens:[];
  const words:RawWord[]=tokens.filter((w:any)=>typeof w?.text==='string').map((w:any)=>({text:String(w.text).trim(),startMs:Number(w.offsets?.from??w.start??t0),endMs:Number(w.offsets?.to??w.end??t1)})).filter((w:RawWord)=>w.text);
  return{text:String(s.text??'').trim(),startMs:Number.isFinite(t0)?t0:0,endMs:Number.isFinite(t1)?t1:t0,...(words.length?{words}:{})};
 });
 return{segments};
}

function defaultRunner(binary:string|undefined,model:string|undefined):WhisperRunner {
 return async(mediaPath:string)=>{
  if(!binary||!model)throw new Error('whisper.cpp executable not configured; set binary and model explicitly');
  const dir=mkdtempSync(join(tmpdir(),'flicksmith-whisper-')); const prefix=join(dir,'transcript');
  try{
   const r=spawnSync(binary,['-m',model,'-f',mediaPath,'-oj','-of',prefix],{encoding:'utf8',timeout:900_000});
   if(r.error)throw new Error(`whisper.cpp failed: ${r.error.message}`); if(r.status!==0)throw new Error(`whisper.cpp failed: ${(r.stderr||'').slice(-3000)}`);
   return normalizeWhisperJson(JSON.parse(readFileSync(`${prefix}.json`,'utf8')));
  }finally{rmSync(dir,{recursive:true,force:true});}
 };
}

export class WhisperCppAdapter {
 #runner:WhisperRunner;
 constructor(options:WhisperOptions={}){this.#runner=options.runner??defaultRunner(options.binary,options.model);}
 async transcribe(mediaPath:string,options:{fps:Rational}):Promise<TranscriptResult>{
  const raw=await this.#runner(mediaPath); const segments:TranscriptSegment[]=[]; const words:TranscriptWord[]=[];
  for(const segment of raw.segments){const normalized={text:segment.text,startFrame:frame(segment.startMs,options.fps),endFrame:frame(segment.endMs,options.fps)};segments.push(normalized);for(const w of segment.words??[]){words.push({text:w.text,startFrame:frame(w.startMs,options.fps),endFrame:frame(w.endMs,options.fps)});}}
  return{segments,words,engine:'whisper.cpp'};
 }
}

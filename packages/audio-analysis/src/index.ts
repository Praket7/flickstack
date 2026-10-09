import { createHash } from 'node:crypto';
import type { AudioAnalysisRecord, MotionComponentDefinition } from '../../schema/src/v3/project.ts';

export type AudioSignal='beat'|'downbeat'|'energy'|'low'|'mid'|'high'|'speech';
export interface MaterializedSoundCue { cueId:string; frame:number; event:string; assetId?:string; resolved:boolean; gainDb:number }

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
export function analysisCacheKey(record:Pick<AudioAnalysisRecord,'assetId'|'sourceHash'|'algorithm'|'algorithmVersion'|'fps'>):string {
  return createHash('sha256').update(JSON.stringify([record.assetId,record.sourceHash,record.algorithm,record.algorithmVersion,record.fps])).digest('hex').slice(0,24);
}
function uniqueSorted(values:number[]):number[]{return [...new Set(values.filter(Number.isFinite).map(Math.round))].sort((a,b)=>a-b);}
function normalizeEnvelope(values:Array<{frame:number;value:number}>|undefined):Array<{frame:number;value:number}> {
  if(!values)return[];const map=new Map<number,number>();for(const p of values){if(!Number.isFinite(p.frame)||!Number.isFinite(p.value))continue;map.set(Math.max(0,Math.round(p.frame)),clamp01(p.value));}return [...map].map(([frame,value])=>({frame,value})).sort((a,b)=>a.frame-b.frame);
}
export function normalizeAudioAnalysis(input:AudioAnalysisRecord):AudioAnalysisRecord {
  if(!input.id||!input.assetId||!input.sourceHash||!input.algorithm||!input.algorithmVersion)throw new Error('invalid audio analysis identity');
  if(!(Number.isFinite(input.fps)&&input.fps>0))throw new Error('audio analysis fps must be positive');
  const envelopes=input.envelopes?{
    energy:normalizeEnvelope(input.envelopes.energy),low:normalizeEnvelope(input.envelopes.low),mid:normalizeEnvelope(input.envelopes.mid),high:normalizeEnvelope(input.envelopes.high),speech:normalizeEnvelope(input.envelopes.speech),
  }:undefined;
  return{...structuredClone(input),beats:uniqueSorted(input.beats),downbeats:uniqueSorted(input.downbeats),...(input.onsets?{onsets:[...input.onsets].filter(x=>Number.isFinite(x.frame)&&Number.isFinite(x.strength)).map(x=>({frame:Math.max(0,Math.round(x.frame)),strength:clamp01(x.strength)})).sort((a,b)=>a.frame-b.frame)}:{}),...(envelopes?{envelopes}:{})};
}
function impulse(frames:number[],frame:number):number {return frames.some(f=>Math.abs(f-frame)<=1)?1:0;}
function sampleEnvelope(values:Array<{frame:number;value:number}>,frame:number):number {
  if(!values.length)return 0;if(frame<=values[0].frame)return values[0].value;const last=values.at(-1)!;if(frame>=last.frame)return last.value;
  for(let i=1;i<values.length;i++)if(frame<=values[i].frame){const a=values[i-1],b=values[i],t=(frame-a.frame)/(b.frame-a.frame);return a.value+(b.value-a.value)*t;}return 0;
}
export function sampleAudioSignal(record:AudioAnalysisRecord,signal:AudioSignal,frame:number):number {
  const normalized=normalizeAudioAnalysis(record);
  if(signal==='beat')return impulse(normalized.beats,frame);
  if(signal==='downbeat')return impulse(normalized.downbeats,frame);
  return sampleEnvelope(normalized.envelopes?.[signal]??[],frame);
}
export function snapFrameToBeat(record:AudioAnalysisRecord,frame:number,kind:'beat'|'downbeat'='beat',maxDistance=6):number {
  const values=kind==='beat'?record.beats:record.downbeats;if(!values.length)return frame;let best=values[0],distance=Math.abs(frame-best);for(const v of values){const d=Math.abs(frame-v);if(d<distance){best=v;distance=d;}}return distance<=maxDistance?best:frame;
}
export function phraseAtFrame(record:AudioAnalysisRecord,frame:number){return record.phrases?.find(p=>frame>=p.start&&frame<p.end);}
export function isSilentAtFrame(record:AudioAnalysisRecord,frame:number):boolean{return Boolean(record.silence?.some(r=>frame>=r.start&&frame<r.end));}
export function materializeSoundCues(component:MotionComponentDefinition,eventAssets:Record<string,string>):MaterializedSoundCue[] {
  return (component.soundCues??[]).map(c=>{const assetId=c.assetId??eventAssets[c.event];return{cueId:c.id,frame:c.frame,event:c.event,...(assetId?{assetId}:{}),resolved:Boolean(assetId),gainDb:c.gainDb??0};});
}

export interface AudioAnalyzerInput { assetId:string; sourceHash:string; fps:number; samples:Float32Array; sampleRate:number; channels:number }
export interface AudioAnalyzerResult { beats:number[]; downbeats:number[]; onsets?:Array<{frame:number;strength:number}>; phrases?:Array<{start:number;end:number;label?:string}>; silence?:Array<{start:number;end:number}>; envelopes?:AudioAnalysisRecord['envelopes'] }
export interface LocalAudioAnalyzer { id:string; version:string; analyze(input:AudioAnalyzerInput):AudioAnalyzerResult }
export function buildAnalysisRecord(id:string,analyzer:LocalAudioAnalyzer,input:AudioAnalyzerInput):AudioAnalysisRecord {
  const out=analyzer.analyze(input);return normalizeAudioAnalysis({id,assetId:input.assetId,sourceHash:input.sourceHash,algorithm:analyzer.id,algorithmVersion:analyzer.version,fps:input.fps,beats:out.beats,downbeats:out.downbeats,...(out.onsets?{onsets:out.onsets}:{}),...(out.phrases?{phrases:out.phrases}:{}),...(out.silence?{silence:out.silence}:{}),...(out.envelopes?{envelopes:out.envelopes}:{})});
}

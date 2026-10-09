export interface VoiceRange { start:number; end:number }
export interface DuckOptions { totalFrames:number; normalGain:number; duckGain:number; attackFrames:number; releaseFrames:number }
export interface GainPoint { frame:number; gain:number }

export function buildDuckingEnvelope(ranges: VoiceRange[], options: DuckOptions): GainPoint[] {
  const gain = Array.from({length:options.totalFrames},()=>options.normalGain);
  for (const range of ranges) {
    const attackStart=Math.max(0,range.start-options.attackFrames);
    for(let f=attackStart;f<Math.min(options.totalFrames,range.start);f++) {
      const t=(f-attackStart)/Math.max(1,options.attackFrames); gain[f]=Math.min(gain[f],options.normalGain+(options.duckGain-options.normalGain)*t);
    }
    for(let f=Math.max(0,range.start);f<Math.min(options.totalFrames,range.end);f++) gain[f]=Math.min(gain[f],options.duckGain);
    for(let f=Math.max(0,range.end);f<Math.min(options.totalFrames,range.end+options.releaseFrames);f++) {
      const t=(f-range.end)/Math.max(1,options.releaseFrames); gain[f]=Math.min(gain[f],options.duckGain+(options.normalGain-options.duckGain)*t);
    }
  }
  const points:GainPoint[]=[];
  let last:number|undefined;
  for(let f=0;f<gain.length;f++) if(last===undefined||Math.abs(gain[f]-last)>1e-9||f===gain.length-1){points.push({frame:f,gain:gain[f]}); last=gain[f];}
  return points;
}

export function detectBeatsFromEnergy(values:number[], options:{threshold:number;minDistance:number}):number[] {
  const beats:number[]=[];
  for(let i=1;i<values.length-1;i++) {
    if(values[i]>=options.threshold&&values[i]>values[i-1]&&values[i]>=values[i+1]&&(beats.length===0||i-beats.at(-1)!>=options.minDistance)) beats.push(i);
  }
  return beats;
}

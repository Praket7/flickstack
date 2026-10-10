export interface VoiceRange { start:number; end:number }
export interface DuckOptions { totalFrames:number; normalGain:number; duckGain:number; attackFrames:number; releaseFrames:number }
export interface GainPoint { frame:number; gain:number }
export interface LoudnessTarget { integratedLufs:number; truePeakDbtp:number; maxGainDb?:number }
export interface LoudnessMeasurement { integratedLufs:number; truePeakDbtp:number }
export interface LoudnessPlan { gainDb:number; predictedIntegratedLufs:number; predictedTruePeakDbtp:number; limitedByTruePeak:boolean }

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

export function planLoudnessNormalization(measurement:LoudnessMeasurement,target:LoudnessTarget):LoudnessPlan {
  if(!Number.isFinite(measurement.integratedLufs)||!Number.isFinite(measurement.truePeakDbtp)) throw new Error('Invalid loudness measurement');
  if(!Number.isFinite(target.integratedLufs)||!Number.isFinite(target.truePeakDbtp)) throw new Error('Invalid loudness target');
  const desired=target.integratedLufs-measurement.integratedLufs;
  const maxGain=target.maxGainDb??12;
  const peakSafe=target.truePeakDbtp-measurement.truePeakDbtp;
  const gainDb=Math.max(-60,Math.min(desired,maxGain,peakSafe));
  return {
    gainDb,
    predictedIntegratedLufs:measurement.integratedLufs+gainDb,
    predictedTruePeakDbtp:measurement.truePeakDbtp+gainDb,
    limitedByTruePeak:peakSafe<Math.min(desired,maxGain),
  };
}

export function dbToLinear(db:number):number {
  if(!Number.isFinite(db)) throw new Error('dB value must be finite');
  return Math.pow(10,db/20);
}

export function applyGain(samples:readonly number[],gainDb:number):number[] {
  const gain=dbToLinear(gainDb);
  return samples.map((sample)=>Math.max(-1,Math.min(1,Number(sample)*gain)));
}

export function repairClicks(samples:readonly number[],options:{threshold?:number;radius?:number}={}):number[] {
  const threshold=options.threshold??0.65;
  const radius=Math.max(1,Math.floor(options.radius??1));
  const output=Array.from(samples,Number);
  for(let i=radius;i<samples.length-radius;i++) {
    const left=Number(samples[i-radius]);
    const right=Number(samples[i+radius]);
    const expected=(left+right)/2;
    if(Math.abs(Number(samples[i])-expected)>=threshold) output[i]=expected;
  }
  return output;
}

export function equalPowerCrossfade(outgoing:readonly number[],incoming:readonly number[],frames:number):{outgoing:number[];incoming:number[]} {
  const count=Math.max(0,Math.min(Math.floor(frames),outgoing.length,incoming.length));
  const out=Array.from(outgoing,Number);
  const input=Array.from(incoming,Number);
  for(let i=0;i<count;i++) {
    const t=count<=1?1:i/(count-1);
    out[out.length-count+i]!*=Math.cos(t*Math.PI/2);
    input[i]!*=Math.sin(t*Math.PI/2);
  }
  return {outgoing:out,incoming:input};
}

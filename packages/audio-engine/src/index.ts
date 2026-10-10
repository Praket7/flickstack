import type { AudioBus, AudioEffectInstance } from '../../schema/src/v2/project.ts';

function n(p:Record<string,unknown>,k:string,d:number,min=-Infinity,max=Infinity){const v=p[k]??d;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${k} out of range`);return v;}
export function validateAudioProcessor(e:AudioEffectInstance):void {
 if(!e.enabled)return; const p=e.params;
 switch(e.type){
  case 'eq': n(p,'frequency',1000,20,20000);n(p,'gainDb',0,-24,24);n(p,'q',1,.1,20);break;
  case 'compressor': n(p,'thresholdDb',-18,-80,0);n(p,'ratio',4,1,20);n(p,'attackMs',10,.1,2000);n(p,'releaseMs',120,1,10000);break;
  case 'limiter':n(p,'limitDb',-1,-20,0);break;
  case 'gate':n(p,'thresholdDb',-45,-100,0);break;
  case 'gain':n(p,'gainDb',0,-120,60);break;
  case 'pan':n(p,'pan',0,-1,1);break;
  case 'fade':n(p,'durationSeconds',.5,0,3600);break;
  case 'normalization':n(p,'targetLufs',-14,-70,-5);break;
  case 'ducking': if(typeof p.sidechainBusId!=='string'||!p.sidechainBusId)throw new Error('sidechainBusId required');n(p,'thresholdDb',-24,-80,0);n(p,'ratio',8,1,20);n(p,'attackMs',15,.1,2000);n(p,'releaseMs',250,1,10000);break;
  default:throw new Error(`Unknown audio processor ${e.type}`);
 }
}
function dbLinear(db:number){return Math.pow(10,db/20);}
export function compileAudioProcessor(e:AudioEffectInstance):string {
 validateAudioProcessor(e); if(!e.enabled)return 'anull'; const p=e.params;
 switch(e.type){
  case 'eq':return `equalizer=f=${n(p,'frequency',1000)}:width_type=q:w=${n(p,'q',1)}:g=${n(p,'gainDb',0)}`;
  case 'compressor':return `acompressor=threshold=${dbLinear(n(p,'thresholdDb',-18)).toFixed(6)}:ratio=${n(p,'ratio',4)}:attack=${n(p,'attackMs',10)}:release=${n(p,'releaseMs',120)}`;
  case 'limiter':return `alimiter=limit=${dbLinear(n(p,'limitDb',-1)).toFixed(6)}`;
  case 'gate':return `agate=threshold=${dbLinear(n(p,'thresholdDb',-45)).toFixed(8)}`;
  case 'gain':return `volume=${n(p,'gainDb',0)}dB`;
  case 'pan': {const x=n(p,'pan',0,-1,1);const l=(x<=0?1:1-x).toFixed(4),r=(x>=0?1:1+x).toFixed(4);return `pan=stereo|c0=${l}*c0|c1=${r}*c1`;}
  case 'fade':return `afade=t=in:st=0:d=${n(p,'durationSeconds',.5)}`;
  case 'normalization':return `loudnorm=I=${n(p,'targetLufs',-14)}:TP=-1.5:LRA=11`;
  case 'ducking':return `sidechaincompress=threshold=${dbLinear(n(p,'thresholdDb',-24)).toFixed(6)}:ratio=${n(p,'ratio',8)}:attack=${n(p,'attackMs',15)}:release=${n(p,'releaseMs',250)}`;
 }
 throw new Error(`Unknown audio processor ${e.type}`);
}
export function compileAudioBusChain(bus:AudioBus):string { const parts=bus.effects.filter(e=>e.enabled&&e.type!=='ducking').map(compileAudioProcessor); if(bus.gainDb!==0)parts.push(`volume=${bus.gainDb}dB`); if(bus.pan!==0)parts.push(compileAudioProcessor({id:'pan',type:'pan',enabled:true,params:{pan:bus.pan}})); return parts.join(',')||'anull'; }
export function dbToLinear(db:number):number{return dbLinear(db);}

export * from './automation.ts';

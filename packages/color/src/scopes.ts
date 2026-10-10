import type { ScopeAnalysis } from './types.ts';
const bins=()=>Array.from({length:256},()=>0);
export function analyzeScopes(frame:Uint8Array,width:number,height:number):ScopeAnalysis{
 if(width<=0||height<=0||frame.length<width*height*4)throw new Error('Invalid RGBA frame');const r=bins(),g=bins(),b=bins(),luma=bins();const waveform=Array.from({length:Math.min(width,256)},()=>bins());const vectorscope=Array.from({length:256},()=>bins());
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,R=frame[i],G=frame[i+1],B=frame[i+2];r[R]++;g[G]++;b[B]++;const Y=Math.max(0,Math.min(255,Math.round(.2126*R+.7152*G+.0722*B)));luma[Y]++;const wx=Math.min(waveform.length-1,Math.floor(x*waveform.length/width));waveform[wx][Y]++;const u=Math.max(0,Math.min(255,Math.round(128+(-.1146*R-.3854*G+.5*B))));const v=Math.max(0,Math.min(255,Math.round(128+(.5*R-.4542*G-.0458*B))));vectorscope[u][v]++}
 return{histogram:{r,g,b,luma},waveform,vectorscope};
}

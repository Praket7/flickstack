import test from 'node:test';import assert from 'node:assert/strict';
import { syncAudioOffset, buildDriftModel, mapProgramFrameToSourceFrame, switchProgramAngle } from '../src/index.ts';

function signal(n:number){let x=123456789;const a=[] as number[];for(let i=0;i<n;i++){x=(1103515245*x+12345)&0x7fffffff;a.push(((x/0x7fffffff)*2-1)*(i%97<6?1:.2));}return a;}
function resample(src:number[],from:number,to:number){const n=Math.floor(src.length*to/from),o=new Array<number>(n);for(let i=0;i<n;i++){const pos=i*from/to,j=Math.floor(pos),t=pos-j;o[i]=(src[j]??0)*(1-t)+(src[Math.min(src.length-1,j+1)]??0)*t;}return o;}

test('audio sync finds delayed camera within one project frame across sample rates',()=>{const sr=8000,base=signal(sr*2),delay=.2;const delayed=new Array(Math.round(delay*sr)).fill(0).concat(base);const b48=resample(delayed,sr,12000);const s=syncAudioOffset({reference:base,referenceRate:sr,candidate:b48,candidateRate:12000,projectFps:30,maxOffsetSeconds:1});assert.ok(Math.abs(s.offsetFrames-Math.round(delay*30))<=1,JSON.stringify(s));assert.ok(s.confidence>.5);});

test('piecewise drift correction stays frame accurate through hour-long recording',()=>{const m=buildDriftModel([{programFrame:0,sourceFrame:0},{programFrame:54000,sourceFrame:54005},{programFrame:108000,sourceFrame:108010}]);assert.equal(mapProgramFrameToSourceFrame(m,54000),54005);assert.ok(Math.abs(mapProgramFrameToSourceFrame(m,81000)-81008)<=1);});

test('multicam program switching is immutable and coalesces adjacent same-angle ranges',()=>{const before=[{start:0,end:100,angleId:'a'}];const after=switchProgramAngle(before,20,40,'b');assert.deepEqual(before,[{start:0,end:100,angleId:'a'}]);assert.deepEqual(after,[{start:0,end:20,angleId:'a'},{start:20,end:40,angleId:'b'},{start:40,end:100,angleId:'a'}]);assert.deepEqual(switchProgramAngle(after,40,60,'a'),[{start:0,end:20,angleId:'a'},{start:20,end:40,angleId:'b'},{start:40,end:100,angleId:'a'}]);});

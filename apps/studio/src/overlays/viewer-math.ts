import type {Vec3} from '../../../../packages/schema/src/v3/project.ts';
export type Mat4=readonly number[];
const rad=(d:number)=>d*Math.PI/180;
export function identity4():number[]{return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
export function multiply4(a:Mat4,b:Mat4):number[]{const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
const translationMatrix=(v:Vec3)=>[1,0,0,0,0,1,0,0,0,0,1,0,v[0],v[1],v[2],1];
const scaleMatrix=(v:Vec3)=>[v[0],0,0,0,0,v[1],0,0,0,0,v[2],0,0,0,0,1];
function rx(d:number){const c=Math.cos(rad(d)),s=Math.sin(rad(d));return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]}
function ry(d:number){const c=Math.cos(rad(d)),s=Math.sin(rad(d));return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]}
function rz(d:number){const c=Math.cos(rad(d)),s=Math.sin(rad(d));return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]}
export interface Transform3DInput{position:Vec3;anchor:Vec3;scale:Vec3;rotation:Vec3}
export function composeTransform3D(t:Transform3DInput):number[]{let m=translationMatrix(t.position);m=multiply4(m,rz(t.rotation[2]));m=multiply4(m,ry(t.rotation[1]));m=multiply4(m,rx(t.rotation[0]));m=multiply4(m,scaleMatrix(t.scale));m=multiply4(m,translationMatrix([-t.anchor[0],-t.anchor[1],-t.anchor[2]]));return m}
export function transformPoint(m:Mat4,p:Vec3):Vec3{const x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return Math.abs(w)>1e-12?[x/w,y/w,z/w]:[x,y,z]}
export function invert4(m:Mat4):number[]{const a=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?m[c*4+r]:(c-4===r?1:0)));for(let col=0;col<4;col++){let pivot=col;for(let r=col+1;r<4;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;if(Math.abs(a[pivot][col])<1e-12)throw new Error('matrix is singular');[a[col],a[pivot]]=[a[pivot],a[col]];const q=a[col][col];for(let c=0;c<8;c++)a[col][c]/=q;for(let r=0;r<4;r++)if(r!==col){const f=a[r][col];for(let c=0;c<8;c++)a[r][c]-=f*a[col][c]}}const out=new Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=a[r][c+4];return out}
export interface CameraProjection{width:number;height:number;focalLengthMm:number;sensorHeightMm?:number}
export interface ScreenPoint{x:number;y:number;depth:number}
export function worldToScreen(world:Vec3,view:Mat4,c:CameraProjection):ScreenPoint{const p=transformPoint(view,world),depth=-p[2];if(depth<=1e-9)throw new Error('point is behind camera');const fp=c.focalLengthMm*c.height/(c.sensorHeightMm??24);return{x:c.width/2+p[0]*fp/depth,y:c.height/2-p[1]*fp/depth,depth}}
export function screenToWorldAtCameraDepth(screen:{x:number;y:number},cameraZ:number,view:Mat4,c:CameraProjection):Vec3{const depth=-cameraZ;if(depth<=1e-9)throw new Error('camera depth must be negative in view space');const fp=c.focalLengthMm*c.height/(c.sensorHeightMm??24),camera:[number,number,number]=[(screen.x-c.width/2)*depth/fp,-(screen.y-c.height/2)*depth/fp,cameraZ];return transformPoint(invert4(view),camera)}
export function snapTransformDelta(delta:Vec3,o:{grid:number;enabled:boolean}):Vec3{if(!o.enabled||o.grid<=0)return[...delta];return delta.map(v=>Math.round(v/o.grid)*o.grid) as unknown as Vec3}
export class GestureTransaction<T>{private latest?:T;private done=false;private readonly transient:(value:T)=>void;private readonly commitFn:(value:T)=>void;constructor(transient:(value:T)=>void,commitFn:(value:T)=>void){this.transient=transient;this.commitFn=commitFn}update(value:T){if(this.done)return;this.latest=value;this.transient(value)}commit(){if(this.done||this.latest===undefined)return;this.done=true;this.commitFn(this.latest)}cancel(){this.done=true;this.latest=undefined}}

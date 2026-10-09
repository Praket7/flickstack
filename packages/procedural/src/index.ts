import type { FalloffDefinition, IndexContext, ParticleDefinition, ReplicatorDefinition, Vec2, Vec3 } from '../../schema/src/v3/project.ts';

export const MAX_PROCEDURAL_INSTANCES=10_000;
export const MAX_PARTICLES=50_000;

export interface ProceduralInstance {
  id:string;
  position:Vec3;
  rotation:Vec3;
  scale:Vec3;
  timeOffsetFrames:number;
  context:IndexContext;
}
export interface ParticleInstance {
  id:string;
  index:number;
  birthFrame:number;
  ageFrames:number;
  normalizedAge:number;
  position:Vec3;
  scale:number;
  rotation:number;
  color:string;
  context:IndexContext;
}

const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
const add3=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul3=(a:Vec3,n:number):Vec3=>[a[0]*n,a[1]*n,a[2]*n];
const offset=(value:Vec3|undefined,index:number,base:Vec3):Vec3=>value?add3(base,mul3(value,index)):base;
function hash32(value:number):number{let x=value|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return x>>>0;}
export function makeIndexContext(index:number,count:number,depth:number,seed:number):IndexContext{return {index,count,depth,normalized:count<=1?0:index/(count-1),seed:hash32(seed^Math.imul(index+1,0x9e3779b1))};}
export function seededRandom(context:IndexContext,salt=0):number{return hash32(context.seed^Math.imul(salt+1,0x85ebca6b))/0x1_0000_0000;}
export function indexSignal(context:IndexContext,min=0,max=1):number{return min+(max-min)*context.normalized;}

function samplePath(points:Vec2[],t:number,closed=false):Vec2{
  const path=closed&&points.length>1?[...points,points[0]]:points;
  const lengths:number[]=[];let total=0;
  for(let i=1;i<path.length;i++){const dx=path[i][0]-path[i-1][0],dy=path[i][1]-path[i-1][1];const len=Math.hypot(dx,dy);lengths.push(len);total+=len;}
  if(total===0)return path[0]??[0,0];let target=clamp01(t)*total;
  for(let i=0;i<lengths.length;i++){const len=lengths[i];if(target<=len||i===lengths.length-1){const q=len===0?0:target/len;return [path[i][0]+(path[i+1][0]-path[i][0])*q,path[i][1]+(path[i+1][1]-path[i][1])*q];}target-=len;}
  return path[path.length-1];
}
function distributionPosition(def:ReplicatorDefinition,index:number):Vec3{
  const d=def.distribution;
  if(d.kind==='grid'){
    const cols=Math.max(1,d.columns),rows=d.rows??Math.ceil(def.count/cols),col=index%cols,row=Math.floor(index/cols);
    return [(col-(cols-1)/2)*d.spacing[0],(row-(rows-1)/2)*d.spacing[1],0];
  }
  if(d.kind==='radial'){
    const span=d.endAngle-d.startAngle,full=Math.abs(span)>=359.999,denom=full?Math.max(1,def.count):Math.max(1,def.count-1);
    const a=(d.startAngle+span*index/denom)*Math.PI/180;const clean=(v:number)=>Math.abs(v)<1e-12?0:v;return [clean(Math.cos(a)*d.radius),clean(Math.sin(a)*d.radius),0];
  }
  const t=def.count<=1?0:index/(def.count-1),p=samplePath(d.points,t,Boolean(d.closed));return [p[0],p[1],0];
}
export function evaluateReplicator(def:ReplicatorDefinition):ProceduralInstance[]{
  if(!Number.isInteger(def.count)||def.count<1||def.count>MAX_PROCEDURAL_INSTANCES)throw new RangeError(`replicator instance budget exceeded: ${def.count}/${MAX_PROCEDURAL_INSTANCES}`);
  return Array.from({length:def.count},(_,index)=>{const context=makeIndexContext(index,def.count,0,def.seed);return {id:`${def.id}:${index}`,position:offset(def.positionOffset,index,distributionPosition(def,index)),rotation:offset(def.rotationOffset,index,[0,0,0]),scale:offset(def.scaleOffset,index,[1,1,1]),timeOffsetFrames:(def.timeOffsetFrames??0)*index,context};});
}

function graphValue(t:number,type:FalloffDefinition['graph'] extends infer G?G extends {type:infer T}?T:never:never):number{const x=clamp01(t);switch(type){case 'smoothstep':return x*x*(3-2*x);case 'ease-in':return x*x;case 'ease-out':return 1-(1-x)*(1-x);default:return x;}}
function rotatePoint(point:Vec2,center:Vec2,deg=0):Vec2{const r=-deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),x=point[0]-center[0],y=point[1]-center[1];return [x*c-y*s,y*c+x*s];}
function nearestPathDistance(point:Vec2,path:Vec2[]):number{let best=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2===0?0:clamp01(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l2),x=a[0]+dx*t,y=a[1]+dy*t;best=Math.min(best,Math.hypot(point[0]-x,point[1]-y));}return Number.isFinite(best)?best:Infinity;}
export function evaluateFalloff(def:FalloffDefinition,point:Vec2):number{
  const center=def.center??[0,0],size=def.size??[200,200],radius=Math.max(1e-9,def.radius??Math.max(size[0],size[1])/2);let base=0;
  if(def.kind==='circle')base=1-Math.hypot(point[0]-center[0],point[1]-center[1])/radius;
  else if(def.kind==='rect'){const p=rotatePoint(point,center,def.rotation),nx=Math.abs(p[0])/(Math.max(1e-9,size[0]/2)),ny=Math.abs(p[1])/(Math.max(1e-9,size[1]/2));base=1-Math.max(nx,ny);}
  else if(def.kind==='linear'){const p=rotatePoint(point,center,def.rotation);base=1-((p[0]+size[0]/2)/Math.max(1e-9,size[0]));}
  else if(def.kind==='sweep'){const dx=point[0]-center[0],dy=point[1]-center[1],angle=((Math.atan2(dy,dx)*180/Math.PI-(def.rotation??0))%360+360)%360;base=1-angle/360;}
  else {const dist=nearestPathDistance(point,def.path??[]);base=1-dist/radius;}
  let value=graphValue(clamp01(base),def.graph?.type??'linear');if(def.graph?.invert)value=1-value;return clamp01(value*(def.strength??1));
}
export function evaluateFalloffs(falloffs:FalloffDefinition[],point:Vec2,defaultCombine:'multiply'|'add'|'max'|'min'='multiply'):number{
  if(falloffs.length===0)return 1;let result=defaultCombine==='multiply'?1:defaultCombine==='min'?1:0;
  for(const f of falloffs){const v=evaluateFalloff(f,point),mode=f.combine??defaultCombine;if(mode==='multiply')result*=v;else if(mode==='add')result+=v;else if(mode==='max')result=Math.max(result,v);else result=Math.min(result,v);}return clamp01(result);
}

function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function lerpColor(a:string,b:string,t:number):string{const parse=(s:string)=>{const h=s.replace('#','');const v=h.length===3?h.split('').map(c=>c+c).join(''):h.padEnd(6,'0').slice(0,6);return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)] as const;};const A=parse(a),B=parse(b);return '#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('');}
export function evaluateParticles(def:ParticleDefinition,frame:number,fps:number):ParticleInstance[]{
  const max=def.maxParticles??MAX_PARTICLES;if(!Number.isInteger(max)||max<1||max>MAX_PARTICLES)throw new RangeError(`particle budget exceeded: ${max}/${MAX_PARTICLES}`);if(!(fps>0)||!(def.rate>=0)||!(def.lifetimeFrames>0))return [];
  const births=Math.floor((frame+1)*def.rate/fps),first=Math.max(0,births-max);const out:ParticleInstance[]=[];
  for(let index=first;index<births;index++){const birthFrame=Math.floor(index*fps/def.rate),age=frame-birthFrame;if(age<0||age>=def.lifetimeFrames)continue;const ctx=makeIndexContext(index,Math.max(1,births),1,def.seed),t=age/def.lifetimeFrames;const variance=def.velocityVariance??[0,0,0],vel:[number,number,number]=[def.velocity[0]+(seededRandom(ctx,1)*2-1)*variance[0],def.velocity[1]+(seededRandom(ctx,2)*2-1)*variance[1],def.velocity[2]+(seededRandom(ctx,3)*2-1)*variance[2]],g=def.gravity??[0,0,0],p=def.position??[0,0,0];out.push({id:`${def.id}:${index}`,index,birthFrame,ageFrames:age,normalizedAge:t,position:[p[0]+vel[0]*age+.5*g[0]*age*age,p[1]+vel[1]*age+.5*g[1]*age*age,p[2]+vel[2]*age+.5*g[2]*age*age],scale:lerp(def.scale?.[0]??1,def.scale?.[1]??1,t),rotation:lerp(def.rotation?.[0]??0,def.rotation?.[1]??0,t),color:lerpColor(def.color?.[0]??'#ffffff',def.color?.[1]??'#ffffff',t),context:ctx});}
  return out;
}

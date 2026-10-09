import type { Rect, ShapeGeometry, Vec2 } from '../../schema/src/v3/project.ts';

const dist=(a:Vec2,b:Vec2)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const lerpPoint=(a:Vec2,b:Vec2,t:number):Vec2=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];

function points(g:ShapeGeometry):Vec2[] {
  switch(g.kind){
    case 'rect':return [[0,0],[g.width,0],[g.width,g.height],[0,g.height]];
    case 'ellipse':return [[-g.rx,-g.ry],[g.rx,-g.ry],[g.rx,g.ry],[-g.rx,g.ry]];
    case 'polygon':return g.points;
    case 'star': {const out:Vec2[]=[];const n=Math.max(2,Math.floor(g.points));for(let i=0;i<n*2;i++){const a=(g.rotation??-Math.PI/2)+i*Math.PI/n,r=i%2?g.innerRadius:g.outerRadius;out.push([Math.cos(a)*r,Math.sin(a)*r]);}return out;}
    case 'line':return [g.from,g.to];
    case 'path':return g.points.map(p=>p.point);
  }
}
export function geometryBounds(g:ShapeGeometry):Rect {
  if(g.kind==='ellipse')return{x:-g.rx,y:-g.ry,width:g.rx*2,height:g.ry*2};
  const p=points(g);if(!p.length)return{x:0,y:0,width:0,height:0};const xs=p.map(x=>x[0]),ys=p.map(x=>x[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return{x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

export function trimPath(g:ShapeGeometry,start:number,end:number):{points:Vec2[]} {
  if(!(start>=0&&end<=1&&end>=start))throw new Error('trim range must satisfy 0 <= start <= end <= 1');
  const p=points(g);if(p.length<2)return{points:p};const lengths=p.slice(1).map((q,i)=>dist(p[i],q)),total=lengths.reduce((a,b)=>a+b,0);if(total===0)return{points:[p[0]]};
  const from=total*start,to=total*end,out:Vec2[]=[];let cursor=0;
  for(let i=0;i<lengths.length;i++){
    const len=lengths[i],segStart=cursor,segEnd=cursor+len;if(segEnd<from||segStart>to){cursor=segEnd;continue;}
    const a=Math.max(from,segStart),b=Math.min(to,segEnd);const ta=len? (a-segStart)/len:0,tb=len?(b-segStart)/len:0;const pa=lerpPoint(p[i],p[i+1],ta),pb=lerpPoint(p[i],p[i+1],tb);
    if(!out.length||dist(out.at(-1)!,pa)>1e-9)out.push(pa);if(dist(out.at(-1)!,pb)>1e-9)out.push(pb);cursor=segEnd;
  }
  return{points:out};
}
export function canMorph(a:ShapeGeometry,b:ShapeGeometry):boolean {
  if(a.kind!==b.kind)return false;
  if(a.kind==='polygon'&&b.kind==='polygon')return a.points.length===b.points.length;
  if(a.kind==='path'&&b.kind==='path')return a.points.length===b.points.length&&a.closed===b.closed;
  return ['rect','ellipse','line','star'].includes(a.kind);
}
export function morphGeometry(a:ShapeGeometry,b:ShapeGeometry,t:number):ShapeGeometry {
  if(!canMorph(a,b))throw new Error('incompatible vector topology');t=Math.max(0,Math.min(1,t));
  if(a.kind==='polygon'&&b.kind==='polygon')return{kind:'polygon',points:a.points.map((p,i)=>lerpPoint(p,b.points[i],t))};
  if(a.kind==='rect'&&b.kind==='rect')return{kind:'rect',width:lerp(a.width,b.width,t),height:lerp(a.height,b.height,t),radius:lerp(a.radius??0,b.radius??0,t)};
  if(a.kind==='ellipse'&&b.kind==='ellipse')return{kind:'ellipse',rx:lerp(a.rx,b.rx,t),ry:lerp(a.ry,b.ry,t)};
  if(a.kind==='line'&&b.kind==='line')return{kind:'line',from:lerpPoint(a.from,b.from,t),to:lerpPoint(a.to,b.to,t)};
  if(a.kind==='star'&&b.kind==='star'&&a.points===b.points)return{kind:'star',points:a.points,innerRadius:lerp(a.innerRadius,b.innerRadius,t),outerRadius:lerp(a.outerRadius,b.outerRadius,t),rotation:lerp(a.rotation??0,b.rotation??0,t)};
  if(a.kind==='path'&&b.kind==='path')return{kind:'path',closed:a.closed,points:a.points.map((p,i)=>({point:lerpPoint(p.point,b.points[i].point,t),...(p.in&&b.points[i].in?{in:lerpPoint(p.in,b.points[i].in!,t)}:{}),...(p.out&&b.points[i].out?{out:lerpPoint(p.out,b.points[i].out!,t)}:{})}))};
  throw new Error('incompatible vector topology');
}
function polygonContains(p:Vec2[],q:Vec2):boolean {let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];const intersect=((yi>q[1])!==(yj>q[1]))&&(q[0]<(xj-xi)*(q[1]-yi)/(yj-yi+Number.EPSILON)+xi);if(intersect)inside=!inside;}return inside;}
export function pointInGeometry(g:ShapeGeometry,p:Vec2):boolean {
  if(g.kind==='rect')return p[0]>=0&&p[1]>=0&&p[0]<=g.width&&p[1]<=g.height;
  if(g.kind==='ellipse')return (p[0]*p[0])/(g.rx*g.rx)+(p[1]*p[1])/(g.ry*g.ry)<=1;
  if(g.kind==='line')return false;
  return polygonContains(points(g),p);
}

export function pathLength(g:ShapeGeometry):number {
  const p=points(g);if(p.length<2)return 0;let total=0;for(let i=1;i<p.length;i++)total+=dist(p[i-1],p[i]);if((g.kind==='polygon'||g.kind==='star'||(g.kind==='path'&&g.closed))&&p.length>2)total+=dist(p[p.length-1],p[0]);return total;
}
export function sampleGeometryPath(g:ShapeGeometry,t:number):Vec2 {
  const p=points(g);if(!p.length)return[0,0];if(p.length===1)return p[0];t=Math.max(0,Math.min(1,t));const closed=g.kind==='polygon'||g.kind==='star'||(g.kind==='path'&&g.closed);const segs:Array<[Vec2,Vec2]>=[];for(let i=1;i<p.length;i++)segs.push([p[i-1],p[i]]);if(closed&&p.length>2)segs.push([p[p.length-1],p[0]]);const lengths=segs.map(([a,b])=>dist(a,b)),total=lengths.reduce((a,b)=>a+b,0);if(total===0)return p[0];let target=total*t,cursor=0;for(let i=0;i<segs.length;i++){const next=cursor+lengths[i];if(target<=next||i===segs.length-1){const local=lengths[i]?(target-cursor)/lengths[i]:0;return lerpPoint(segs[i][0],segs[i][1],Math.max(0,Math.min(1,local)));}cursor=next;}return p[p.length-1];
}

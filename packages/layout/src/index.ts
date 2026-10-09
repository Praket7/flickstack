import type { AspectClass, LayoutConstraint, Rect, Vec2 } from '../../schema/src/v3/project.ts';

export interface LayoutSurface { width:number; height:number; safeArea?:Rect }
export interface LayoutItem { id:string; intrinsic:{width:number;height:number}; constraints:LayoutConstraint[]; parentId?:string }
export interface LayoutResult { bounds:Record<string,Rect>; aspect:AspectClass; diagnostics:string[] }

const near=(a:number,b:number,t=.5)=>Math.abs(a-b)<=t;
const valueNumber=(c:LayoutConstraint,fallback=0)=>typeof c.value==='number'?c.value:fallback;
const constraint=(item:LayoutItem,type:LayoutConstraint['type'])=>item.constraints.find(c=>c.type===type);

export function classifyAspect(width:number,height:number):AspectClass {
  if(!(width>0&&height>0))throw new Error('surface dimensions must be positive');
  const r=width/height;
  if(Math.abs(r-1)<=.03)return 'square';
  if(Math.abs(r-.8)<=.035)return 'four-five';
  if(r>=1.2)return 'landscape';
  if(r<=.75)return 'portrait';
  return 'custom';
}
export function safeAreaForSurface(width:number,height:number,marginFraction=.05):Rect {
  if(!(marginFraction>=0&&marginFraction<.5))throw new Error('safe area margin must be 0..<0.5');
  const x=width*marginFraction,y=height*marginFraction;
  return {x,y,width:width-2*x,height:height-2*y};
}

function clampInside(b:Rect,s:Rect):Rect {
  const width=Math.min(b.width,s.width),height=Math.min(b.height,s.height);
  return {x:Math.max(s.x,Math.min(b.x,s.x+s.width-width)),y:Math.max(s.y,Math.min(b.y,s.y+s.height-height)),width,height};
}

export function solveLayout(surface:LayoutSurface,items:LayoutItem[]):LayoutResult {
  if(!(surface.width>0&&surface.height>0))throw new Error('layout surface must be positive');
  const byId=new Map(items.map(i=>[i.id,i]));
  if(byId.size!==items.length)throw new Error('duplicate layout item id');
  for(const i of items)if(i.parentId&&!byId.has(i.parentId))throw new Error(`unknown layout parent ${i.parentId}`);
  const visiting=new Set<string>(),done=new Set<string>(),order:LayoutItem[]=[];
  const visit=(id:string)=>{if(done.has(id))return;if(visiting.has(id))throw new Error(`layout parent cycle involving ${id}`);visiting.add(id);const i=byId.get(id)!;if(i.parentId)visit(i.parentId);visiting.delete(id);done.add(id);order.push(i);};
  for(const i of items)visit(i.id);

  const bounds:Record<string,Rect>={};const diagnostics:string[]=[];
  const root:Rect={x:0,y:0,width:surface.width,height:surface.height};
  const safe=surface.safeArea??safeAreaForSurface(surface.width,surface.height,.05);
  for(const item of order){
    const parent=item.parentId?bounds[item.parentId]:root;
    let width=item.intrinsic.width,height=item.intrinsic.height;
    const widthC=constraint(item,'width'),heightC=constraint(item,'height');
    if(widthC)width=valueNumber(widthC,width);if(heightC)height=valueNumber(heightC,height);
    const pct=constraint(item,'parent-percent');
    if(pct&&Array.isArray(pct.value)){const p=pct.value as Vec2;width=parent.width*p[0];height=parent.height*p[1];}
    const minW=constraint(item,'min-width'),maxW=constraint(item,'max-width'),minH=constraint(item,'min-height'),maxH=constraint(item,'max-height');
    if(minW)width=Math.max(width,valueNumber(minW));if(maxW)width=Math.min(width,valueNumber(maxW));
    if(minH)height=Math.max(height,valueNumber(minH));if(maxH)height=Math.min(height,valueNumber(maxH));
    const fit=constraint(item,'aspect-fit'),fill=constraint(item,'aspect-fill');
    const ratio=fit??fill;
    if(ratio&&typeof ratio.value==='number'&&ratio.value>0){
      const r=ratio.value;
      if(fit){if(width/height>r)width=height*r;else height=width/r;}
      else {if(width/height<r)width=height*r;else height=width/r;}
    }
    const l=constraint(item,'pin-left'),r=constraint(item,'pin-right'),t=constraint(item,'pin-top'),b=constraint(item,'pin-bottom');
    if(l&&r){const available=parent.width-valueNumber(l)-valueNumber(r);if(widthC&&!near(width,available))throw new Error(`unsatisfiable horizontal constraints for ${item.id}`);width=available;}
    if(t&&b){const available=parent.height-valueNumber(t)-valueNumber(b);if(heightC&&!near(height,available))throw new Error(`unsatisfiable vertical constraints for ${item.id}`);height=available;}
    if(!(Number.isFinite(width)&&Number.isFinite(height)&&width>=0&&height>=0))throw new Error(`invalid resolved size for ${item.id}`);
    let x=parent.x,y=parent.y;
    if(l)x=parent.x+valueNumber(l);else if(r)x=parent.x+parent.width-valueNumber(r)-width;else if(constraint(item,'center-x'))x=parent.x+(parent.width-width)/2;
    if(t)y=parent.y+valueNumber(t);else if(b)y=parent.y+parent.height-valueNumber(b)-height;else if(constraint(item,'center-y'))y=parent.y+(parent.height-height)/2;
    const align=constraint(item,'align')?.value;
    if(align==='center'){x=parent.x+(parent.width-width)/2;y=parent.y+(parent.height-height)/2;}
    if(align==='top-left'){x=parent.x;y=parent.y;} if(align==='bottom-right'){x=parent.x+parent.width-width;y=parent.y+parent.height-height;}
    let resolved={x,y,width,height};
    if(constraint(item,'safe-area'))resolved=clampInside(resolved,safe);
    bounds[item.id]=resolved;
  }
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=bounds[items[i].id],b=bounds[items[j].id];
    const overlaps=a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    if(overlaps&&!items[i].parentId&&!items[j].parentId)diagnostics.push(`collision:${items[i].id}:${items[j].id}`);
  }
  return {bounds,aspect:classifyAspect(surface.width,surface.height),diagnostics};
}

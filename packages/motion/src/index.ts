export type MotionNodeType = 'group'|'text'|'rect'|'circle'|'line';
export interface Keyframe { at: number; value: number }
export interface MotionNode {
  id: string; type: MotionNodeType; start: number; duration: number; parentId?: string;
  x?: number; y?: number; width?: number; height?: number; opacity?: number; rotation?: number;
  fill?: string; stroke?: string; text?: string; fontSize?: number; radius?: number;
  keyframes?: Partial<Record<'x'|'y'|'opacity'|'rotation'|'scale', Keyframe[]>>;
}
export interface MotionGraph { width: number; height: number; duration: number; nodes: MotionNode[]; background?: string }
export interface MotionRenderer { validate(graph: MotionGraph): void; renderFrame(graph: MotionGraph, frame: number): string; render?(graph: MotionGraph, output: string): Promise<string>|string }

const FORBIDDEN = [
  /\bimport\b/, /\brequire\s*\(/, /\beval\s*\(/, /\bfetch\s*\(/, /\bprocess\s*\./,
  /\bchild_process\b/, /\bnode:fs\b/, /\bnew\s+Function\b/, /\bWebSocket\b/, /\bXMLHttpRequest\b/
];
export function validateGeneratedMotionSource(source: string): void {
  for (const pattern of FORBIDDEN) if (pattern.test(source)) throw new Error(`Forbidden capability in generated motion source: ${pattern}`);
  if (source.length > 100_000) throw new Error('Generated motion source exceeds size limit');
}

export function validateMotionGraph(graph: MotionGraph): void {
  if (!Number.isInteger(graph.width) || graph.width <= 0 || !Number.isInteger(graph.height) || graph.height <= 0) throw new Error('Motion graph dimensions must be positive integers');
  if (!Number.isInteger(graph.duration) || graph.duration <= 0) throw new Error('Motion graph duration must be a positive integer');
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) throw new Error(`Duplicate motion node id ${n.id}`);
    ids.add(n.id);
    if (!Number.isInteger(n.start) || !Number.isInteger(n.duration) || n.start < 0 || n.duration <= 0 || n.start + n.duration > graph.duration) throw new Error(`Node ${n.id} duration exceeds graph duration or is invalid`);
  }
  const byId = new Map(graph.nodes.map(n=>[n.id,n]));
  for (const n of graph.nodes) {
    if (n.parentId && !byId.has(n.parentId)) throw new Error(`Unknown parent ${n.parentId} for ${n.id}`);
    const seen = new Set<string>();
    let cur: MotionNode|undefined = n;
    while (cur?.parentId) {
      if (seen.has(cur.parentId) || cur.parentId === n.id) throw new Error(`Motion graph cycle involving ${n.id}`);
      seen.add(cur.parentId);
      cur = byId.get(cur.parentId);
    }
  }
}

function esc(value: string): string { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function keyframed(node: MotionNode, prop: 'x'|'y'|'opacity'|'rotation'|'scale', frame: number, fallback: number): number {
  const frames = node.keyframes?.[prop];
  if (!frames?.length) return fallback;
  const sorted=[...frames].sort((a,b)=>a.at-b.at);
  if (frame<=sorted[0].at) return sorted[0].value;
  if (frame>=sorted.at(-1)!.at) return sorted.at(-1)!.value;
  for (let i=1;i<sorted.length;i++) if (frame<=sorted[i].at) {
    const a=sorted[i-1],b=sorted[i], t=(frame-a.at)/(b.at-a.at); return a.value+(b.value-a.value)*t;
  }
  return fallback;
}

export class SvgMotionRenderer implements MotionRenderer {
  validate(graph: MotionGraph): void { validateMotionGraph(graph); }
  renderFrame(graph: MotionGraph, frame: number): string {
    validateMotionGraph(graph);
    if (!Number.isInteger(frame) || frame<0 || frame>=graph.duration) throw new Error('frame outside graph duration');
    const body = graph.nodes.filter(n=>frame>=n.start&&frame<n.start+n.duration).map(n=>{
      const local=frame-n.start, x=keyframed(n,'x',local,n.x??0), y=keyframed(n,'y',local,n.y??0), opacity=keyframed(n,'opacity',local,n.opacity??1), rotation=keyframed(n,'rotation',local,n.rotation??0), scale=keyframed(n,'scale',local,1);
      const transform=`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`;
      const common=`opacity="${opacity.toFixed(4)}" transform="${transform}"`;
      if(n.type==='text') return `<text ${common} fill="${esc(n.fill??'#fff')}" font-size="${n.fontSize??48}" font-family="system-ui,sans-serif">${esc(n.text??'')}</text>`;
      if(n.type==='rect') return `<rect ${common} width="${n.width??100}" height="${n.height??100}" rx="${n.radius??0}" fill="${esc(n.fill??'#fff')}"/>`;
      if(n.type==='circle') return `<circle ${common} r="${n.radius??50}" fill="${esc(n.fill??'#fff')}"/>`;
      if(n.type==='line') return `<line ${common} x2="${n.width??100}" y2="${n.height??0}" stroke="${esc(n.stroke??'#fff')}"/>`;
      return `<g ${common}></g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}"><rect width="100%" height="100%" fill="${esc(graph.background??'transparent')}"/>${body}</svg>`;
  }
}

export interface MotionComponentProps { title?: string; subtitle?: string; value?: number; accent?: string }
type Factory = (props: MotionComponentProps) => MotionGraph;
const base = (): Pick<MotionGraph,'width'|'height'|'duration'> => ({width:1080,height:1920,duration:90});
export const motionComponents: Record<'kinetic-title'|'lower-third'|'product-card'|'stat-counter'|'caption-highlight', Factory> = {
  'kinetic-title': p => ({...base(),nodes:[
    {id:'title',type:'text',start:0,duration:90,x:90,y:850,text:p.title??'Title',fontSize:104,fill:'#ffffff',keyframes:{x:[{at:0,value:-600},{at:15,value:90}],opacity:[{at:0,value:0},{at:10,value:1}]}},
    {id:'rule',type:'rect',start:0,duration:90,x:90,y:900,width:180,height:12,fill:p.accent??'#7c3aed'}]}),
  'lower-third': p => ({...base(),nodes:[{id:'bar',type:'rect',start:0,duration:90,x:72,y:1540,width:760,height:180,radius:28,fill:'#111827',keyframes:{x:[{at:0,value:-900},{at:14,value:72}]}},{id:'title',type:'text',start:5,duration:85,x:110,y:1615,text:p.title??'Name',fontSize:54},{id:'sub',type:'text',start:7,duration:83,x:110,y:1675,text:p.subtitle??'Role',fontSize:32,fill:'#c4b5fd'}]}),
  'product-card': p => ({...base(),nodes:[{id:'card',type:'rect',start:0,duration:90,x:90,y:520,width:900,height:760,radius:52,fill:'#111827',keyframes:{opacity:[{at:0,value:0},{at:12,value:1}],scale:[{at:0,value:.86},{at:16,value:1}]}},{id:'title',type:'text',start:8,duration:82,x:150,y:680,text:p.title??'Product',fontSize:72},{id:'sub',type:'text',start:12,duration:78,x:150,y:760,text:p.subtitle??'Built differently',fontSize:40,fill:'#d1d5db'}]}),
  'stat-counter': p => ({...base(),nodes:[{id:'value',type:'text',start:0,duration:90,x:120,y:980,text:String(p.value??92),fontSize:220,fill:p.accent??'#8b5cf6',keyframes:{opacity:[{at:0,value:0},{at:8,value:1}],scale:[{at:0,value:.6},{at:12,value:1}]}},{id:'label',type:'text',start:8,duration:82,x:130,y:1060,text:p.title??'score',fontSize:44}]}),
  'caption-highlight': p => ({...base(),nodes:[{id:'bg',type:'rect',start:0,duration:90,x:80,y:1420,width:920,height:180,radius:32,fill:'#000000'},{id:'caption',type:'text',start:0,duration:90,x:120,y:1525,text:p.title??'Agent-native editing',fontSize:58,fill:'#ffffff'},{id:'accent',type:'rect',start:0,duration:90,x:110,y:1565,width:300,height:10,fill:p.accent??'#8b5cf6',keyframes:{scale:[{at:0,value:0},{at:18,value:1}]}}]})
};

export * from './v3.ts';

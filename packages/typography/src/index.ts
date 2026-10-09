import type { Rect, TextSelector } from '../../schema/src/v3/project.ts';

export interface TextLayoutOptions { fontSize:number; lineHeight:number; tracking:number; maxWidth?:number; horizontalAlign:'left'|'center'|'right'|'justify' }
export interface GlyphCluster { index:number; text:string; start:number; end:number; x:number; y:number; width:number; line:number; glyphIds:number[]; baseline:number; fontFamily:string }
export interface TextLine { index:number; clusterStart:number; clusterEnd:number; y:number; width:number }
export interface TextLayout { text:string; clusters:GlyphCluster[]; lines:TextLine[]; width:number; height:number; options:TextLayoutOptions; engine:'native-parley'|'reference'|'test-fallback'; direction:'ltr'|'rtl'|'mixed'; fontProvenance:string[] }
export interface TextShaper { shape(text:string,options:TextLayoutOptions):TextLayout }

function graphemes(text:string):Array<{segment:string;index:number}> {
  const Seg=(Intl as unknown as {Segmenter?:new(locale?:string,opts?:{granularity:'grapheme'})=>{segment(s:string):Iterable<{segment:string;index:number}>}}).Segmenter;
  if(Seg)return [...new Seg(undefined,{granularity:'grapheme'}).segment(text)].map(s=>({segment:s.segment,index:s.index}));
  const out:Array<{segment:string;index:number}>=[];let offset=0;for(const ch of Array.from(text)){out.push({segment:ch,index:offset});offset+=ch.length;}return out;
}
function advance(text:string,fontSize:number,tracking:number):number { if(text==='\n')return 0;if(/^\s+$/u.test(text))return fontSize*.33+tracking; if(/\p{Extended_Pictographic}/u.test(text))return fontSize*.95+tracking;return fontSize*.6+tracking; }

function textDirection(text:string):'ltr'|'rtl'|'mixed' { const rtl=/[\u0590-\u08ff]/u.test(text),ltr=/[A-Za-z\u00c0-\u02af]/u.test(text);return rtl&&ltr?'mixed':rtl?'rtl':'ltr'; }
function glyphIdsFor(segment:string):number[]{return Array.from(segment).map(ch=>ch.codePointAt(0)??0);}
export class ReferenceTextShaper implements TextShaper {
  shape(text:string,options:TextLayoutOptions):TextLayout {
    if(!(options.fontSize>0&&options.lineHeight>0))throw new Error('text metrics must be positive');
    const max=options.maxWidth??Infinity,segments=graphemes(text),clusters:GlyphCluster[]=[],lines:TextLine[]=[];
    let x=0,y=0,line=0,lineStart=0,lineWidth=0;
    const closeLine=()=>{lines.push({index:line,clusterStart:lineStart,clusterEnd:clusters.length,y,width:lineWidth});line++;y+=options.lineHeight;x=0;lineStart=clusters.length;lineWidth=0;};
    for(let i=0;i<segments.length;i++){
      const s=segments[i];
      if(s.segment==='\n'){closeLine();continue;}
      const w=advance(s.segment,options.fontSize,options.tracking);
      if(x>0&&x+w>max)closeLine();
      clusters.push({index:clusters.length,text:s.segment,start:s.index,end:segments[i+1]?.index??text.length,x,y,width:w,line,glyphIds:glyphIdsFor(s.segment),baseline:y+options.fontSize,fontFamily:'system-ui'});x+=w;lineWidth=x;
    }
    closeLine();
    const width=Math.min(max,Math.max(0,...lines.map(l=>l.width))),height=Math.max(options.lineHeight,lines.length*options.lineHeight);
    if(options.horizontalAlign!=='left'&&Number.isFinite(max)){
      for(const l of lines){const offset=options.horizontalAlign==='center'?(max-l.width)/2:options.horizontalAlign==='right'?max-l.width:0;for(let i=l.clusterStart;i<l.clusterEnd;i++)clusters[i].x+=offset;}
    }
    return {text,clusters,lines,width,height,options:{...options},engine:'reference',direction:textDirection(text),fontProvenance:['system-ui']};
  }
}
export class TestFallbackTextShaper extends ReferenceTextShaper { override shape(text:string,options:TextLayoutOptions):TextLayout { return {...super.shape(text,options),engine:'test-fallback'}; } }
/** @deprecated Test-only compatibility alias. Production render/QC must use native text metrics. */
export class FallbackTextShaper extends TestFallbackTextShaper {}
export function validateNativeTextLayout(layout:TextLayout):TextLayout { if(layout.engine!=='native-parley')throw new Error('native text layout required for production rendering/QC');if(!layout.clusters.every(c=>c.glyphIds.length>0&&Number.isFinite(c.baseline)))throw new Error('native text layout contains invalid glyph metrics');return layout; }
export function textBounds(layout:TextLayout):Rect { return {x:0,y:0,width:layout.width,height:layout.height}; }

function selectedWordRanges(text:string):Array<[number,number]> {
  const Seg=(Intl as unknown as {Segmenter?:new(locale?:string,opts?:{granularity:'word'})=>{segment(s:string):Iterable<{segment:string;index:number;isWordLike?:boolean}>}}).Segmenter;
  if(Seg){const seg=[...new Seg(undefined,{granularity:'word'}).segment(text)];return seg.filter(s=>s.isWordLike).map((s,i)=>[s.index,seg[seg.indexOf(s)+1]?.index??text.length]);}
  const out:Array<[number,number]>=[];for(const m of text.matchAll(/\S+/gu))out.push([m.index??0,(m.index??0)+m[0].length]);return out;
}
function overlaps(c:GlyphCluster,start:number,end:number){return c.start<end&&c.end>start;}
function seededUnit(seed:number,index:number):number { let x=(seed^Math.imul(index+1,0x9e3779b1))>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/0x100000000; }

export function selectorWeights(text:string,layout:TextLayout,selector:TextSelector):number[] {
  const out=new Array(layout.clusters.length).fill(0);
  const mark=(start:number,end:number)=>layout.clusters.forEach((c,i)=>{if(overlaps(c,start,end))out[i]=1;});
  switch(selector.type){
    case 'characters':
    case 'index-range': {const s=Math.max(0,selector.start??0),e=Math.min(layout.clusters.length,selector.end??layout.clusters.length);for(let i=s;i<e;i++)out[i]=1;break;}
    case 'percent-range': {const s=Math.floor(layout.clusters.length*Math.max(0,selector.start)/100),e=Math.ceil(layout.clusters.length*Math.min(100,selector.end)/100);for(let i=s;i<e;i++)out[i]=1;break;}
    case 'words': {const ranges=selectedWordRanges(text),s=Math.max(0,selector.start??0),e=Math.min(ranges.length,selector.end??ranges.length);for(let i=s;i<e;i++)mark(...ranges[i]);break;}
    case 'lines': {const s=Math.max(0,selector.start??0),e=Math.min(layout.lines.length,selector.end??layout.lines.length);for(let i=s;i<e;i++)for(let c=layout.lines[i].clusterStart;c<layout.lines[i].clusterEnd;c++)out[c]=1;break;}
    case 'regex': {
      if(selector.pattern.length>512)throw new Error('regex selector exceeds limit');
      const flags=[...new Set(`${selector.flags??''}gu`.split(''))].join('');const re=new RegExp(selector.pattern,flags);let count=0;
      for(const m of text.matchAll(re)){if(++count>1000)throw new Error('regex selector match limit exceeded');const start=m.index??0,end=start+m[0].length;if(end===start)continue;mark(start,end);}break;
    }
    case 'seeded-random': {if(selector.probability<0||selector.probability>1)throw new Error('selector probability must be 0..1');for(let i=0;i<out.length;i++)out[i]=seededUnit(selector.seed,i)<selector.probability?1:0;break;}
  }
  return out;
}

export function combineSelectorWeights(weights:number[][]):number[] {
  if(!weights.length)return[];const n=weights[0].length;return Array.from({length:n},(_,i)=>Math.max(0,Math.min(1,weights.reduce((v,w)=>v*(w[i]??0),1))));
}

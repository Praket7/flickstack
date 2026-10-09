import { createHash } from 'node:crypto';

export interface ImportedSvgNode { id?:string; tag:string; attributes:Record<string,string> }
export interface ImportedSvgDocument { viewBox?:[number,number,number,number]; nodes:ImportedSvgNode[]; nativeExecution:false; sourceHash:string }
const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,16);
function parseAttrs(text:string):Record<string,string>{const out:Record<string,string>={};for(const m of text.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g))out[m[1]]=m[2];return out;}
export function importStructuredSvg(source:string):ImportedSvgDocument{
 if(typeof source!=='string'||!source.trim()||source.length>2_000_000)throw new Error('SVG source is empty or exceeds import limit');
 if(/<\s*(script|foreignObject)\b/i.test(source))throw new Error('Unsafe active content in SVG');
 if(/\bon\w+\s*=\s*["']/i.test(source))throw new Error('Unsafe SVG event handler');
 if(/(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|file:|data:|javascript:)/i.test(source))throw new Error('External or unsupported SVG reference');
 if(!/<\s*svg\b/i.test(source))throw new Error('SVG root element required');
 const root=/<\s*svg\b([^>]*)>/i.exec(source),attrs=root?parseAttrs(root[1]):{};let viewBox:ImportedSvgDocument['viewBox'];if(attrs.viewBox){const parts=attrs.viewBox.trim().split(/\s+/).map(Number);if(parts.length===4&&parts.every(Number.isFinite))viewBox=parts as [number,number,number,number];}
 const nodes:ImportedSvgNode[]=[];for(const m of source.matchAll(/<\s*(g|rect|circle|ellipse|path|line|polyline|polygon|text)\b([^>]*)>/gi)){const a=parseAttrs(m[2]);nodes.push({tag:m[1].toLowerCase(),...(a.id?{id:a.id}:{}),attributes:a});}
 return{...(viewBox?{viewBox}:{}),nodes,nativeExecution:false,sourceHash:hash(source)};
}

export interface ImportedLottieLayer { index?:number; type?:number; name?:string; inFrame?:number; outFrame?:number; parent?:number }
export interface ImportedLottieDocument { version?:string;frameRate:number;width:number;height:number;inFrame:number;outFrame:number;layers:ImportedLottieLayer[];nativeExecution:false;sourceHash:string }
function scanLottie(value:unknown,path='lottie',depth=0):void{if(depth>64)throw new Error('Lottie nesting exceeds import limit');if(typeof value==='string'&&/(?:eval\s*\(|Function\s*\(|javascript:|https?:\/\/|file:\/\/)/i.test(value))throw new Error(`Lottie expression or network content at ${path}`);if(Array.isArray(value)){if(value.length>100_000)throw new Error('Lottie array exceeds import limit');value.forEach((v,i)=>scanLottie(v,`${path}[${i}]`,depth+1));return;}if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(k==='x'&&typeof v==='string'&&v.trim())throw new Error(`Lottie expression is not allowed at ${path}.${k}`);if((k==='u'||k==='p')&&typeof v==='string'&&/^(?:https?:|file:|data:)/i.test(v))throw new Error(`Lottie external/network asset is not allowed at ${path}.${k}`);scanLottie(v,`${path}.${k}`,depth+1);}}}
export function importStructuredLottie(input:unknown):ImportedLottieDocument{const raw=typeof input==='string'?JSON.parse(input):structuredClone(input);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Lottie document must be an object');scanLottie(raw);const d=raw as Record<string,unknown>;for(const k of ['fr','w','h','ip','op'])if(typeof d[k]!=='number'||!Number.isFinite(d[k]))throw new Error(`Lottie ${k} must be finite`);if(!Array.isArray(d.layers))throw new Error('Lottie layers must be an array');const layers=d.layers.map((x,i)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(`Lottie layer ${i} must be an object`);const l=x as Record<string,unknown>;return{...(typeof l.ind==='number'?{index:l.ind}:{}),...(typeof l.ty==='number'?{type:l.ty}:{}),...(typeof l.nm==='string'?{name:l.nm}:{}),...(typeof l.ip==='number'?{inFrame:l.ip}:{}),...(typeof l.op==='number'?{outFrame:l.op}:{}),...(typeof l.parent==='number'?{parent:l.parent}:{})};});const serialized=JSON.stringify(raw);return{version:typeof d.v==='string'?d.v:undefined,frameRate:d.fr as number,width:d.w as number,height:d.h as number,inFrame:d.ip as number,outFrame:d.op as number,layers,nativeExecution:false,sourceHash:hash(serialized)};}

export interface InterchangeCapability {id:'otio'|'svg'|'lottie'|'ocio'|'openfx'|'aaf'|'fcpxml'|'edl';import:'supported'|'metadata-only'|'unsupported';export:'supported'|'metadata-only'|'unsupported';processing?:'metadata-only'|'structured'|'native';diagnostic?:string}
export function professionalInterchangeCapabilities():InterchangeCapability[]{return[
 {id:'otio',import:'metadata-only',export:'supported',processing:'structured'},
 {id:'svg',import:'supported',export:'metadata-only',processing:'structured'},
 {id:'lottie',import:'supported',export:'metadata-only',processing:'structured'},
 {id:'ocio',import:'metadata-only',export:'metadata-only',processing:'metadata-only',diagnostic:'OCIO runtime processing is not linked in v0.3'},
 {id:'openfx',import:'metadata-only',export:'metadata-only',processing:'metadata-only',diagnostic:'Native OpenFX execution is disabled until isolated hosting exists'},
 {id:'aaf',import:'unsupported',export:'unsupported',diagnostic:'AAF is not implemented'},
 {id:'fcpxml',import:'unsupported',export:'unsupported',diagnostic:'FCPXML is not implemented'},
 {id:'edl',import:'unsupported',export:'unsupported',diagnostic:'EDL is not implemented'},
];}
export interface ColorIntent {workingSpace:string;displaySpace:string;transfer:string;view?:string;look?:string;processing:'metadata-only'}
export function createColorIntent(input:{workingSpace:string;displaySpace:string;transfer:string;view?:string;look?:string}):ColorIntent{for(const k of ['workingSpace','displaySpace','transfer'] as const)if(!input[k]?.trim())throw new Error(`${k} is required`);return{...structuredClone(input),processing:'metadata-only'};}

// Compatibility aliases for earlier v0.3 callers.
export const parseSvgVectorSource=importStructuredSvg;
export const parseLottieSource=importStructuredLottie;
export const createColorManagementIntent=(input:{workingSpace:string;displaySpace:string;outputSpace:string;view?:string;look?:string})=>({workingSpace:input.workingSpace,displaySpace:input.displaySpace,outputSpace:input.outputSpace,view:input.view,look:input.look,runtime:'declarative-only' as const});
export function ofxHostCapabilities(){return{api:'OpenFX' as const,nativeExecution:false as const,processIsolation:false as const,parameterSerialization:true as const,gpuContextSharing:false as const,pixelFormats:['RGBA8','RGBA16F','RGBA32F'],status:'foundation-only' as const};}
export function assertNativeOfxExecutionAllowed():never{throw new Error('Native OpenFX execution is disabled until process isolation is implemented');}

import { animated, defaultMotionTransform, type AspectClass, type MotionComponentDefinition, type MotionLayer } from '../../schema/src/v3/project.ts';
export * from './rigs.ts';

export interface MotionComponentFactoryProps { title?:string; subtitle?:string; value?:number; accent?:string }
const variants:AspectClass[]=['landscape','portrait','square','four-five'];
function baseLayer(id:string,kind:MotionLayer['kind'],zIndex:number):MotionLayer{return{id,kind,name:id,start:0,duration:90,enabled:true,locked:false,zIndex,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true};}
function rect(id:string,z:number,x:number,y:number,w:number,h:number,fill:string,radius=20):MotionLayer{const l=baseLayer(id,'shape',z);l.transform.position=animated([x,y,0]);l.shape={kind:'rect',width:w,height:h,radius};l.shapeStyle={fill:animated(fill)};return l;}
function text(id:string,z:number,x:number,y:number,value:string,size:number,fill='#ffffff'):MotionLayer{const l=baseLayer(id,'text',z);l.transform.position=animated([x,y,0]);l.text=value;l.textStyle={fontSize:animated(size),lineHeight:animated(size*1.15),tracking:animated(0),horizontalAlign:'left',fill:animated(fill)};return l;}
function component(id:string,category:string,layers:MotionLayer[],soundCues:MotionComponentDefinition['soundCues']=[]):MotionComponentDefinition{return{id,name:id.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),category,version:1,composition:{id:`${id}:scene`,name:id,width:1920,height:1080,duration:90,background:'transparent',layers,layoutVariants:variants.map(aspect=>({aspect,constraintsByLayer:{}}))},responsiveVariants:variants,soundCues,provenance:{creator:'FlickSmith',license:'Apache-2.0'}};}
const defs:Record<string,MotionComponentDefinition>={
  'kinetic-title':component('kinetic-title','title',[text('title',2,180,480,'BUILD ANYTHING',110),rect('accent',1,180,525,320,12,'#ffffff',6)]),
  'paragraph-reveal':component('paragraph-reveal','typography',[text('title',1,220,360,'Tell the story clearly.',68),text('subtitle',2,220,455,'Structured typography stays editable.',38,'#c7c7c7')]),
  'lower-third':component('lower-third','editorial',[rect('panel',1,90,790,760,170,'#151515',28),text('title',2,140,850,'Name',52),text('subtitle',3,140,910,'Role',30,'#c7c7c7')]),
  'message-composer':component('message-composer','ui',[rect('panel',1,420,360,1080,360,'#171717',34),text('title',2,480,455,'Build this.',54),text('subtitle',3,480,560,'Agent response',34,'#b9b9b9')],[{id:'send',frame:24,event:'send'}]),
  'terminal-code':component('terminal-code','ui',[rect('panel',1,320,240,1280,600,'#0b0b0b',30),text('title',2,380,330,'$ npm test',42,'#f5f5f5'),text('subtitle',3,380,420,'✓ tests passed',36,'#a7f3d0')],[{id:'tick',frame:35,event:'success'}]),
  'diff-review':component('diff-review','ui',[rect('panel',1,300,210,1320,660,'#111111',28),text('title',2,360,300,'Review changes',48),rect('removed',2,360,390,1180,70,'#3a1616',12),rect('added',3,360,490,1180,70,'#143621',12)]),
  'command-palette':component('command-palette','ui',[rect('panel',1,510,260,900,520,'#181818',34),text('title',2,570,350,'Search commands…',42),text('subtitle',3,570,450,'Open project',32,'#c9c9c9')],[{id:'open',frame:10,event:'panel-open'}]),
  'browser-window':component('browser-window','ui',[rect('panel',1,180,120,1560,840,'#f4f4f4',26),rect('bar',2,180,120,1560,86,'#dedede',26),text('title',3,260,176,'localhost:3000',28,'#222222')]),
  'stat-counter':component('stat-counter','data',[text('value',2,690,430,'92',210),text('title',3,710,650,'SCORE',38,'#bfbfbf')]),
  'table-list':component('table-list','data',[rect('panel',1,360,220,1200,650,'#151515',28),text('title',2,420,310,'Recent runs',46),text('subtitle',3,420,400,'Build  Status  Duration',31,'#bdbdbd')]),
  'feature-card':component('feature-card','product',[rect('panel',1,520,210,880,660,'#151515',42),text('title',2,590,340,'Feature',62),text('subtitle',3,590,450,'Explain one idea per scene.',34,'#c0c0c0')]),
  'chart':component('chart','data',[text('title',3,240,250,'Performance',48),rect('bar-a',1,300,620,180,220,'#777777',12),rect('bar-b',2,560,480,180,360,'#ffffff',12),rect('bar-c',2,820,560,180,280,'#b0b0b0',12)]),
  'callout':component('callout','annotation',[rect('panel',1,650,350,620,260,'#111111',30),text('title',2,710,455,'Focus here',50),text('subtitle',3,710,530,'One clear action',30,'#c9c9c9')]),
  'logo-end-card':component('logo-end-card','brand',[text('title',2,650,480,'FlickSmith',100),text('subtitle',3,710,600,'From intent to finished motion.',34,'#c7c7c7')],[{id:'impact',frame:4,event:'impact'}]),
};
export const professionalMotionComponents:Record<string,MotionComponentDefinition>=defs;
export function createMotionComponent(id:string,props:MotionComponentFactoryProps={}):MotionComponentDefinition {
  const source=defs[id];if(!source)throw new Error(`Unknown motion component ${id}`);const c=structuredClone(source);
  for(const l of c.composition.layers){if(l.kind!=='text')continue;if(l.id==='title'&&props.title!==undefined)l.text=props.title;if(l.id==='subtitle'&&props.subtitle!==undefined)l.text=props.subtitle;if(l.id==='value'&&props.value!==undefined)l.text=String(props.value);}
  if(props.accent)for(const l of c.composition.layers)if(l.shapeStyle?.fill)l.shapeStyle.fill.baseValue=props.accent;
  return c;
}

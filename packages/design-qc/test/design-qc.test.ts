import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewMotionDesign } from '../src/index.ts';
import { migrateV2ToV3, migrateV1ToV2, animated, defaultMotionTransform, type FlickProject } from '../../schema/src/index.ts';

function base(){const v1:FlickProject={version:1,id:'p',name:'P',format:{width:640,height:360,fps:{numerator:30,denominator:1},audioSampleRate:48000},assets:[],tracks:[],markers:[],style:{},provenance:[],checkpoints:[],branches:[]};return migrateV2ToV3(migrateV1ToV2(v1));}
const common=(id:string,kind:any,z=0)=>({id,kind,name:id,start:0,duration:60,enabled:true,locked:false,zIndex:z,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false});

test('design QC detects the required structural motion/design failures with exact IDs/ranges',()=>{
  const p=base();p.layoutTokens={alignmentGrid:8,spacing:16};
  const badText:any={...common('title','text',3),duration:10,text:'A very long title that cannot fit inside this tiny paragraph box',transform:defaultMotionTransform(),textStyle:{fontSize:animated(10),lineHeight:animated(12),tracking:animated(0),fill:animated('#f2f2f2'),paragraphBox:{x:0,y:0,width:80,height:20}},props:{role:'title',stackGroup:'g'}};badText.transform.position=animated([-15,7,0]);badText.effects=[{id:'glow',type:'glow',enabled:true,params:{radius:40}}];badText.layout=[{id:'w',type:'width',value:80},{id:'l',type:'pin-left',value:20},{id:'r',type:'pin-right',value:20}];
  const overlap:any={...common('overlap','shape',2),shape:{kind:'rect',width:200,height:120},shapeStyle:{fill:animated('#ffffff')},transform:defaultMotionTransform(),props:{stackGroup:'g'}};overlap.transform.position=animated([0,0,0]);
  const ui:any={...common('ui','image',1),transform:defaultMotionTransform(),props:{width:120,height:80,uiSurface:true}};ui.transform.position=animated([50,50,0]);
  const cam:any={...common('cam','camera',0),camera:{focalLength:animated(50)}};cam.transform.position={baseValue:[0,0,1000],keyframes:[{frame:0,value:[0,0,1000],interpolation:'linear'},{frame:20,value:[10,0,1000],interpolation:'linear'},{frame:21,value:[1000,0,1000],interpolation:'linear'}]};
  p.motionCompositions.push({id:'mc',name:'M',width:640,height:360,duration:60,background:'#ffffff',cameraId:'cam',layers:[cam,ui,overlap,badText],sharedTransitions:[{id:'jump',kind:'shared-element',start:10,duration:1,bindings:[{id:'b',sourceLayerId:'title',destinationLayerId:'overlap',properties:['bounds']}]}]});
  const result=reviewMotionDesign(p,'mc');const types=new Set(result.issues.map(i=>i.type));
  for(const type of ['text_overflow','safe_area','small_text','contrast','collision','out_of_bounds','clipped_effect','alignment','spacing','small_ui','transition_discontinuity','camera_velocity','short_hold','impossible_constraints'] as const)assert.ok(types.has(type),`${type}: ${[...types].join(',')}`);
  assert.ok(result.issues.every(i=>i.startFrame>=0&&i.endFrame>=i.startFrame&&i.message&&i.suggestion));
});

test('design QC reports accidental blank motion output',()=>{
  const p=base();p.motionCompositions.push({id:'empty',name:'Empty',width:640,height:360,duration:30,background:'transparent',layers:[]});
  const result=reviewMotionDesign(p,'empty');assert.ok(result.issues.some(i=>i.type==='blank_output'&&i.severity==='error'));assert.equal(result.blocking,true);
});

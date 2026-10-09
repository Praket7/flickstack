import {
  animated,
  defaultMotionTransform,
  defaultTransform,
  migrateV1ToV2,
  migrateV2ToV3,
  type FlickProject,
  type FlickProjectV3,
  type MotionLayer,
} from '../../packages/schema/src/index.ts';

function baseLayer(id:string,kind:MotionLayer['kind'],zIndex:number):MotionLayer {
  return {id,kind,name:id,start:0,duration:120,enabled:true,locked:false,zIndex,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:true};
}

export function motionV03Project():FlickProjectV3 {
  const v1:FlickProject={
    version:1,id:'motion-v03',name:'Premium UI Motion Acceptance',
    format:{width:1080,height:1920,fps:{numerator:30,denominator:1},audioSampleRate:48000},
    assets:[{id:'music',path:'/tmp/flicksmith-motion-v03-music.wav',kind:'audio',duration:120}],tracks:[],markers:[{id:'beat-1',at:30,label:'Beat'}],style:{},provenance:[],checkpoints:[],branches:[],
  };
  const p=migrateV2ToV3(migrateV1ToV2(v1));
  p.layoutTokens={alignmentGrid:8,spacing:16,safeArea:.05};
  p.motionTokens={cameraCurve:'ui-native',transitionGrammar:['hard-cut','shared-element','camera-continuation']};
  p.typographyTokens={titleMinPx:48,bodyMinPx:18};
  p.motionStyles.push({id:'ui-native',name:'UI Native',durationFrames:10,curve:{type:'bezier',outTangent:{x:.16,y:1},inTangent:{x:.3,y:1}}});
  p.audioAnalyses=[{id:'music-analysis',assetId:'music',sourceHash:'fixture-audio-hash',algorithm:'fixture',algorithmVersion:'1',fps:30,beats:[0,15,30,45,60,75,90,105],downbeats:[0,60],envelopes:{energy:[{frame:0,value:.2},{frame:30,value:.8},{frame:60,value:.4}],low:[{frame:0,value:.2}],mid:[{frame:0,value:.3}],high:[{frame:0,value:.4}],speech:[]}}];
  p.trackingData=[{id:'ui-track',algorithm:'fixture',algorithmVersion:'1',kind:'point',supported:true,keyframes:[{frame:0,value:[0,0]},{frame:119,value:[8,4]}]}];

  const camera=baseLayer('camera','camera',0);camera.camera={focalLength:animated(50),focusDistance:animated(1000),aperture:animated(2.8),depthOfField:animated(0)};camera.transform.position={baseValue:[0,0,1000],keyframes:[{frame:0,value:[0,0,1000],interpolation:'bezier',outTangent:{x:.16,y:1}},{frame:60,value:[12,-8,1000],interpolation:'bezier',inTangent:{x:.3,y:1},outTangent:{x:.16,y:1}},{frame:119,value:[20,-14,1000],interpolation:'bezier',inTangent:{x:.3,y:1}}]};

  const panel=baseLayer('panel','shape',1);panel.transform.position=animated([128,320,0]);panel.shape={kind:'rect',width:824,height:760,radius:44};panel.shapeStyle={fill:animated('#15181d')};panel.masks=[{id:'panel-reveal',kind:'rect',geometry:{kind:'rect',width:824,height:760,radius:44},feather:animated(2),expansion:animated(0),invert:false,combine:'add'}];

  const title=baseLayer('title','text',4);title.transform.position=animated([176,176,0]);title.opacity={baseValue:.92,behaviors:[{id:'music-pulse',type:'audio-react',enabled:true,params:{signal:'energy',amount:.05},bakeable:true,estimatedCost:2}]};title.text='Intent becomes finished motion.';title.textStyle={fontSize:animated(72),lineHeight:animated(82),tracking:animated(-1),horizontalAlign:'left',fill:animated('#ffffff'),paragraphBox:{x:0,y:0,width:728,height:180}};title.textSelectors=[{id:'words',type:'words',start:0,end:4}];title.textAnimators=[{id:'word-rise',selectorIds:['words'],position:{baseValue:[0,0,0],keyframes:[{frame:0,value:[0,36,0],interpolation:'ease'},{frame:18,value:[0,0,0],interpolation:'ease'}]},opacity:{baseValue:1,keyframes:[{frame:0,value:0,interpolation:'linear'},{frame:12,value:1,interpolation:'ease'}]}}];title.props={role:'title'};

  const matte=baseLayer('ui-matte','shape',2);matte.transform.position=animated([176,400,0]);matte.shape={kind:'rect',width:728,height:520,radius:32};matte.shapeStyle={fill:animated('#ffffff')};
  const ui=baseLayer('ui-surface','image',3);ui.transform.position={baseValue:[176,400,0],keyframes:[{frame:0,value:[176,420,0],interpolation:'ease'},{frame:24,value:[176,400,0],interpolation:'ease'}]};ui.props={width:728,height:520,uiSurface:true,trackingRecordId:'ui-track'};ui.matte={sourceLayerId:'ui-matte',mode:'alpha'};

  const accent=baseLayer('accent','shape',5);accent.start=20;accent.duration=100;accent.transform.position=animated([176,1120,0]);accent.shape={kind:'rect',width:360,height:12,radius:6};accent.shapeStyle={fill:animated('#ffffff')};

  const comp:FlickProjectV3['motionCompositions'][number]={
    id:'motion-ui',name:'Premium UI Motion',width:1080,height:1920,duration:120,background:'#0b0d10',cameraId:'camera',layers:[camera,panel,matte,ui,title,accent],
    motionBlur:{enabled:true,shutterAngle:180,shutterPhase:0,samples:8,quality:'final' as const},
    sharedTransitions:[{id:'ui-focus',kind:'shared-element',start:30,duration:18,bindings:[{id:'focus-binding',sourceLayerId:'title',destinationLayerId:'ui-surface',properties:['bounds','opacity']}]}],
    compositingGraph:{nodes:[{id:'layers',kind:'layer',inputs:[],params:{}},{id:'glow',kind:'glow',inputs:['layers'],params:{radius:8}},{id:'out',kind:'output',inputs:['glow'],params:{}}],outputNodeId:'out'},
    layoutVariants:[
      {aspect:'portrait',constraintsByLayer:{title:[{id:'title-left',type:'pin-left',value:88},{id:'title-top',type:'pin-top',value:160},{id:'title-width',type:'width',value:760}]}},
      {aspect:'landscape',constraintsByLayer:{title:[{id:'title-left',type:'pin-left',value:120},{id:'title-top',type:'pin-top',value:96},{id:'title-width',type:'width',value:900}]}},
    ],
  };
  p.motionCompositions.push(comp);
  p.compositions[0].tracks.push({id:'motion-track',kind:'video',name:'Motion',zIndex:10,clips:[{id:'motion-clip',start:0,duration:120,sourceIn:0,transform:defaultTransform(),opacity:1,blendMode:'normal',maskRefs:[],effectStack:[],enabled:true,props:{motionCompositionId:'motion-ui'}}]});
  return p;
}

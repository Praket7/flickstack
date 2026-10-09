import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateV2ToV3,
  parseProjectV3,
  parseAnyProjectV3,
  serializeProjectV3,
  type FlickProjectV2,
  type FlickProjectV3,
  animated,
  defaultMotionTransform,
} from '../src/index.ts';

function v2(): FlickProjectV2 {
  return {
    version: 2,
    id: 'p',
    name: 'P',
    format: { width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 }, audioSampleRate: 48000 },
    assets: [{ id: 'a', path: '/tmp/a.mp4', kind: 'video', duration: 300 }],
    rootCompositionId: 'root',
    compositions: [{
      id: 'root', name: 'Main', width: 1920, height: 1080,
      tracks: [{ id: 'v', kind: 'video', name: 'V', clips: [{
        id: 'c', assetId: 'a', start: 2, duration: 100, sourceIn: 5,
        transform: { x: 10, y: 20, scaleX: 1.2, scaleY: .9, rotation: 2 },
        opacity: .8, blendMode: 'normal', maskRefs: [], effectStack: [], enabled: true,
      }] }],
    }],
    masks: [],
    audioBuses: [{ id: 'master', name: 'Master', effects: [], gainDb: 0, pan: 0 }],
    multicamGroups: [],
    perception: { providers: [] },
    preview: { quality: 'full', preferGpu: true },
    markers: [{ id: 'm', at: 12, label: 'beat' }],
    style: { captionMaxChars: 42 },
    provenance: [],
    checkpoints: [{ id: 'cp0', createdAt: '2026-01-01T00:00:00Z' }],
    branches: [{ name: 'main', checkpointId: 'cp0' }],
  };
}

test('v2→v3 migration is deterministic, non-mutating, and preserves editorial structures', () => {
  const input = v2();
  const before = structuredClone(input);
  const a = migrateV2ToV3(input);
  const b = migrateV2ToV3(input);
  assert.deepEqual(input, before);
  assert.deepEqual(a, b);
  assert.equal(a.version, 3);
  assert.deepEqual(a.compositions, input.compositions);
  assert.deepEqual(a.audioBuses, input.audioBuses);
  assert.deepEqual(a.multicamGroups, input.multicamGroups);
  assert.deepEqual(a.markers, input.markers);
  assert.deepEqual(a.style, input.style);
  assert.deepEqual(a.motionCompositions, []);
  assert.deepEqual(a.motionComponents, []);
  assert.deepEqual(a.motionRigs, []);
  assert.deepEqual(a.motionStyles, []);
});

test('parseAnyProjectV3 accepts v1/v2/v3 and canonical v3 serialization round-trips', () => {
  const migrated = parseAnyProjectV3(v2());
  assert.equal(migrated.version, 3);
  const reparsed = parseProjectV3(JSON.parse(serializeProjectV3(migrated)));
  assert.deepEqual(reparsed, migrated);
});

test('v3 scene validation rejects duplicate ids, parent cycles, missing references, non-finite values, and discrete bezier animation', () => {
  const base = migrateV2ToV3(v2());
  const scene = {
    id: 'mc', name: 'Motion', width: 1920, height: 1080, duration: 90,
    background: '#000000', layers: [
      { id: 'a', kind: 'group', name: 'A', start: 0, duration: 90, enabled: true, locked: false, zIndex: 0,
        transform: { position:{baseValue:[0,0,0]}, anchor:{baseValue:[0,0,0]}, scale:{baseValue:[1,1,1]}, rotation:{baseValue:[0,0,0]} }, opacity:{baseValue:1}, effects:[], masks:[], motionBlur:true },
    ],
  } as FlickProjectV3['motionCompositions'][number];
  assert.doesNotThrow(() => parseProjectV3({ ...base, motionCompositions:[scene] }));
  assert.throws(() => parseProjectV3({ ...base, motionCompositions:[{...scene,layers:[scene.layers[0],structuredClone(scene.layers[0])]}] }), /duplicate.*layer/i);
  assert.throws(() => parseProjectV3({ ...base, motionCompositions:[{...scene,layers:[{...scene.layers[0],parentId:'b'},{...scene.layers[0],id:'b',parentId:'a'}]}] }), /cycle/i);
  assert.throws(() => parseProjectV3({ ...base, motionCompositions:[{...scene,cameraId:'missing'}] }), /camera/i);
  assert.throws(() => parseProjectV3({ ...base, motionCompositions:[{...scene,layers:[{...scene.layers[0],opacity:{baseValue:Number.NaN}}]}] }), /finite/i);
  assert.throws(() => parseProjectV3({ ...base, motionCompositions:[{...scene,layers:[{...scene.layers[0],enabled:{baseValue:true,keyframes:[{frame:0,value:true,interpolation:'bezier'}]}}]}] }), /discrete.*hold/i);
});

test('v3 schema rejects malformed compositing graphs and invalid component or rig references', () => {
  const base=migrateV2ToV3(v2());
  const layer={id:'a',kind:'shape' as const,name:'A',start:0,duration:30,enabled:true,locked:false,zIndex:0,transform:{position:{baseValue:[0,0,0] as [number,number,number]},anchor:{baseValue:[0,0,0] as [number,number,number]},scale:{baseValue:[1,1,1] as [number,number,number]},rotation:{baseValue:[0,0,0] as [number,number,number]}},opacity:{baseValue:1},effects:[],masks:[],motionBlur:false,shape:{kind:'rect' as const,width:10,height:10}};
  const scene={id:'mc',name:'Motion',width:100,height:100,duration:30,background:'transparent',layers:[layer]};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{...scene,compositingGraph:{nodes:[{id:'out',kind:'output',inputs:['missing'],params:{}}],outputNodeId:'out'}}]}),/missing.*input/i);
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{...scene,compositingGraph:{nodes:[{id:'a',kind:'blend',inputs:['b'],params:{}},{id:'b',kind:'blend',inputs:['a'],params:{}},{id:'out',kind:'output',inputs:['a'],params:{}}],outputNodeId:'out'}}]}),/compositing.*cycle/i);
  assert.throws(()=>parseProjectV3({...base,motionComponents:[{id:'bad',name:'Bad',category:'test',version:1,composition:{...scene,layers:[{...layer,parentId:'missing'}]}}]}),/parent/i);
  assert.throws(()=>parseProjectV3({...base,motionRigs:[{id:'rig',name:'Rig',version:1,controls:[{id:'amount',name:'Amount',type:'number',defaultValue:1}],bindings:[{controlId:'missing',layerId:'a',propertyPath:'opacity'}]}]}),/rig.*control/i);
  const matteA={...layer,id:'matte-a',matte:{sourceLayerId:'matte-b',mode:'alpha' as const}};
  const matteB={...layer,id:'matte-b',matte:{sourceLayerId:'matte-a',mode:'alpha' as const}};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{...scene,layers:[matteA,matteB]}]}),/matte.*cycle/i);
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{...scene,sharedTransitions:[{id:'bad-transition',kind:'shared-element' as const,start:20,duration:20,bindings:[{id:'binding',sourceLayerId:'a',destinationLayerId:'missing',properties:['bounds' as const]}]}]}]}),/transition.*(duration|lifetime|layer)/i);
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{...scene,sharedTransitions:[{id:'bad-layer-transition',kind:'shared-element' as const,start:0,duration:5,bindings:[{id:'binding',sourceLayerId:'a',destinationLayerId:'missing',properties:['bounds' as const]}]}]}]}),/transition.*missing.*layer/i);
  const destination={...scene,id:'destination',layers:[{...layer,id:'dest-layer'}]};
  const source={...scene,id:'source',sharedTransitions:[{id:'cross',kind:'shared-element' as const,start:0,duration:5,sourceCompositionId:'source',destinationCompositionId:'destination',bindings:[{id:'cross-binding',sourceLayerId:'a',destinationLayerId:'missing',properties:['bounds' as const]}]}]};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[source,destination]}),/transition.*destination.*layer/i);
  assert.throws(()=>parseProjectV3({...base,motionComponents:[{id:'bad-rig-component',name:'Bad Rig',category:'test',version:1,composition:{...scene,rigId:'missing-rig'}}]}),/missing.*rig/i);
});

test('v3 parser rejects unknown interpolation, matte cycles, invalid rig defaults, and component cycles',()=>{
  const base=migrateV2ToV3(v2());
  const makeLayer=(id:string):FlickProjectV3['motionCompositions'][number]['layers'][number]=>({id,kind:'shape',name:id,start:0,duration:30,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,shape:{kind:'rect',width:10,height:10}});
  const badInterpolation=makeLayer('bad-interpolation');badInterpolation.opacity.keyframes=[{frame:0,value:1,interpolation:'not-a-curve' as never}];
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'curves',name:'Curves',width:100,height:100,duration:30,background:'transparent',layers:[badInterpolation]}]}),/interpolation/i);
  const a=makeLayer('a'),b=makeLayer('b');a.matte={sourceLayerId:'b',mode:'alpha'};b.matte={sourceLayerId:'a',mode:'alpha'};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'mattes',name:'Mattes',width:100,height:100,duration:30,background:'transparent',layers:[a,b]}]}),/matte.*cycle/i);
  assert.throws(()=>parseProjectV3({...base,motionRigs:[{id:'rig',name:'Rig',version:1,controls:[{id:'amount',name:'Amount',type:'number',defaultValue:'bad',min:0,max:1}],bindings:[]}]}),/control.*number/i);
  const ca=makeLayer('ca'),cb=makeLayer('cb');ca.componentId='b';cb.componentId='a';
  assert.throws(()=>parseProjectV3({...base,motionComponents:[{id:'a',name:'A',category:'test',version:1,composition:{id:'a-scene',name:'A',width:100,height:100,duration:30,background:'transparent',layers:[ca]}},{id:'b',name:'B',category:'test',version:1,composition:{id:'b-scene',name:'B',width:100,height:100,duration:30,background:'transparent',layers:[cb]}}]}),/component.*cycle/i);
});


test('v3 parser enforces runtime types for core animated motion properties',()=>{
  const base=migrateV2ToV3(v2());
  const makeLayer=(id:string):FlickProjectV3['motionCompositions'][number]['layers'][number]=>({id,kind:'shape',name:id,start:0,duration:30,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,shape:{kind:'rect',width:10,height:10}});
  const badOpacity=makeLayer('bad-opacity');badOpacity.opacity={baseValue:'opaque' as never};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'opacity',name:'Opacity',width:100,height:100,duration:30,background:'transparent',layers:[badOpacity]}]}),/opacity.*number/i);
  const badPosition=makeLayer('bad-position');badPosition.transform.position={baseValue:[0,0] as never};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'position',name:'Position',width:100,height:100,duration:30,background:'transparent',layers:[badPosition]}]}),/position.*vec3/i);
  const badEnabled=makeLayer('bad-enabled');badEnabled.enabled={baseValue:1 as never};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'enabled',name:'Enabled',width:100,height:100,duration:30,background:'transparent',layers:[badEnabled]}]}),/enabled.*boolean/i);
  const camera=makeLayer('camera');camera.kind='camera';camera.camera={focalLength:{baseValue:'wide' as never}};
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'camera-comp',name:'Camera',width:100,height:100,duration:30,background:'transparent',layers:[camera]}]}),/focalLength.*number/i);
  const text=makeLayer('text');text.kind='text';text.text='A';text.textStyle={fontSize:animated(32)};text.textAnimators=[{id:'style',selectorIds:[],fill:{baseValue:'#fff',keyframes:[{frame:0,value:'#000',interpolation:'linear'}]}}];
  assert.throws(()=>parseProjectV3({...base,motionCompositions:[{id:'text-comp',name:'Text',width:100,height:100,duration:30,background:'transparent',layers:[text]}]}),/fill.*hold/i);
});

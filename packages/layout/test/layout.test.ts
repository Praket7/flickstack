import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAspect, solveLayout, safeAreaForSurface, type LayoutItem } from '../src/index.ts';

const item=(id:string,width:number,height:number,constraints:any[]=[],parentId?:string):LayoutItem=>({id,intrinsic:{width,height},constraints,parentId});

test('aspect classifier recognizes professional delivery surfaces',()=>{
  assert.equal(classifyAspect(1920,1080),'landscape');
  assert.equal(classifyAspect(1080,1920),'portrait');
  assert.equal(classifyAspect(1080,1080),'square');
  assert.equal(classifyAspect(1080,1350),'four-five');
});

test('responsive constraints produce safe non-overlapping headline/card layouts at 16:9, 9:16, 1:1 and 4:5',()=>{
  for(const [w,h] of [[1920,1080],[1080,1920],[1080,1080],[1080,1350]]){
    const safe=safeAreaForSurface(w,h,.05);
    const result=solveLayout({width:w,height:h,safeArea:safe},[
      item('title',Math.min(900,w*.8),120,[{id:'cx',type:'center-x'},{id:'top',type:'pin-top',value:80},{id:'safe',type:'safe-area',value:'inside'}]),
      item('card',Math.min(900,w*.82),Math.min(520,h*.42),[{id:'cx',type:'center-x'},{id:'cy',type:'center-y'},{id:'safe',type:'safe-area',value:'inside'}]),
    ]);
    const title=result.bounds.title,card=result.bounds.card;
    assert.ok(title.x>=safe.x&&title.y>=safe.y);
    assert.ok(card.x>=safe.x&&card.y>=safe.y);
    assert.ok(title.y+title.height<=card.y || card.y+card.height<=title.y,`${w}x${h} no overlap`);
  }
});

test('pinning and parent percentages resolve relative to parent bounds',()=>{
  const result=solveLayout({width:1000,height:600},[
    item('panel',800,500,[{id:'cx',type:'center-x'},{id:'cy',type:'center-y'}]),
    item('child',100,100,[{id:'pct',type:'parent-percent',value:[.5,.25]},{id:'r',type:'pin-right',value:20},{id:'b',type:'pin-bottom',value:30}],'panel'),
  ]);
  assert.deepEqual(result.bounds.panel,{x:100,y:50,width:800,height:500});
  assert.deepEqual(result.bounds.child,{x:480,y:395,width:400,height:125});
});

test('solver rejects contradictory fixed size plus dual-edge pins',()=>{
  assert.throws(()=>solveLayout({width:500,height:500},[
    item('x',300,100,[{id:'w',type:'width',value:300},{id:'l',type:'pin-left',value:50},{id:'r',type:'pin-right',value:50}]),
  ]),/unsatisfiable/i);
});

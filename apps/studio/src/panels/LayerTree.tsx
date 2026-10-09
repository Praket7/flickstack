import React,{useMemo,useState} from 'react';
import type {StudioLayerSummary} from '../FlickSmithStudio.tsx';

export interface LayerTreeProps{
 layers:StudioLayerSummary[];selected:Set<string>;
 onSelect:(id:string,additive:boolean)=>void;onRename?:(id:string,name:string)=>void;
 onToggleLock?:(id:string,locked:boolean)=>void;onReparent?:(id:string,parentId?:string)=>void;
}
export function LayerTree({layers,selected,onSelect,onRename,onToggleLock,onReparent}:LayerTreeProps){
 const[editing,setEditing]=useState<string>();const[draft,setDraft]=useState('');
 const children=useMemo(()=>{const map=new Map<string|undefined,StudioLayerSummary[]>();for(const l of layers){const key=l.parentId;const a=map.get(key)??[];a.push(l);map.set(key,a);}for(const a of map.values())a.sort((x,y)=>(x.zIndex??0)-(y.zIndex??0)||x.name.localeCompare(y.name));return map;},[layers]);
 const row=(l:StudioLayerSummary,depth:number):React.ReactNode=><React.Fragment key={l.id}><div className="fs-layer-row" data-selected={selected.has(l.id)} style={{paddingLeft:8+depth*14}}><button className="fs-icon-button" aria-label={selected.has(l.id)?'Deselect layer':'Select layer'} onClick={e=>onSelect(l.id,e.metaKey||e.ctrlKey||e.shiftKey)}>{selected.has(l.id)?'●':'○'}</button>{editing===l.id?<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{const n=draft.trim();if(n&&n!==l.name)onRename?.(l.id,n);setEditing(undefined)}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setEditing(undefined)}}/>:<button className="fs-layer-name" onDoubleClick={()=>{setDraft(l.name);setEditing(l.id)}} onClick={e=>onSelect(l.id,e.metaKey||e.ctrlKey||e.shiftKey)}>{l.name}</button>}<span className="fs-muted fs-layer-kind">{l.kind}</span><button className="fs-icon-button" aria-label={l.locked?'Unlock layer':'Lock layer'} onClick={()=>onToggleLock?.(l.id,!l.locked)}>{l.locked?'🔒':'◇'}</button>{onReparent&&<select aria-label="Parent layer" value={l.parentId??''} onChange={e=>onReparent(l.id,e.target.value||undefined)}><option value="">root</option>{layers.filter(p=>p.id!==l.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>{(children.get(l.id)??[]).map(c=>row(c,depth+1))}</React.Fragment>;
 return <section className="fs-section fs-layer-tree"><div className="fs-panel-title"><h3>Layers</h3><span className="fs-muted">{layers.length}</span></div>{(children.get(undefined)??children.get('')??layers.filter(l=>!l.parentId)).map(l=>row(l,0))}</section>;
}

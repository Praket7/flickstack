import React from 'react';import {createRoot} from 'react-dom/client';import {FlickSmithStudio,type StudioProjectModel} from './FlickSmithStudio.tsx';import './styles.css';
declare global{interface Window{__FLICKSMITH_PROJECT__?:StudioProjectModel}}
const model=window.__FLICKSMITH_PROJECT__??{name:'Untitled project',revision:'local',layers:[],markers:[],qcIssues:[],receipts:[]};
createRoot(document.getElementById('root')!).render(<React.StrictMode><FlickSmithStudio model={model}/></React.StrictMode>);

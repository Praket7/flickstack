export type LocalHardwareProfile='cpu'|'low-vram'|'standard-gpu'|'high-vram';
export interface LocalHardwareCapabilities{profile:LocalHardwareProfile;localVideo:boolean;maxPreviewResolution:'none'|'480p'|'720p'|'1080p';defaultCandidateCount:number;maxCandidateCount:number;notes:string[]}
export const LOCAL_HARDWARE_PROFILES:Record<LocalHardwareProfile,LocalHardwareCapabilities>={
 cpu:{profile:'cpu',localVideo:false,maxPreviewResolution:'none',defaultCandidateCount:1,maxCandidateCount:1,notes:['Deterministic editing and lightweight analysis only','Do not fake novel-view shots with 2D transforms']},
 'low-vram':{profile:'low-vram',localVideo:true,maxPreviewResolution:'480p',defaultCandidateCount:1,maxCandidateCount:2,notes:['Use quantized or smaller local I2V models','Prefer deterministic or 2.5D routing where visually honest']},
 'standard-gpu':{profile:'standard-gpu',localVideo:true,maxPreviewResolution:'720p',defaultCandidateCount:2,maxCandidateCount:4,notes:['Default local I2V profile','Generate previews first, upscale/finish after selection']},
 'high-vram':{profile:'high-vram',localVideo:true,maxPreviewResolution:'1080p',defaultCandidateCount:4,maxCandidateCount:8,notes:['Higher-resolution local I2V and broader candidate search']}
};
export function localHardwareCapabilities(profile:LocalHardwareProfile):LocalHardwareCapabilities{return structuredClone(LOCAL_HARDWARE_PROFILES[profile])}
export function clampCandidateCount(profile:LocalHardwareProfile,requested?:number):number{const p=LOCAL_HARDWARE_PROFILES[profile],n=requested??p.defaultCandidateCount;return Math.max(1,Math.min(p.maxCandidateCount,Math.floor(Number.isFinite(n)?n:p.defaultCandidateCount)))}

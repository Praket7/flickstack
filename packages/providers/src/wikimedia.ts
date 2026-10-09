import { writeFile } from 'node:fs/promises';
import type { ExternalAssetResult, MediaProvider, ProvenanceRecord } from './provenance.ts';

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<{ok:boolean;status?:number;json():Promise<any>;arrayBuffer?():Promise<ArrayBuffer>}>;
export interface WikimediaProviderOptions { fetch?: FetchLike }
function text(value:unknown):string|undefined { if(typeof value!=='string'||!value.trim()) return undefined; return value.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim(); }
function commercialAllowed(license:string):boolean|null {
 const value=license.toLowerCase();
 if(/noncommercial|\bnc\b/.test(value)) return false;
 if(/cc0|public domain|cc by(?:-|\s)|attribution|cc-by|cc by-sa|cc-by-sa/.test(value)) return true;
 return null;
}
function attributionRequired(license:string):boolean { const value=license.toLowerCase(); return !(/cc0|public domain/.test(value)); }

function assertTrustedDownloadUrl(value:string):URL {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='upload.wikimedia.org') throw new Error('Wikimedia download URL must use HTTPS on trusted Wikimedia host upload.wikimedia.org');
 return url;
}

export class WikimediaCommonsProvider implements MediaProvider {
 readonly id='wikimedia-commons';
 #fetch:FetchLike;
 constructor(options:WikimediaProviderOptions={}){this.#fetch=options.fetch??(globalThis.fetch as unknown as FetchLike);if(!this.#fetch)throw new Error('fetch is required for Wikimedia Commons provider');}
 async #request(params:Record<string,string>):Promise<any>{
  const url=new URL('https://commons.wikimedia.org/w/api.php'); for(const [k,v] of Object.entries(params))url.searchParams.set(k,v); url.searchParams.set('format','json'); url.searchParams.set('origin','*');
  const response=await this.#fetch(url); if(!response.ok)throw new Error(`Wikimedia request failed${response.status?` (${response.status})`:''}`); return response.json();
 }
 #map(page:any):ExternalAssetResult|undefined{
  const info=Array.isArray(page?.imageinfo)?page.imageinfo[0]:undefined; if(!info?.url||!info?.descriptionurl)return undefined;
  const meta=info.extmetadata??{}; const license=text(meta.LicenseShortName?.value)??text(meta.UsageTerms?.value)??'unknown'; const creator=text(meta.Artist?.value)??text(meta.Credit?.value);
  const provenance:ProvenanceRecord={provider:this.id,...(creator?{creator}:{}),originalUrl:String(info.descriptionurl),license,commercialAllowed:commercialAllowed(license),attributionRequired:attributionRequired(license),retrievedAt:new Date().toISOString()};
  return {id:String(page.pageid??page.title),title:String(page.title??'Wikimedia asset'),previewUrl:info.thumburl?String(info.thumburl):String(info.url),downloadUrl:String(info.url),provenance};
 }
 async search(query:string):Promise<ExternalAssetResult[]>{
  const data=await this.#request({action:'query',generator:'search',gsrsearch:`filetype:bitmap ${query}`,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'640'});
  return Object.values(data?.query?.pages??{}).map(page=>this.#map(page)).filter((value):value is ExternalAssetResult=>Boolean(value));
 }
 async inspect(id:string):Promise<ExternalAssetResult>{
  const data=await this.#request({action:'query',pageids:id,prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'640'}); const page=Object.values(data?.query?.pages??{})[0]; const mapped=this.#map(page); if(!mapped)throw new Error(`Wikimedia asset not found: ${id}`); return mapped;
 }
 async download(asset:ExternalAssetResult,destination:string):Promise<string>{
  const trustedUrl=assertTrustedDownloadUrl(asset.downloadUrl);
  const response=await this.#fetch(trustedUrl); if(!response.ok||!response.arrayBuffer)throw new Error(`Wikimedia download failed${response.status?` (${response.status})`:''}`); await writeFile(destination,Buffer.from(await response.arrayBuffer())); return destination;
 }
}

const forbidden=new Set(['apikey','apitoken','token','accesstoken','refreshtoken','secret','clientsecret','password','authorization','bearertoken','privatekey']);
function normalized(name:string):string{return name.toLowerCase().replace(/[^a-z0-9]/g,'');}
export function assertNoCredentialFields(value:unknown,path='project'):void {
 if(Array.isArray(value)){value.forEach((item,i)=>assertNoCredentialFields(item,`${path}[${i}]`));return;}
 if(!value||typeof value!=='object')return;
 for(const [key,child] of Object.entries(value as Record<string,unknown>)){
  if(forbidden.has(normalized(key)))throw new Error(`Credential/secret field ${path}.${key} must not be persisted in project data`);
  assertNoCredentialFields(child,`${path}.${key}`);
 }
}

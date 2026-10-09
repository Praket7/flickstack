export class McpDesktopClient {
  constructor(endpoint='http://127.0.0.1:7777/mcp', fetchImpl=globalThis.fetch?.bind(globalThis)) {
    if (typeof fetchImpl !== 'function') throw new Error('fetch is required');
    this.endpoint=endpoint;this.fetchImpl=fetchImpl;this.nextId=1;
  }
  async rpc(method,params={}) {
    const id=this.nextId++;
    const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
    if(!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    const payload=await response.json();
    if(payload.error) throw new Error(payload.error.message??'MCP request failed');
    if(payload.result?.isError) throw new Error(payload.result.content?.[0]?.text??'FlickSmith tool failed');
    return payload.result;
  }
  async initialize(){return this.rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'flicksmith-desktop',version:'0.4.0'}});}
  async listTools(){const r=await this.rpc('tools/list');return r.tools??[];}
  async callTool(name,args={}){const r=await this.rpc('tools/call',{name,arguments:args});return r.structuredContent??r.content?.[0]?.text??r;}
  getTimeline(){return this.callTool('get_timeline',{});}
}

export async function startDesktopProject(invoke,projectPath,fetchImpl=globalThis.fetch?.bind(globalThis)) {
  if(typeof invoke!=='function') throw new Error('Tauri invoke bridge unavailable');
  if(typeof projectPath!=='string'||projectPath.trim()==='') throw new Error('Project path is required');
  const session=await invoke('start_project_session',{projectPath:projectPath.trim()});
  const client=new McpDesktopClient(session.endpoint,fetchImpl);await client.initialize();
  return{...session,client};
}

import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { parseProjectV3 } from '../../../packages/schema/src/v3/parse.ts';
import { JobScheduler } from '../../../packages/jobs/src/scheduler.ts';
import { JobStore } from '../../../packages/jobs/src/store.ts';
import { GenerationProviderRegistry, GenerationRuntime, OpenAIImageProvider } from '../../../packages/generation/src/index.ts';
import { buildCreativeActionPlan } from '../../../packages/agent/src/director.ts';
import { validateCreativeActionPlan } from '../../../packages/agent/src/actions.ts';
import { planResponsiveVariants } from '../../../packages/agent/src/variants.ts';
import { planRepairs } from '../../../packages/agent/src/repair.ts';
import { buildCraftDirection, evaluateHumanCraft } from '../../../packages/creative-quality/src/index.ts';
import { v3ToolCatalog, type McpTool } from './tools.ts';
import { V3FlickSmithHost } from './host-v3.ts';

const protocolVersion = '2025-06-18';
const projectPath = resolve(process.env.FLICKSMITH_PROJECT ?? 'project.flick.json');

const extraTools: McpTool[] = [
  { name:'build_craft_direction', description:'Build a brand-specific human-crafted visual and sound grammar that explicitly rejects generic AI-ad defaults.', inputSchema:{ type:'object', required:['brand','audience','objective'], properties:{ brand:{type:'string'}, audience:{type:'string'}, objective:{type:'string'}, references:{type:'array',items:{type:'string'}} }, additionalProperties:false } },
  { name:'review_human_craft', description:'Score an edit for template repetition, decorative motion, transition spam, mechanical pacing, generic typography, weak sound design, and lack of brand-specific decisions.', inputSchema:{ type:'object', required:['shots','typographyStyles','soundEvents','brandSpecificChoices'], properties:{ shots:{type:'array',items:{type:'object'}}, typographyStyles:{type:'array',items:{type:'string'}}, soundEvents:{type:'array',items:{type:'string'}}, brandSpecificChoices:{type:'number'} }, additionalProperties:false } },
  { name:'create_creative_action_plan', description:'Create an evidence-first creative action plan. Existing source media is preferred; generation is used only for justified coverage gaps.', inputSchema:{ type:'object', required:['input'], properties:{ input:{type:'object'} }, additionalProperties:false } },
  { name:'validate_creative_plan', description:'Validate a declarative creative action plan and reject cycles, executable payloads, unsafe generation rationale, or invalid dependencies.', inputSchema:{ type:'object', required:['plan','context'], properties:{ plan:{type:'object'}, context:{type:'object'} }, additionalProperties:false } },
  { name:'plan_campaign_variants', description:'Plan responsive campaign variants that preserve semantic/locked layers and reuse existing assets by default.', inputSchema:{ type:'object', required:['input'], properties:{ input:{type:'object'} }, additionalProperties:false } },
  { name:'map_qc_repairs', description:'Map QC failures to localized declarative repair actions instead of global regeneration.', inputSchema:{ type:'object', required:['issues'], properties:{ issues:{type:'array',items:{type:'object'}}, allowRegeneration:{type:'boolean'} }, additionalProperties:false } },
];
const tools = [...v3ToolCatalog, ...extraTools];

function mediaType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    default: return 'image/png';
  }
}
function loadProject() { return parseProjectV3(JSON.parse(readFileSync(projectPath,'utf8'))); }
function creativeValidationContext(input: any) {
  return {
    assetIds: new Set<string>(Array.isArray(input?.assetIds) ? input.assetIds.map(String) : []),
    compositionIds: new Set<string>(Array.isArray(input?.compositionIds) ? input.compositionIds.map(String) : []),
    beatIds: new Set<string>(Array.isArray(input?.beatIds) ? input.beatIds.map(String) : []),
    motionStyleIds: new Set<string>(Array.isArray(input?.motionStyleIds) ? input.motionStyleIds.map(String) : []),
    providers: Array.isArray(input?.providers) ? input.providers : [],
  };
}

let scheduler: JobScheduler | undefined;
let generation: GenerationRuntime | undefined;
if (process.env.OPENAI_API_KEY) {
  const registry = new GenerationProviderRegistry();
  registry.register(new OpenAIImageProvider({ resolveInputAsset: async (assetId) => {
    const project = loadProject();
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new Error(`Unknown input asset ${assetId}`);
    const uri = String((asset as any).uri ?? (asset as any).path ?? '');
    if (!uri) throw new Error(`Input asset ${assetId} has no local URI`);
    const path = resolve(dirname(projectPath), uri);
    return { bytes: readFileSync(path), mediaType: mediaType(path) };
  }}));
  scheduler = new JobScheduler(new JobStore(), { cpu:1, io:2, gpu:1, model:1 });
  generation = new GenerationRuntime({ registry, scheduler, stagingRoot: resolve(dirname(projectPath), '.flick/staging') });
}

async function callTool(name: string, args: any): Promise<unknown> {
  if (name === 'build_craft_direction') return buildCraftDirection(args);
  if (name === 'review_human_craft') return evaluateHumanCraft(args);
  if (name === 'create_creative_action_plan') return buildCreativeActionPlan(args.input);
  if (name === 'validate_creative_plan') return validateCreativeActionPlan(args.plan, creativeValidationContext(args.context));
  if (name === 'plan_campaign_variants') return planResponsiveVariants(loadProject(), args.input);
  if (name === 'map_qc_repairs') return planRepairs(args.issues, loadProject(), { allowRegeneration: args.allowRegeneration === true });

  const project = loadProject();
  const host = new V3FlickSmithHost({ project, projectPath, permittedRoots:[dirname(projectPath),process.cwd()], generation, generationAssetRoot: resolve(dirname(projectPath), '.flick/generated') });
  try {
    const result = await host.call(name, args);
    if (name === 'generate_asset' && scheduler) void scheduler.runUntilIdle();
    return result;
  } finally { host.close(); }
}

function send(value: unknown): void { process.stdout.write(`${JSON.stringify(value)}\n`); }
function error(id: unknown, code: number, message: string): void { send({ jsonrpc:'2.0', id, error:{ code, message } }); }

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const raw = buffer.slice(0,newline).trim(); buffer = buffer.slice(newline + 1);
    if (!raw) continue;
    void (async () => {
      let message: any;
      try { message = JSON.parse(raw); } catch { error(null,-32700,'Parse error'); return; }
      const id = message.id;
      try {
        if (message.method === 'initialize') {
          send({ jsonrpc:'2.0', id, result:{ protocolVersion: message.params?.protocolVersion ?? protocolVersion, capabilities:{ tools:{ listChanged:false } }, serverInfo:{ name:'flicksmith', version:'0.5.0' }, instructions:'Use get_timeline before project mutations. Preserve expectedRevision. Prefer existing evidence over generation. Run review_human_craft before final delivery.' } });
          return;
        }
        if (message.method === 'notifications/initialized') return;
        if (message.method === 'ping') { send({ jsonrpc:'2.0', id, result:{} }); return; }
        if (message.method === 'tools/list') { send({ jsonrpc:'2.0', id, result:{ tools: tools.map((tool) => ({ name:tool.name, description:tool.description, inputSchema:tool.inputSchema })) } }); return; }
        if (message.method === 'tools/call') {
          const name = String(message.params?.name ?? '');
          if (!tools.some((tool) => tool.name === name)) { error(id,-32602,`Unknown FlickSmith tool ${name}`); return; }
          const result = await callTool(name, message.params?.arguments ?? {});
          send({ jsonrpc:'2.0', id, result:{ content:[{ type:'text', text:JSON.stringify(result) }], structuredContent: result } });
          return;
        }
        error(id,-32601,`Method not found: ${String(message.method)}`);
      } catch (cause) { error(id,-32000,cause instanceof Error ? cause.message : String(cause)); }
    })();
  }
});

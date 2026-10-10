import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';

test('portable plugin declares a local FlickSmith MCP server', () => {
  const plugin = JSON.parse(readFileSync('plugin.json','utf8'));
  assert.equal(plugin.mcpServers, './mcp.json');
  const mcp = JSON.parse(readFileSync('mcp.json','utf8'));
  assert.equal(mcp.mcpServers.flicksmith.type, 'stdio');
  assert.ok(existsSync('apps/mcp/src/mcp-stdio.ts'));
});

test('stdio MCP initializes and advertises FlickSmith tools without Codex', async () => {
  const child = spawn(process.execPath, ['--experimental-strip-types','apps/mcp/src/mcp-stdio.ts'], { stdio: ['pipe','pipe','pipe'], env: { ...process.env, FLICKSMITH_PROJECT: 'does-not-need-to-exist-for-list.json' } });
  const lines = createInterface({ input: child.stdout });
  const responses: any[] = [];
  lines.on('line', (line) => { try { responses.push(JSON.parse(line)); } catch {} });
  child.stdin.write(JSON.stringify({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{name:'test',version:'1'} } })+'\n');
  child.stdin.write(JSON.stringify({ jsonrpc:'2.0', method:'notifications/initialized', params:{} })+'\n');
  child.stdin.write(JSON.stringify({ jsonrpc:'2.0', id:2, method:'tools/list', params:{} })+'\n');
  await new Promise((resolve) => setTimeout(resolve, 300));
  child.kill();
  const init = responses.find((r) => r.id === 1);
  const list = responses.find((r) => r.id === 2);
  assert.equal(init?.result?.serverInfo?.name, 'flicksmith');
  assert.ok(list?.result?.tools?.some((tool:any) => tool.name === 'get_timeline'));
  assert.ok(list?.result?.tools?.some((tool:any) => tool.name === 'generate_asset'));
});

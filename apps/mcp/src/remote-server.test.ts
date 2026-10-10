import test from 'node:test';
import assert from 'node:assert/strict';
import { startRemoteMcpServer } from './remote-server.ts';

const token = 'flicksmith-test-token-0123456789abcdef';

test('remote MCP requires bearer auth and serves normal Chat-compatible JSON-RPC', async () => {
  const server = startRemoteMcpServer({ host: '127.0.0.1', port: 0, authToken: token, allowedOrigins: ['https://chatgpt.com'] });
  const { port } = await server.ready;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);

    const denied = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    assert.equal(denied.status, 401);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'https://chatgpt.com' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.id, 2);
    assert.ok(Array.isArray(body.result.tools));
    assert.ok(body.result.tools.length > 10);
  } finally {
    await server.close();
  }
});

test('remote MCP rejects unapproved browser origins before tool execution', async () => {
  const server = startRemoteMcpServer({ host: '127.0.0.1', port: 0, authToken: token, allowedOrigins: ['https://chatgpt.com'] });
  const { port } = await server.ready;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'https://evil.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.close();
  }
});

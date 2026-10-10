import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { activeToolCatalog, createRpcHandler, host as flicksmithHost, type HttpMcpServerHandle } from './server.ts';

export interface RemoteMcpOptions {
  host?: string;
  port?: number;
  authToken: string;
  allowedOrigins?: string[];
  maxBodyBytes?: number;
}

function authorized(header: string | undefined, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7), 'utf8');
  const expected = Buffer.from(token, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function startRemoteMcpServer(options: RemoteMcpOptions): HttpMcpServerHandle {
  if (options.authToken.length < 32) throw new Error('Remote MCP auth token must contain at least 32 characters');
  const bindHost = options.host ?? '0.0.0.0';
  const port = options.port ?? 7777;
  const maxBody = options.maxBodyBytes ?? 1_048_576;
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const handleRpc = createRpcHandler({ host: flicksmithHost, catalog: activeToolCatalog });
  let server: Server;

  const ready = new Promise<{ port: number }>((resolveReady, rejectReady) => {
    server = createServer((req, res) => {
      if (req.url === '/healthz' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, service: 'flicksmith-mcp', version: '0.5.0' }));
        return;
      }
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      if (origin && !allowedOrigins.has(origin)) {
        res.statusCode = 403;
        res.end('origin forbidden');
        return;
      }
      if (origin) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'origin');
      }
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
        res.setHeader('access-control-allow-headers', 'authorization, content-type');
        res.end();
        return;
      }
      if (req.url !== '/mcp') {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('allow', 'POST, OPTIONS');
        res.end('method not allowed');
        return;
      }
      if (!authorized(typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined, options.authToken)) {
        res.statusCode = 401;
        res.setHeader('www-authenticate', 'Bearer');
        res.end('unauthorized');
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let tooLarge = false;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBody) {
          tooLarge = true;
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', async () => {
        if (tooLarge) {
          if (!res.headersSent) {
            res.statusCode = 413;
            res.end('payload too large');
          }
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          res.statusCode = 400;
          res.end('invalid json');
          return;
        }
        try {
          const result = await handleRpc(parsed);
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ jsonrpc: '2.0', id: (parsed as any)?.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } }));
        }
      });
    });
    server.once('error', rejectReady);
    server.listen(port, bindHost, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        rejectReady(new Error('Unable to resolve remote MCP listen address'));
        return;
      }
      resolveReady({ port: address.port });
    });
  });

  return {
    ready,
    close: () => new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

async function runMain(): Promise<void> {
  const authToken = process.env.FLICKSMITH_REMOTE_TOKEN ?? '';
  const port = Number(process.env.PORT ?? process.env.FLICKSMITH_REMOTE_PORT ?? 7777);
  const host = process.env.FLICKSMITH_REMOTE_HOST ?? '0.0.0.0';
  const allowedOrigins = (process.env.FLICKSMITH_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Remote MCP port must be 0..65535');
  const server = startRemoteMcpServer({ host, port, authToken, allowedOrigins });
  const ready = await server.ready;
  process.stdout.write(`${JSON.stringify({ type: 'ready', host, port: ready.port })}\n`);
  const close = async () => {
    try { await server.close(); } finally { flicksmithHost.close?.(); process.exit(0); }
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}

if (import.meta.url === `file://${process.argv[1]}`) void runMain();

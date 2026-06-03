#!/usr/bin/env node
/**
 * Minimal MCP stdio wrapper — invokes `br-runtime` CLI subprocess (ergonomics only).
 * Protocol: newline-delimited JSON-RPC style messages (subset compatible with Cursor MCP hosts).
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.js');

function send(msg: object): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

send({
  jsonrpc: '2.0',
  method: 'tools/list',
  params: {
    tools: [
      {
        name: 'br_runtime_audit',
        description: 'Run BR Runtime Auditor against an SST.md path',
        inputSchema: {
          type: 'object',
          properties: {
            sst_path: { type: 'string' },
            mock: { type: 'boolean' },
          },
          required: ['sst_path'],
        },
      },
    ],
  },
});

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let req: {
    id?: number;
    params?: { name?: string; arguments?: { sst_path?: string; mock?: boolean } };
  };
  try {
    req = JSON.parse(line) as typeof req;
  } catch {
    return;
  }
  if (req.params?.name !== 'br_runtime_audit') return;
  const sstPath = req.params.arguments?.sst_path;
  if (!sstPath) {
    send({ jsonrpc: '2.0', id: req.id, error: { message: 'sst_path required' } });
    return;
  }
  const args = [CLI, sstPath];
  if (req.params.arguments?.mock) args.push('--mock');
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += String(d)));
  child.on('close', (code) => {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: { content: [{ type: 'text', text: out || `exit ${code}` }] },
    });
  });
});

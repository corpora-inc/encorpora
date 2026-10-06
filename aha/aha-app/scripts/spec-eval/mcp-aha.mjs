/**
 * DEV-ONLY spec-eval: a minimal MCP stdio server exposing the eval's function-calling surfaces
 * (tools.mjs) to a LOCAL model CLI (claude -p, codex exec), so they are measured offline.
 * Env: AHA_MODE (intent | check | intent+check), AHA_BAND, AHA_SKILLS (comma list), AHA_COUNT,
 * AHA_ROUNDS, AHA_LOG (JSONL of every call). Never calls Free2Z.
 */
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { toolSession } from './tools.mjs';

const session = toolSession({ mode: process.env.AHA_MODE ?? 'intent', band: process.env.AHA_BAND ?? 'g35',
  skillIds: (process.env.AHA_SKILLS ?? '').split(',').filter(Boolean), count: Number(process.env.AHA_COUNT ?? 4), rounds: Number(process.env.AHA_ROUNDS ?? 2) });
const log = process.env.AHA_LOG;

const send = msg => process.stdout.write(`${JSON.stringify(msg)}\n`);
const rl = createInterface({ input: process.stdin });
rl.on('line', line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications
  if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'aha', version: '0.0.0' } } });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: session.tools.map(({ name, description, parameters }) => ({ name, description, inputSchema: parameters })) } });
  if (method === 'tools/call') {
    let r;
    try { r = session.call(params.name, params.arguments ?? {}); if (r.record && log) appendFileSync(log, `${JSON.stringify(r.record)}\n`); } catch (e) { r = { text: `Tool error: ${e.message}`, isError: true }; }
    return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) } });
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
});

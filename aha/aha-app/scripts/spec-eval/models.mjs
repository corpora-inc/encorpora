/** DEV-ONLY spec-eval: run a LOCAL model CLI (codex exec, else claude -p) as a stand-in for the
 * production model. Never calls Free2Z. Replies are cached on disk keyed by a hash of
 * everything that affects them, so re-runs are free. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const readCalls = f => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

const has = cmd => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;

/** provider: 'codex' | 'claude' | 'auto'. Returns null when nothing usable is installed. */
export function pickProvider(provider = 'auto') {
  if (provider === 'codex' || (provider === 'auto' && has('codex'))) return has('codex') ? 'codex' : null;
  if (provider === 'claude' || provider === 'auto') return has('claude') ? 'claude' : null;
  return null;
}

export function hashKey(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

/** Bounded-concurrency map (order-preserving). */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

function run(cmd, args, { input, timeoutMs, cwd }) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', b => stdout += b);
    child.stderr.on('data', b => stderr += b);
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.end(input);
  });
}

/**
 * One completion. `system` + `user` are the production messages; codex has no system slot in
 * exec mode, so they are framed as a transcript and the model replies as the assistant.
 * `schema` (codex only) constrains the final message — used for the judge, never the author.
 */
/**
 * `mcp` ({ env }) runs the reply with the spec-eval MCP server (mcp-aha.mjs) attached, so the model can
 * call its tools (function-calling arms); the server's env selects the tools. Every reply reports
 * `usage` ({ input, output, turns }) when the CLI gives it: claude's input counts the system prompt and
 * tool schemas; codex's includes its own harness prompt, so compare codex input only between arms.
 */
export async function complete({ provider, model, effort, system, user, schema, images = [], mcp, cacheDir, cacheParts, timeoutMs = 420000, retries = 1 }) {
  const imageHashes = images.map(f => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16));
  const key = hashKey({ provider, model, effort, system, user, schema: schema ?? null, images: imageHashes, ...(mcp ? { mcp: mcp.env } : {}), ...cacheParts });
  const file = path.join(cacheDir, `${key}.txt`);
  const usageFile = path.join(cacheDir, `${key}.usage.json`);
  const cachedUsage = () => existsSync(usageFile) ? JSON.parse(readFileSync(usageFile, 'utf8')) : null;
  if (existsSync(file) && (!mcp || existsSync(path.join(cacheDir, `${key}.calls.jsonl`)))) return { text: readFileSync(file, 'utf8'), cached: true, key, ms: 0, usage: cachedUsage(), calls: mcp ? readCalls(path.join(cacheDir, `${key}.calls.jsonl`)) : undefined };
  mkdirSync(cacheDir, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    // Empty scratch cwd + read-only sandbox: codex cannot write, but it CAN read the host, and the
    // framing tells it not to use tools. Prompts are synthetic (no learner data); claude runs with
    // tools disabled outright.
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'spec-eval-'));
    const started = Date.now();
    try {
      let res, text = '', usage = null;
      const callsFile = path.join(cwd, 'calls.jsonl');
      const server = mcp ? { command: process.execPath, args: ['--import', path.join(ROOT, 'node_modules/tsx/dist/loader.mjs'), path.join(ROOT, 'scripts/spec-eval/mcp-aha.mjs')], env: { ...mcp.env, AHA_LOG: callsFile } } : null;
      if (provider === 'codex') {
        const outFile = path.join(cwd, 'last.txt');
        const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--color', 'never', '--json', '-o', outFile];
        if (server) {
          args.push('-c', `mcp_servers.aha.command=${JSON.stringify(server.command)}`, '-c', `mcp_servers.aha.args=${JSON.stringify(server.args)}`,
            '-c', `mcp_servers.aha.env={${Object.entries(server.env).map(([k, v]) => `${k}=${JSON.stringify(String(v))}`).join(',')}}`, '-c', 'approval_policy="never"');
        }
        if (model) args.push('-m', model);
        if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
        if (schema) { writeFileSync(path.join(cwd, 'schema.json'), JSON.stringify(schema)); args.push('--output-schema', path.join(cwd, 'schema.json')); }
        // Screenshots of the resolved render, for a judge that sees what the learner sees.
        for (const image of images) args.push('-i', image);
        args.push('-');
        const framed = server
          ? `You are standing in for a chat model whose ONLY tools are the "aha" MCP tools. Do not run commands or read files; use only those tools. Below are its SYSTEM and USER messages; act exactly as that model would.\n\n=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}`
          : `You are standing in for a chat model that has no tools. Do not run commands or read files. Below are its SYSTEM and USER messages; reply exactly as that model would, with only the assistant message.\n\n=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}`;
        res = await run('codex', args, { input: framed, timeoutMs, cwd });
        if (existsSync(outFile)) text = readFileSync(outFile, 'utf8');
        for (const line of res.stdout.split('\n')) {
          try { const e = JSON.parse(line); if (e.type === 'turn.completed' && e.usage) usage = { input: e.usage.input_tokens, output: e.usage.output_tokens + (e.usage.reasoning_output_tokens ?? 0), turns: 1 }; } catch {}
        }
      } else {
        if (images.length) throw new Error('spec-eval: image inputs need the codex provider.');
        const args = ['-p', '--output-format', 'json', '--system-prompt', system, '--tools', '', '--strict-mcp-config'];
        if (server) {
          writeFileSync(path.join(cwd, 'mcp.json'), JSON.stringify({ mcpServers: { aha: { type: 'stdio', ...server } } }));
          args.push('--mcp-config', path.join(cwd, 'mcp.json'), '--allowedTools', 'mcp__aha', '--max-turns', '40');
        }
        if (model) args.push('--model', model);
        res = await run('claude', args, { input: user, timeoutMs, cwd });
        try {
          const out = JSON.parse(res.stdout);
          text = typeof out.result === 'string' ? out.result : '';
          if (out.usage) usage = { input: (out.usage.input_tokens ?? 0) + (out.usage.cache_read_input_tokens ?? 0) + (out.usage.cache_creation_input_tokens ?? 0), output: out.usage.output_tokens ?? 0, turns: out.num_turns ?? 1 };
          if (out.is_error && !text) text = '';
        } catch { text = res.stdout; }
      }
      const calls = server ? readCalls(callsFile) : undefined;
      if (res.code === 0 && (text.trim() || calls?.length)) {
        writeFileSync(file, text);
        if (usage) writeFileSync(usageFile, JSON.stringify(usage));
        if (server) writeFileSync(path.join(cacheDir, `${key}.calls.jsonl`), calls.map(c => JSON.stringify(c)).join('\n'));
        return { text, cached: false, key, ms: Date.now() - started, usage, calls };
      }
      const why = `${provider} exited ${res.code}: ${(res.stderr || res.stdout).split('\n').filter(l => /error/i.test(l)).slice(-3).join(' | ').slice(0, 400)}`;
      if (attempt >= retries) return { text: '', cached: false, key, ms: Date.now() - started, error: why };
      console.error(`[spec-eval] retrying after: ${why}`);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
}

/** DEV-ONLY spec-eval: run a LOCAL model CLI (codex exec, else claude -p) as a stand-in for the
 * production model. Never calls Free2Z. Replies are cached on disk keyed by a hash of
 * everything that affects them, so re-runs are free. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
export async function complete({ provider, model, effort, system, user, schema, cacheDir, cacheParts, timeoutMs = 420000, retries = 1 }) {
  const key = hashKey({ provider, model, effort, system, user, schema: schema ?? null, ...cacheParts });
  const file = path.join(cacheDir, `${key}.txt`);
  if (existsSync(file)) return { text: readFileSync(file, 'utf8'), cached: true, key, ms: 0 };
  mkdirSync(cacheDir, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    // Empty scratch cwd + read-only sandbox: codex cannot write, but it CAN read the host, and the
    // framing tells it not to use tools. Prompts are synthetic (no learner data); claude runs with
    // tools disabled outright.
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'spec-eval-'));
    const started = Date.now();
    try {
      let res, text = '';
      if (provider === 'codex') {
        const outFile = path.join(cwd, 'last.txt');
        const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--color', 'never', '-o', outFile];
        if (model) args.push('-m', model);
        if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
        if (schema) { writeFileSync(path.join(cwd, 'schema.json'), JSON.stringify(schema)); args.push('--output-schema', path.join(cwd, 'schema.json')); }
        args.push('-');
        const framed = `You are standing in for a chat model that has no tools. Do not run commands or read files. Below are its SYSTEM and USER messages; reply exactly as that model would, with only the assistant message.\n\n=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}`;
        res = await run('codex', args, { input: framed, timeoutMs, cwd });
        if (existsSync(outFile)) text = readFileSync(outFile, 'utf8');
      } else {
        const args = ['-p', '--output-format', 'text', '--system-prompt', system, '--tools', '', '--strict-mcp-config'];
        if (model) args.push('--model', model);
        res = await run('claude', args, { input: user, timeoutMs, cwd });
        text = res.stdout;
      }
      if (res.code === 0 && text.trim()) {
        writeFileSync(file, text);
        return { text, cached: false, key, ms: Date.now() - started };
      }
      const why = `${provider} exited ${res.code}: ${(res.stderr || res.stdout).split('\n').filter(l => /error/i.test(l)).slice(-3).join(' | ').slice(0, 400)}`;
      if (attempt >= retries) return { text: '', cached: false, key, ms: Date.now() - started, error: why };
      console.error(`[spec-eval] retrying after: ${why}`);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
}

/** DEV-ONLY: review the AI activities a learner flagged ("Something seems off") on an attached debug build.
 * Copies the app DB off the device READ-ONLY (adb exec-out run-as … cat; nothing is written to, tapped
 * on or launched on the device), joins each dispute to its stored Activity Spec and re-renders the spec
 * in the real focus stage (src/activity/gallery/stage.html, compact ActivityView) at the phone viewport
 * 384×832, light. Writes .flag-review/<timestamp>/{index.html, flags.json, *.png} (gitignored).
 *   npm run flag-review [-- --serial <id>] [--since <iso>] [--all-ai]      (ANDROID_SERIAL also works) */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';
import { collectEntries, parseArgs } from './flag-review/records.mjs';

const APP = 'inc.corpora.aha';
const DB = 'learning.sqlite3';
const root = fileURLToPath(new URL('..', import.meta.url));
const sdkAdb = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const ADB = process.env.ADB || (existsSync(sdkAdb) ? sdkAdb : 'adb');
const fail = message => { console.error(`flag-review: ${message}`); process.exit(1); };
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let opts;
try { opts = parseArgs(process.argv.slice(2), process.env); } catch (e) { fail(e.message); }

// --- 1. Device: exactly one target, the app installed as a debuggable build. ---
const adbRun = (args, encoding = 'utf8') => execFileSync(ADB, args, { encoding, maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
let listing;
try { listing = adbRun(['devices']); } catch (e) { fail(`cannot run adb (${ADB}): ${e.message}. Install platform-tools or set ADB=/path/to/adb.`); }
const devices = listing.split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(p => p[0]);
const ready = devices.filter(([, state]) => state === 'device').map(([id]) => id);
if (opts.serial) {
  const found = devices.find(([id]) => id === opts.serial);
  if (!found) fail(`device ${opts.serial} is not attached. Attached: ${devices.map(d => d.join(' ')).join(', ') || 'none'}.`);
  if (found[1] !== 'device') fail(`device ${opts.serial} is "${found[1]}" (authorize USB debugging on the phone).`);
} else if (!ready.length) fail(`no Android device attached${devices.length ? ` (${devices.map(d => d.join(' ')).join(', ')})` : ''}. Plug in the phone with USB debugging on.`);
else if (ready.length > 1) fail(`${ready.length} devices attached (${ready.join(', ')}); pick one with --serial <id> or ANDROID_SERIAL.`);
const serial = opts.serial ?? ready[0];
const onDevice = args => adbRun(['-s', serial, ...args]);
let files;
try { files = onDevice(['shell', 'run-as', APP, 'ls']).split(/\s+/); } catch (e) {
  const why = `${e.stderr ?? ''}${e.stdout ?? ''}`.trim();
  if (/not debuggable/i.test(why)) fail(`${APP} on ${serial} is not a debug build (run-as refused: ${why}). Install a debug APK (README → Device loop).`);
  if (/unknown package|not installed|package.*not found/i.test(why)) fail(`${APP} is not installed on ${serial}.`);
  fail(`run-as ${APP} failed on ${serial}: ${why || e.message}`);
}
if (!files.includes(DB)) fail(`${APP} on ${serial} has no ${DB} yet (open the app once).`);

// --- 2. Copy the DB (+ WAL and shared-memory index, which hold the newest rows) and read it read-only. ---
const copy = mkdtempSync(path.join(os.tmpdir(), 'aha-flag-review-'));
for (const name of [DB, `${DB}-wal`, `${DB}-shm`]) {
  if (name !== DB && !files.includes(name)) continue;
  writeFileSync(path.join(copy, name), adbRun(['-s', serial, 'exec-out', 'run-as', APP, 'cat', name], 'buffer'));
}
if (readFileSync(path.join(copy, DB)).subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') fail(`the copied ${DB} is not a SQLite file (see ${copy}).`);
const db = new DatabaseSync(path.join(copy, DB), { readOnly: true });
const entries = collectEntries(db, opts);
db.close();
const what = opts.allAi ? 'AI activities (flagged or not)' : 'flags';
console.log(`${entries.length} ${what}${opts.since ? ` since ${opts.since}` : ''} on ${serial} (DB copy: ${copy})`);

// --- 3. Render each spec in the real focus stage. ---
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, '.flag-review', stamp);
mkdirSync(out, { recursive: true });
const toRender = entries.filter(e => e.spec);
if (toRender.length) {
  const port = 1439;
  const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; vite.stdout.on('data', b => log += b); vite.stderr.on('data', b => log += b);
  const base = `http://127.0.0.1:${port}/src/activity/gallery/stage.html`;
  let browser;
  try {
    for (let i = 0; ; i++) {
      if (vite.exitCode !== null) throw new Error(`Vite exited: ${log}`);
      if (i > 300) throw new Error(`Vite did not start: ${log}`);
      try { if (stripVTControlCharacters(log).includes(`127.0.0.1:${port}`) && (await fetch(base)).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({ headless: true });
    // The S26 CSS viewport and density verify-ui holds the focus stage to.
    const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2.8125, isMobile: true, hasTouch: true, colorScheme: 'light' });
    for (const [n, entry] of toRender.entries()) {
      const page = await context.newPage();
      entry.renderErrors = [];
      page.on('pageerror', e => entry.renderErrors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') entry.renderErrors.push(m.text()); });
      await page.addInitScript(spec => { window.__stageSpec = spec; }, entry.spec);
      try {
        await page.goto(base);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.locator('.aha-activity.is-compact').waitFor({ timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        entry.shot = `${String(n + 1).padStart(2, '0')}-${(entry.flaggedAt ?? entry.activityCreatedAt ?? 'x').replace(/[:.]/g, '-')}.png`;
        await page.screenshot({ path: path.join(out, entry.shot) });
      } catch (e) { entry.renderErrors.push(`render failed: ${e.message.split('\n')[0]}`); }
      await page.close();
    }
  } finally {
    await browser?.close();
    vite.kill();
  }
}

// --- 4. flags.json (raw specs for the must-reject corpus) + a contact sheet. ---
writeFileSync(path.join(out, 'flags.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), serial, since: opts.since ?? null, allAi: opts.allAi, entries }, null, 2)}\n`);
const when = t => t ? esc(t.replace('T', ' ').replace(/\.\d+Z$/, 'Z')) : '—';
const card = e => `<article class="${e.flagged ? 'flagged' : ''}">
  <div class="shot">${e.shot ? `<a href="${esc(e.shot)}"><img src="${esc(e.shot)}" alt="${esc(e.prompt)}"></a>` : `<p class="none">${e.localTask ? 'Local task (not an Activity Spec), not rendered' : 'No stored activity to render'}</p>`}</div>
  <div class="meta">
    <h2>${e.flagged ? 'Flagged' : 'Not flagged'} <small>${esc(e.spec?.title ?? e.prompt ?? e.activityId)}</small></h2>
    <dl><dt>Flagged</dt><dd>${when(e.flaggedAt)}</dd><dt>Shown</dt><dd>${when(e.activityCreatedAt)}</dd>
    <dt>Model</dt><dd>${e.model ? esc(e.model) : e.source === 'ai-spec' ? '<i>not recorded (before #905)</i>' : '—'}</dd>
    <dt>Skill</dt><dd>${esc(e.skillIds.join(', ') || '—')}</dd><dt>Activity</dt><dd><code>${esc(e.activityId)}</code> · ${esc(e.source)} · ${esc(e.profile)}</dd></dl>
    ${e.renderErrors?.length ? `<p class="err">${e.renderErrors.map(esc).join('<br>')}</p>` : ''}
    <pre>${esc(JSON.stringify(e.spec ?? e.localTask, null, 2))}</pre>
  </div></article>`;
writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AHA flag review</title>
<style>body{font:14px system-ui;margin:24px;background:#eeede6;color:#263d35}h1{font-size:20px}article{display:flex;gap:20px;align-items:flex-start;background:#fff;border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 4px #0001}
article.flagged{border-left:5px solid #c2593a}.shot{flex:none;width:300px}.shot img{width:300px;display:block;border-radius:10px;box-shadow:0 2px 8px #0002}.none{color:#7a7a70;font-style:italic}
.meta{min-width:0;flex:1}h2{font-size:16px;margin:0 0 8px}h2 small{font-weight:400;color:#5f6a5c}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0 0 10px}dt{color:#5f6a5c}dd{margin:0}
pre{background:#f6f5ef;border-radius:8px;padding:10px;font-size:12px;overflow:auto;max-height:560px;white-space:pre-wrap}.err{color:#a3361b}@media(max-width:760px){article{flex-direction:column}}</style>
<h1>AHA flag review · ${entries.length} ${what}</h1>
<p>Device ${esc(serial)} · generated ${when(new Date().toISOString())}${opts.since ? ` · since ${when(opts.since)}` : ''} · each spec re-rendered in the focus stage at 384×832, light · raw specs in <a href="flags.json">flags.json</a></p>
${entries.length ? entries.map(card).join('\n') : '<p>No flags on this device.</p>'}`);
const broken = entries.filter(e => e.renderErrors?.length);
console.log(`Contact sheet: ${path.join(out, 'index.html')}`);
if (broken.length) { console.log(`${broken.length} spec(s) had render errors; see the contact sheet.`); process.exitCode = 1; }

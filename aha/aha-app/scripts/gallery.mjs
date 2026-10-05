/** DEV-ONLY: screenshot every Activity Spec TEST FIXTURE at phone/tablet/desktop, light/dark.
 * Writes PNGs + a contact sheet to .gallery/ (gitignored). Usage: npm run gallery [-- fixture-id ...] */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '.gallery');
const port = 1437;
const { fixtures: v1Fixtures } = await import(path.join(root, 'src/activity/fixtures/index.ts'));
const { goldResolved } = await import(path.join(root, 'src/activity/v2/gold/resolved.ts'));
// v1 TEST FIXTURES, then v2 gold specs resolved through the v2 validator (both hand-authored).
const fixtures = [...v1Fixtures, ...goldResolved()];
const wanted = process.argv.slice(2).filter(a => !a.startsWith('-'));
const list = wanted.length ? fixtures.filter(f => wanted.includes(f.id)) : fixtures;
const viewports = [['phone', 390, 844], ['tablet', 820, 1180], ['desktop', 1280, 800]];
const themes = ['light', 'dark'];
const extraStates = process.argv.includes('--states') ? ['answered', 'hints'] : [];

if (!wanted.length) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; vite.stdout.on('data', b => log += b); vite.stderr.on('data', b => log += b);
const base = `http://127.0.0.1:${port}/src/activity/gallery/index.html`;
let browser;
try {
  for (let i = 0; i < 150; i++) {
    if (vite.exitCode !== null) throw new Error(`Vite exited: ${log}`);
    try { if (stripVTControlCharacters(log).includes(`127.0.0.1:${port}`) && (await fetch(base)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true });
  const problems = [];
  const shots = [];
  for (const [vpName, width, height] of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: vpName === 'desktop' ? 1 : 2, colorScheme: theme });
      const page = await context.newPage();
      page.on('pageerror', e => problems.push(`${vpName}/${theme}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') problems.push(`${vpName}/${theme}: ${m.text()}`); });
      for (const spec of list) {
        for (const state of ['', ...(vpName === 'desktop' && theme === 'light' ? extraStates : [])]) {
          await page.goto(`${base}?fixture=${spec.id}&theme=${theme}${state ? `&state=${state}` : ''}`);
          await page.locator('.aha-activity').waitFor();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(60);
          // Overflow audit: anything wider than its card, or horizontal page scroll.
          const overflow = await page.evaluate(() => {
                        const bad = [];
            if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px)`);
            const name = el => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]}`;
            for (const el of document.querySelectorAll('.aha-activity *')) {
              const r = el.getBoundingClientRect();
              if (!r.width || el.closest('.ax-table-wrap') || el.closest('.katex')) continue;
              // Compare against the card, the figure panel and any picture-group card that contains it.
              for (const box of [document.querySelector('.aha-activity'), el.parentElement?.closest('.ax-figure'), el.parentElement?.closest('.ax-pic-group')]) {
                if (!box) continue;
                const b = box.getBoundingClientRect();
                const over = Math.max(r.right - b.right, b.left - r.left);
                if (over > 1.5) bad.push(`${name(el)} overflows ${name(box)} by ${Math.round(over)}px`);
              }
            }
            return [...new Set(bad)].slice(0, 5);
          });
          overflow.forEach(o => problems.push(`${spec.id} ${vpName}/${theme}: ${o}`));
          const file = `${spec.id}--${vpName}-${theme}${state ? `-${state}` : ''}.png`;
          await page.locator('section').screenshot({ path: path.join(out, file) });
          shots.push({ id: spec.id, vp: vpName, theme, state, file });
        }
      }
      await context.close();
    }
  }
  const byFixture = Object.groupBy(shots, s => s.id);
  const html = `<!doctype html><meta charset="utf-8"><title>Activity gallery</title>
<style>body{font:14px system-ui;margin:24px;background:#e9e8df;color:#263d35}h2{font:600 16px system-ui;margin:28px 0 8px}
.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:8px}figure{margin:0;flex:none}figcaption{font-size:12px;color:#5f6a5c;margin-bottom:4px}
img{display:block;border-radius:8px;box-shadow:0 2px 8px #0002}.phone img{width:195px}.tablet img{width:300px}.desktop img{width:420px}
.problems{background:#fff3e8;border:1px solid #e9c7b0;padding:12px;border-radius:8px;white-space:pre-wrap}</style>
<h1>Activity Spec gallery: v1 TEST FIXTURES and v2 gold specs (hand-authored, not AI output)</h1>
<p>${shots.length} screenshots · ${list.length} fixtures · generated ${new Date().toISOString()}</p>
${problems.length ? `<div class="problems"><strong>Audit findings</strong>\n${problems.map(p => p.replace(/</g, '&lt;')).join('\n')}</div>` : '<p>Overflow and console audit: clean.</p>'}
${Object.entries(byFixture).map(([id, s]) => `<h2>${id}</h2><div class="row">${s.map(x => `<figure class="${x.vp}"><figcaption>${x.vp} · ${x.theme}${x.state ? ` · ${x.state}` : ''}</figcaption><a href="${x.file}"><img loading="lazy" src="${x.file}"></a></figure>`).join('')}</div>`).join('\n')}`;
  writeFileSync(path.join(out, 'index.html'), html);
  console.log(`Wrote ${shots.length} screenshots to ${out}/index.html`);
  if (problems.length) { console.log(`Audit findings (${problems.length}):\n${problems.join('\n')}`); process.exitCode = 1; }
} finally {
  await browser?.close();
  vite.kill();
}

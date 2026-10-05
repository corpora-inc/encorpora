/** DEV-ONLY visual sweep of every studio screen and state outside the activity format
 * (src/ui/gallery, TEST FIXTURE props) at five viewports, light and dark, motion on and reduced.
 * Writes PNGs, one contact sheet per scenario (sheets/<id>.png) and index.html to .sweep/<label>/
 * (gitignored). Also audits horizontal overflow, text clipped by its box, and console errors.
 * Usage: npm run sweep -- [--label before] [--only home-new,focus-ai] [--vp 384x832,820x1180] [--reduced] */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const label = arg('label') ?? 'latest';
const only = arg('only')?.split(',');
const motions = process.argv.includes('--reduced') ? ['full', 'reduced'] : ['full'];
const out = path.join(root, '.sweep', label);
const port = Number(process.env.AHA_SWEEP_PORT || 1439);
const viewports = [['360x640', 360, 640, 2], ['384x832', 384, 832, 2], ['412x915', 412, 915, 2], ['820x1180', 820, 1180, 1], ['1280x800', 1280, 800, 1]];
const schemes = ['light', 'dark'];
const onlyVp = arg('vp')?.split(',');

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, 'sheets'), { recursive: true });
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; vite.stdout.on('data', b => log += b); vite.stderr.on('data', b => log += b);
const base = `http://127.0.0.1:${port}/src/ui/gallery/index.html`;
let browser;
try {
  for (let i = 0; i < 150; i++) {
    if (vite.exitCode !== null) throw new Error(`Vite exited: ${log}`);
    try { if (stripVTControlCharacters(log).includes(`127.0.0.1:${port}`) && (await fetch(base)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true });
  const probe = await browser.newPage();
  await probe.goto(base); await probe.waitForFunction(() => window.__scenarios);
  const ids = (await probe.evaluate(() => window.__scenarios)).filter(id => !only || only.includes(id));
  await probe.close();
  const problems = [], shots = [];
  for (const [vp, width, height, scale] of viewports.filter(([v]) => !onlyVp || onlyVp.includes(v))) for (const scheme of schemes) for (const motion of motions) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme, reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference', isMobile: width < 700, hasTouch: width < 900 });
    const page = await context.newPage();
    let current = '';
    page.on('pageerror', e => problems.push(`${current} ${vp}/${scheme}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('gallery:'))) problems.push(`${current} ${vp}/${scheme}: ${m.text()}`); });
    for (const id of ids) {
      current = id;
      await page.goto(`${base}?s=${id}`);
      await page.waitForFunction(() => window.__ready, null, { timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      const audit = await page.evaluate(() => {
        const bad = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px)`);
        const name = el => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]}`;
        for (const el of document.querySelectorAll('body *')) {
          if (!el.checkVisibility?.() || el.closest('.katex, .sr-only, svg, .stage-scroll, .ax-stage-scroll, .help-text, textarea')) continue;
          const s = getComputedStyle(el);
          if (['hidden', 'clip'].includes(s.overflowX) && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== "ellipsis" && el.clientWidth > 2) bad.push(`${name(el)} clips its content (${el.scrollWidth} > ${el.clientWidth})`);
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 1 || r.left < -1) && s.position !== 'fixed' && !el.closest('dialog:not([open])')) bad.push(`${name(el)} leaves the viewport`);
        }
        return [...new Set(bad)].slice(0, 6);
      });
      audit.forEach(a => problems.push(`${id} ${vp}/${scheme}: ${a}`));
      const file = `${id}--${vp}-${scheme}${motion === 'reduced' ? '-reduced' : ''}.png`;
      await page.screenshot({ path: path.join(out, file) });
      shots.push({ id, vp, scheme, motion, file });
    }
    await context.close();
  }
  // One contact sheet per scenario: every viewport and scheme side by side, at a common height.
  const sheet = await browser.newPage({ viewport: { width: 2400, height: 900 } });
  const byId = Object.groupBy(shots, s => s.id);
  for (const [id, list] of Object.entries(byId)) {
    const html = `<!doctype html><style>body{margin:0;padding:12px;background:#8a8a84;font:13px system-ui;display:flex;gap:10px;align-items:flex-start;width:max-content}
figure{margin:0}figcaption{color:#fff;margin-bottom:4px}img{display:block;height:560px;border-radius:6px}.wide img{height:420px}</style>
${list.map(s => `<figure class="${s.vp.startsWith('1280') || s.vp.startsWith('820') ? 'wide' : ''}"><figcaption>${id} ${s.vp} ${s.scheme}${s.motion === 'reduced' ? ' reduced' : ''}</figcaption><img src="file://${path.join(out, s.file)}"></figure>`).join('')}`;
    const f = path.join(out, `sheet-${id}.html`);
    writeFileSync(f, html);
    await sheet.goto(`file://${f}`);
    await sheet.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await sheet.locator('body').screenshot({ path: path.join(out, 'sheets', `${id}.png`) });
    rmSync(f);
  }
  writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Studio sweep ${label}</title>
<style>body{font:14px system-ui;margin:24px}img{max-width:100%;margin:8px 0 24px}pre{background:#fff3e8;padding:12px}</style>
<h1>Studio sweep: ${label} (TEST FIXTURE props)</h1><p>${shots.length} screenshots · ${new Date().toISOString()}</p>
${problems.length ? `<pre>${problems.join('\n').replace(/</g, '&lt;')}</pre>` : '<p>Audit clean.</p>'}
${Object.keys(byId).map(id => `<h2>${id}</h2><img src="sheets/${id}.png">`).join('\n')}`);
  console.log(`Wrote ${shots.length} screenshots and ${Object.keys(byId).length} sheets to ${out}`);
  if (problems.length) { console.log(`Audit findings (${problems.length}):\n${problems.join('\n')}`); process.exitCode = 1; }
} finally {
  await browser?.close();
  vite.kill();
}

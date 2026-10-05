/** DEV-ONLY spec-eval: screenshot every valid spec at phone size (light) inside the studio's focus
 * stage (the surface learners see) and write a contact sheet grouped by learner state. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';
import { JUDGE_CRITERIA } from './analyze.mjs';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function screenshotSpecs(root, outDir, batches, { port = 1438 } = {}) {
  const shotsDir = path.join(outDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });
  const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; vite.stdout.on('data', b => log += b); vite.stderr.on('data', b => log += b);
  const base = `http://127.0.0.1:${port}/scripts/spec-eval/page/index.html`;
  let browser;
  const problems = [];
  try {
    for (let i = 0; i < 150; i++) {
      if (vite.exitCode !== null) throw new Error(`Vite exited: ${log}`);
      try { if (stripVTControlCharacters(log).includes(`127.0.0.1:${port}`) && (await fetch(base)).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({ headless: true });
    // The S26 CSS viewport verify-ui uses for the focus-stage pass bar.
    const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
    for (const batch of batches) {
      for (const item of batch.items.filter(i => i.ok)) {
        const page = await context.newPage();
        const where = `${batch.state}/${item.id}`;
        page.on('pageerror', e => problems.push(`${where}: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') problems.push(`${where}: ${m.text()}`); });
        await page.addInitScript(s => { window.__SPEC_EVAL__ = s; }, item.spec);
        await page.goto(base);
        const resume = page.getByRole('button', { name: 'Continue', exact: true });
        if (await resume.count()) await resume.click();
        await page.locator('.aha-activity').waitFor({ timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(80);
        // Same one-screen checks as verify-ui's focus-stage pass bar.
        Object.assign(item, await page.evaluate(() => {
          const scroll = document.querySelector('.stage-scroll, .ax-stage-scroll');
          const check = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Check');
          const overflow = [];
          if (document.documentElement.scrollWidth > innerWidth + 1) overflow.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px)`);
          if (document.documentElement.scrollHeight > innerHeight + 1) overflow.push('page scrolls vertically');
          if (!check || check.getBoundingClientRect().bottom > innerHeight) overflow.push('Check is off screen');
          return { overflow, stageScrolls: !!scroll && scroll.scrollHeight > scroll.clientHeight + 1 };
        }));
        item.shot = `shots/${batch.state}--${item.index}.png`;
        await page.screenshot({ path: path.join(outDir, item.shot) });
        await page.close();
      }
    }
    await context.close();
  } finally {
    await browser?.close();
    vite.kill();
  }
  return problems;
}

export function contactSheet(outDir, { states, batches, summary, renderProblems }) {
  const stateById = new Map(states.map(s => [s.id, s]));
  const chip = (label, v) => v === null || v === undefined ? '' : `<span class="chip ${v ? 'ok' : 'bad'}">${label}</span>`;
  const label = { correctKey: 'key', levelFit: 'level', varied: 'varied', figureHelps: 'figure', childAppropriate: 'kind' };
  const card = item => item.ok ? `<figure class="card">
  <a href="${esc(item.shot)}"><img loading="lazy" src="${esc(item.shot)}" alt="${esc(item.id)}"></a>
  <figcaption><b>${esc(item.id)}</b> · ${esc(item.skillIds.join(', '))} · d${item.difficulty} (target ${item.targetDifficulty})<br>
  ${esc(item.responseType)}${item.figureTypes.length ? ` · ${esc(item.figureTypes.join(', '))}` : ''} · ~${item.approxTokens} tok · keyCheck ${esc(item.keyCheck)}<br>
  ${item.judge ? JUDGE_CRITERIA.map(c => chip(label[c], item.judge[c])).join('') : '<span class="chip">not judged</span>'}
  ${item.judge?.problems ? `<p class="why">${esc(item.judge.problems)}</p>` : ''}
  ${item.stageScrolls ? '<p class="why">Scrolls inside the stage (does not fit one screen)</p>' : ''}${item.overflow?.length ? `<p class="why">Layout: ${esc(item.overflow.join('; '))}</p>` : ''}</figcaption></figure>`
    : `<figure class="card invalid"><figcaption><b>INVALID ${esc(item.id)}</b> · ${esc(item.responseType)}${item.figureTypes.length ? ` · ${esc(item.figureTypes.join(', '))}` : ''} · keyCheck ${esc(item.keyCheck)}<ul>${item.errors.slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('')}</ul></figcaption></figure>`;
  const group = b => {
    const s = stateById.get(b.state);
    const f = s.summary.frontier.map(x => `${x.id}:${x.state}:d${x.suggestedDifficulty}`).join(' ');
    return `<section><h2>${esc(b.state)} <small>${esc(s.note)}</small></h2>
<p class="meta">Requested ${b.requested}, returned ${b.returned}, ~${b.replyApproxTokens} tok reply${b.callError ? ` · <b>call failed: ${esc(b.callError)}</b>` : ''}${b.batchErrors.length ? ` · ${esc(b.batchErrors.join('; '))}` : ''}<br>
Frontier ${esc(f)}${s.summary.misconceptions.length ? ` · misconceptions ${esc(s.summary.misconceptions.map(m => m.tag).join(', '))}` : ''}${s.summary.dueReviews.length ? ` · due ${esc(s.summary.dueReviews.join(', '))}` : ''}</p>
${b.rationale ? `<p class="rationale">“${esc(b.rationale)}”</p>` : ''}${b.judgeGap ? `<p class="why">Judge gap note: ${esc(b.judgeGap)}</p>` : ''}
<div class="grid">${b.items.map(card).join('')}</div></section>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spec eval ${esc(summary.meta.run)}</title>
<style>:root{color-scheme:light}body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:24px 16px;background:#e9e8df;color:#263d35}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 4px}h2 small{font-weight:400;color:#5f6a5c}
.banner{background:#fff3e8;border:1px solid #e9c7b0;border-radius:8px;padding:10px 12px;margin:12px 0}
.meta,.rationale{color:#4b5a51;margin:4px 0;font-size:13px}.rationale{font-style:italic}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;align-items:start}
.card{margin:0;background:#fbfaf5;border-radius:10px;padding:8px;box-shadow:0 1px 4px #0002}.card img{width:100%;display:block;border-radius:6px}
.card figcaption{font-size:12px;margin-top:6px}.invalid{background:#fff0ee}.invalid ul{margin:6px 0 0;padding-left:18px}
.chip{display:inline-block;border-radius:999px;padding:1px 8px;margin:4px 4px 0 0;font-size:11px;background:#ddd}.chip.ok{background:#d4ecdf;color:#185c3c}.chip.bad{background:#f7d4cc;color:#8a2b17}
.why{color:#8a2b17;margin:4px 0 0}pre{white-space:pre-wrap;background:#fbfaf5;padding:12px;border-radius:8px;font-size:12px}</style>
<h1>Activity Spec prompt eval — ${esc(summary.meta.run)}</h1>
<div class="banner">DEV-ONLY evaluation output. Synthetic learners; activities written by a local stand-in model (${esc(summary.meta.provider)} ${esc(summary.meta.model ?? 'default')}), not Free2Z and not the product. Never ship or present these as product AI output.</div>
<p>Schema ${summary.items.schemaPassRate}% · keyCheck ${summary.keyCheck.passRate}% · judge key ${summary.judge.correctKey?.rate ?? '–'}% · level ${summary.judge.levelFit?.rate ?? '–'}% · varied ${summary.judge.varied?.rate ?? '–'}% · figure ${summary.judge.figureHelps?.rate ?? '–'}% · kind ${summary.judge.childAppropriate?.rate ?? '–'}% · mean reply ~${summary.size.meanReplyTokens} tok. See summary.md.</p>
${renderProblems?.length ? `<pre>Render problems:\n${esc(renderProblems.join('\n'))}</pre>` : ''}
${batches.map(group).join('\n')}`;
  writeFileSync(path.join(outDir, 'index.html'), html);
}

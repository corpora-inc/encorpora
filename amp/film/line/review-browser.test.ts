/** Browser acceptance with synthetic films, reviews and local audio only. */
import { execFile, execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { secureChromium } from '../../browser-security.mjs';
import { playReview } from './play';
const here = dirname(fileURLToPath(import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'film-line-browser-'));
const film = 'example--waiting', scored = 'example--scored';
const longTitle = 'Reading a long mathematical explanation with a figure and several worked examples';
let browser: Browser, server: Server, base = '', writes = 0;
let reviews: Record<string, unknown> = { [scored]: { score: 9, added: 'one', summary: 'Synthetic review text.' } };
const queue = [
  { id: film, title: longTitle, level: 'Kindergarten', seconds: 25, added: 'one' },
  { id: scored, title: 'A scored example', level: 'Grade 8', seconds: 25, added: 'one' },
];
function wave() {
  const samples = 8000 * 25, buffer = Buffer.alloc(44+samples*2);
  buffer.write('RIFF'); buffer.writeUInt32LE(36+samples*2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples*2, 40);
  return buffer;
}
beforeAll(async () => {
  execFileSync('python3', ['-c', `
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from providers import write_json
from pages import board, line_page
out=Path(sys.argv[2]); repo=Path(sys.argv[3])
c={'root':str(out/'private'), 'worktree':str(repo), 'live_data':str(out/'live/data'), 'queue_page':str(out/'index.html')}
rows=[{'id':'example--waiting','title':sys.argv[4],'level':'Kindergarten','seconds':25,'added':'one'}, {'id':'example--scored','title':'A scored example','level':'Grade 8','seconds':25,'added':'one'}]
write_json(out/'live/data/queue.json', rows)
write_json(out/'live/data/reviews.json', {'example--scored':{'score':9,'added':'one','summary':'Synthetic review text.'}})
for r in rows:
 write_json(out/'private'/r['id']/'recipe.json', {'id':r['id'],'started_at':'one','status':'released','skill':{'title':r['title']},'model':'VISIBLE_AUTHOR' if r['id'].endswith('scored') else 'HIDDEN_AUTHOR','effort':'high','total_seconds':60})
board(c); line_page(c)
`, here, out, resolve(here, '../../..'), longTitle]);
  const audio = wave();
  server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { writes++; res.writeHead(405).end(); return; }
    const path = new URL(req.url!, 'http://localhost').pathname;
    if (path === '/live/data/queue.json' || path === '/live/review') {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(path.endsWith('queue.json') ? queue : reviews)); return;
    }
    if (path === '/live/review.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{border:0;width:100%;height:650px}</style><iframe src="player"></iframe><p>Review controls</p>'); return;
    }
    if (path === '/capture/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<div class="live ready"><div class="live-frame" style="background:beige;font:48px system-ui">Synthetic frame <b>0</b></div><input class="live-scrub" type="range" min="0" max="25" step=".01"></div><script>document.querySelector("input").oninput=e=>document.querySelector("b").textContent=e.target.value</script>'); return;
    }
    if (path === '/live/player') {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<meta name="viewport" content="width=device-width"><style>body{margin:0;font:24px system-ui;background:#f7f6f0}button{height:48px}#frame{height:450px;background:#e3eee8}</style>
      <div id="frame">Synthetic board</div><button aria-label="Play lesson film">Play</button><audio src="tone.wav" preload="auto"></audio>
      <script>const a=document.querySelector('audio');document.querySelector('button').onclick=()=>{a.play();console.error('Synthetic console error');fetch('review',{method:'POST',body:'blocked'}).catch(()=>{});};
      a.ontimeupdate=()=>document.getElementById('frame').textContent='Synthetic frame '+a.currentTime.toFixed(1);
      a.onseeked=()=>{if(a.currentTime>10)document.getElementById('frame').style.width='1600px'};</script>`); return;
    }
    if (path === '/live/tone.wav') {
      const match = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
      const start = Number(match?.[1] ?? 0), end = match?.[2] ? Number(match[2]) : audio.length-1;
      res.writeHead(match ? 206 : 200, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': end-start+1,
        ...(match ? { 'Content-Range': `bytes ${start}-${end}/${audio.length}` } : {}) });
      res.end(audio.subarray(start, end+1)); return;
    }
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (!['index.html', 'live/line.html', 'live/board.html'].includes(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/html'); res.end(readFileSync(join(out, file)));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No server port');
  base = `http://127.0.0.1:${address.port}`;
  browser = await secureChromium(chromium).launch();
}, 30_000);
afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  if (browser) {
    await Promise.all(browser.contexts().map(context => context.close()));
    await browser.close();
  }
}, 30_000);

it('queue and scoreboard fit four widths in both themes with readable Watch labels and 44px links', async () => {
  for (const colorScheme of ['light', 'dark'] as const) for (const width of [320, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme });
    const page = await context.newPage();
    for (const path of ['/', '/live/board.html']) {
      await page.goto(base+path);
      if (path === '/') await page.locator('.q-watch').waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const targets = await page.locator('a').evaluateAll(links => links.map(a => ({ width: a.getBoundingClientRect().width, height: a.getBoundingClientRect().height })));
      expect(targets.every(t => t.width >= 44 && t.height >= 44), JSON.stringify(targets)).toBe(true);
      expect(await page.locator('body').innerText()).not.toContain('HIDDEN_AUTHOR');
      if (path === '/') {
        const contrast = await page.locator('.q-watch').evaluate(a => {
          const style = getComputedStyle(a);
          const luma = (rgb: string) => {
            const v = rgb.match(/[\d.]+/g)!.slice(0, 3).map(n => Number(n)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
            return .2126*v[0]!+.7152*v[1]!+.0722*v[2]!;
          };
          const fg = luma(style.color), bg = luma(style.backgroundColor);
          return (Math.max(fg, bg)+.05)/(Math.min(fg, bg)+.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      } else expect(await page.locator('body').innerText()).toContain('VISIBLE_AUTHOR');
      await page.screenshot({ path: join(out, `${path === '/' ? 'queue' : 'board'}-${width}-${colorScheme}.png`), fullPage: true });
    }
    await context.close();
  }
  writeFileSync('/tmp/film-line-browser-evidence.txt', out+'\n');
}, 60_000);
it('queue refreshes scores, treats stale and cleared scores as waiting, and line redirects to root', async () => {
  const page = await browser.newPage();
  await page.goto(base+'/live/line.html'); await page.waitForURL(base+'/');
  await page.locator('.q-watch').waitFor();
  expect(await page.locator('#waiting .q-row').count()).toBe(1);
  reviews = { [scored]: { score: 9, added: 'stale' }, [film]: { score: null, added: 'one' } };
  await page.reload(); await page.locator('.q-watch').first().waitFor();
  expect(await page.locator('#waiting .q-row').count()).toBe(2);
  reviews[film] = { score: 0, added: 'one' };
  await page.evaluate(() => dispatchEvent(new Event('pageshow')));
  await page.locator('#scored .q-score').waitFor();
  expect(await page.locator('#scored .q-score').innerText()).toBe('0');
  await page.locator('.q-watch').click();
  expect(page.url()).toContain('/live/review.html?id=example--scored&list=line');
  await page.close();
}, 15_000);
it('play observes audio and requested seeks, reports errors and iframe overflow, and blocks writes', async () => {
  const report = await playReview(browser, { url: base+'/live/review.html?id='+film, out: join(out, 'played'), times: [2, 12, 18] });
  expect(report.layouts.map(r => r.name)).toEqual(['wide', 'phone']);
  for (const layout of report.layouts) {
    expect(layout.audio_played).toBe(true);
    expect(layout.frames.map(f => f.time).slice(1)).toEqual([2, 12, 18]);
    expect(layout.errors).toContain('Synthetic console error');
    expect(layout.overflow_x).toBeGreaterThan(0);
    expect(layout.blocked_requests).toContain('POST /live/review');
  }
  expect(writes).toBe(0);
}, 30_000);


it('captures every requested moment in both player layouts', async () => {
  const source = join(out, 'payload.json'), jobs = join(out, 'captures.json');
  writeFileSync(source, JSON.stringify({ id: film, script: { id: film }, timing: { duration: 25, shots: [[{ start: .5, end: 4, words: [] }]] } }));
  writeFileSync(jobs, JSON.stringify([{ id: film, payload: source, times: [0, 2, 4, 6, 8] }]));
  await promisify(execFile)(process.execPath, ['--import', 'tsx', join(here, 'capture.ts'), '--items', jobs, '--url', base+'/capture/', '--out', join(out, 'captures')],
    { cwd: resolve(here, '../..'), env: { ...process.env, FILM_LINE_HEAVY: '1' }, timeout: 30_000 });
  const manifest = JSON.parse(readFileSync(join(out, 'captures', film, 'capture.json'), 'utf8'));
  expect(manifest.frames).toBe(5);
  expect(manifest.times).toEqual([0, 2, 4, 6, 8]);
  for (const layout of ['wide', 'tall']) for (let n = 0; n < 5; n++) {
    expect(readFileSync(join(out, 'captures', film, 'board-'+layout, String(n).padStart(3, '0')+'.jpg')).length).toBeGreaterThan(100);
  }
}, 35_000);

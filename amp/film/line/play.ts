/** Observe the real review page without submitting scores or writing review data. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { secureChromium } from '../../browser-security.mjs';

type Job = { url: string; out: string; times: number[] };
async function audioState(frame: Frame) {
  return frame.evaluate(() => {
    const a = document.querySelector('audio');
    return a ? { time: a.currentTime, paused: a.paused, muted: a.muted, volume: a.volume,
      readyState: a.readyState, error: a.error?.message ?? null } : null;
  });
}
async function overflow(page: Page) {
  const frames = await Promise.all(page.frames().map(async f => ({ url: f.url(), pixels: await f.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)) })));
  return Math.max(0, ...frames.map(f => f.pixels));
}
export async function playReview(browser: Browser, job: Job) {
  const base = new URL(job.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Play requires the local review service');
  mkdirSync(job.out, { recursive: true });
  const layouts = [];
  for (const [name, width, height] of [['wide', 1280, 800], ['phone', 390, 844]] as const) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors: string[] = [], blocked: string[] = [];
    const frames: { path: string; time: number }[] = [];
    let audioPlayed = false, maxOverflow = 0;
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).origin !== base.origin) {
        blocked.push(request.method()+' '+new URL(request.url()).pathname);
        return route.abort();
      }
      // Keep score state out of the playback evidence, even for released films.
      if (/\/(review|reviews\.json|grades\.json)$/.test(new URL(request.url()).pathname)) return route.fulfill({ json: {} });
      return route.continue();
    });
    try {
      await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForFunction(() => !!document.querySelector('iframe') || !!document.querySelector('audio'));
      let player: Frame | undefined;
      for (let n = 0; n < 100 && !player; n++) {
        for (const frame of page.frames()) {
          if (await frame.getByRole('button', { name: 'Play lesson film', exact: true }).count()) player = frame;
        }
        if (!player) await page.waitForTimeout(100);
      }
      if (!player) throw new Error('Review page has no playable film');
      await player.getByRole('button', { name: 'Play lesson film', exact: true }).first().click();
      const before = await audioState(player);
      await page.waitForTimeout(1500);
      const after = await audioState(player);
      audioPlayed = !!before && !!after && after.time > before.time + .2 && !after.paused && !after.muted && after.volume > 0 && after.readyState >= 2 && !after.error;
      maxOverflow = await overflow(page);
      const playPath = join(job.out, name+'-play.jpg');
      await page.screenshot({ path: playPath, type: 'jpeg', quality: 90 });
      frames.push({ path: playPath, time: after?.time ?? 0 });
      for (const [i, time] of job.times.entries()) {
        await player.evaluate(async t => {
          const a = document.querySelector('audio');
          if (!a) throw new Error('Player has no audio element');
          a.pause();
          if (Math.abs(a.currentTime-t) > .01) {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Seek timed out')), 5000);
              a.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
              a.currentTime = t;
            });
          }
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        }, time);
        await page.waitForTimeout(150);
        const path = join(job.out, `${name}-${String(i).padStart(3, '0')}.jpg`);
        await page.screenshot({ path, type: 'jpeg', quality: 90 });
        frames.push({ path, time });
        maxOverflow = Math.max(maxOverflow, await overflow(page));
      }
    } catch (error) {
      errors.push(String(error));
    } finally {
      layouts.push({ name, width, height, audio_played: audioPlayed, overflow_x: maxOverflow, errors, blocked_requests: blocked, frames });
      await context.close();
    }
  }
  const result = { layouts };
  writeFileSync(join(job.out, 'play.json'), JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.FILM_LINE_HEAVY) throw new Error('Run play through the heavy-command gate');
  const job: Job = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
  const browser = await secureChromium(chromium).launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try { await playReview(browser, job); } finally { await browser.close(); }
}

/** Read-only phone playback acceptance. Run through the heavy-command gate. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../browser-security.mjs";

const { values } = parseArgs({ options: {
  url: { type: "string" }, out: { type: "string" }, ids: { type: "string" },
  page: { type: "string", default: "prod.html" },
} });
if (!process.env.FILM_LAB_HEAVY) throw new Error("Run playback checks through the heavy-command gate");
if (!values.url || !values.out || !values.ids) throw new Error("Required: --url <player-url> --out <private-directory> --ids <comma-separated-blind-ids>");
const base = new URL(values.url);
if (!['prod.html', 'one.html', 'fresh.html'].includes(values.page)) throw new Error('Unsupported review page');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error("Playback checks require the local review server");
const ids = values.ids.split(',');
if (!ids.length || ids.some(id => !/^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z]{2}$/.test(id))) throw new Error("Invalid blind film IDs");
mkdirSync(values.out, { recursive: true });
const browser = await secureChromium(rawChromium).launch();
const results: Record<string, unknown>[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return ['GET', 'HEAD'].includes(request.method()) && url.origin === base.origin ? route.continue() : route.abort();
  });
  const catalog = await context.newPage();
  const pageErrors: string[] = [];
  catalog.on('pageerror', error => pageErrors.push(error.message));
  await catalog.goto(new URL(values.page, base).href, { waitUntil: 'networkidle' });
  for (const id of ids) await catalog.locator(`[data-film="${id}"] a`).waitFor();
  const geometry = await catalog.evaluate(() => ({
    viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    links: [...document.querySelectorAll<HTMLElement>('a.film')].map(link => {
      const r = link.getBoundingClientRect();
      return { width: r.width, height: r.height, left: r.left, right: r.right };
    }),
    count: document.getElementById('count')?.textContent,
  }));
  if (geometry.scrollWidth > geometry.viewport || geometry.links.some(link => link.height < 44 || link.left < 0 || link.right > geometry.viewport)) throw new Error('Production page overflows or has undersized film links');
  if (pageErrors.length) throw new Error('Production page errors: '+pageErrors.join('; '));
  await catalog.screenshot({ path: join(values.out, 'prod-phone.png'), fullPage: true });
  results.push({ page: values.page, ...geometry });
  await catalog.close();
  for (const id of ids) {
    const page = await context.newPage();
    const errors: string[] = [];
    const audioResponses: { status: number; url: string }[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).pathname.endsWith('/'+id+'.m4a')) audioResponses.push({ status: response.status(), url: response.url() });
    });
    const url = values.page === 'fresh.html' ? new URL('review.html', base) : new URL(base);
    url.searchParams.set('id', id);
    if (values.page === 'fresh.html') url.searchParams.set('list', 'fresh');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    const film = values.page === 'fresh.html' ? await (await page.waitForSelector('iframe')).contentFrame() : page;
    if (!film) throw new Error('Review player iframe unavailable');
    await film.waitForSelector('.live.ready', { timeout: 60000 });
    if (values.page === 'fresh.html') {
      await page.locator('a[href="fresh.html"]').waitFor();
      if (geometry.links.length === 1 && !(await page.locator('.btn-next').isDisabled())) throw new Error('Single fresh film must not navigate to another list');
    }
    await film.locator('.live-toggle').click();
    await film.waitForFunction(() => document.querySelector('.live')?.classList.contains('playing') && Number(document.querySelector<HTMLInputElement>('.live-scrub')?.value) >= 2, undefined, { timeout: 30000 });
    const playback = await film.evaluate(() => ({
      seconds: Number(document.querySelector<HTMLInputElement>('.live-scrub')?.value),
      duration: Number(document.querySelector<HTMLInputElement>('.live-scrub')?.max),
      playing: document.querySelector('.live')?.classList.contains('playing'),
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    }));
    await film.locator('.live-cover').click();
    const at = Math.min(20, playback.duration/3);
    await film.evaluate(time => {
      const scrub = document.querySelector<HTMLInputElement>('.live-scrub')!;
      scrub.value = String(time);
      scrub.dispatchEvent(new Event('input', { bubbles: true }));
      scrub.dispatchEvent(new Event('change', { bubbles: true }));
    }, at);
    await film.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: join(values.out, id+'-phone.png') });
    if (!audioResponses.some(response => [200, 206].includes(response.status))) throw new Error('No successful audio response for '+id);
    if (errors.length || playback.scrollWidth > playback.viewport) throw new Error('Playback failure for '+id+': '+errors.join('; '));
    results.push({ id, ...playback, screenshot_seconds: at, audioResponses, page_errors: errors });
    await page.close();
  }
  await context.close();
  const receipt = { checked_at: new Date().toISOString(), viewport: { width: 390, height: 844 }, passed: true, results };
  writeFileSync(join(values.out, 'playback.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  await browser.close();
}

/** Capture the existing review player's pixels from frozen, blind payloads. No audio or grading calls. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../browser-security.mjs";
import { heldHighlights } from "../stage.ts";

const { values } = parseArgs({ options: {
  items: { type: "string" }, url: { type: "string" }, out: { type: "string" },
} });
if (!process.env.FILM_LINE_HEAVY) throw new Error("Run capture through the configured heavy-command gate");
if (!values.items || !values.url || !values.out) throw new Error("Required: --items <private-json> --url <local-player-url> --out <private-directory>");
type CaptureItem = { id: string; payload: string; times?: number[] };
type Payload = { id: string; script: { id: string; cast?: Record<string, Record<string, unknown>> }; timing: {
  duration: number; voices?: Record<string, string>; shots: { start: number; end: number; words: unknown[] }[][];
}; [key: string]: unknown };
const items: CaptureItem[] = JSON.parse(readFileSync(values.items, "utf8"));
const base = new URL(values.url);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error("Capture requires the existing local review server");
const browser = await secureChromium(rawChromium).launch();
const voices: Record<string, string> = {
  XescS24CsOySAkKrLAO3: 'Madeline', J3Ei0Lj6fAobhIqY5ySH: 'Paul', SYXbTJsLE7zmSjr1DchT: 'Champ',
};
try {
  for (const item of items) {
    if (!/^[a-z0-9_-]+$/.test(item.id)) throw new Error("Unsafe capture ID");
    const bytes = readFileSync(item.payload);
    const payload: Payload = JSON.parse(bytes.toString('utf8'));
    const played = structuredClone(payload);
    played.id = item.id;
    played.script.id = item.id;
    // The installed grading UI predates role-only casting. Its player copy
    // gets the exact saved production voices; the source screenplay stays intact.
    if (played.script.cast) for (const [role, entry] of Object.entries(played.script.cast)) {
      if (typeof entry.voice === 'string') continue;
      const voice = played.timing.voices?.[role];
      if (!voice || !voices[voice]) throw new Error(`No saved approved voice for ${role}`);
      played.script.cast[role] = { voice, name: voices[voice], ...(role==='learner' ? { tag: '[energetic]' } : {}) };
    }
    const beats = payload.timing.shots.flat();
    const shotEnds = payload.timing.shots.flatMap((shot, si) => shot.map((_, bi) =>
      bi===shot.length-1 && payload.timing.shots[si+1] ? payload.timing.shots[si+1]![0]!.start-.55 : Infinity));
    const times = item.times ?? beats.map((beat, i) => Math.max(beat.end,
      Math.min(beat.end+.9, (beats[i+1]?.start ?? payload.timing.duration)-.05, shotEnds[i]!)));
    const out = join(values.out, item.id);
    mkdirSync(out, { recursive: true });
    const rendererAssets = new Map<string, string>();
    const manifest: Record<string, unknown> = { id: item.id, payload_sha256: createHash('sha256').update(bytes).digest('hex'),
      source: 'checked payload through the live installed review player',
      captured_at: new Date().toISOString(), times, frames: times.length, layouts: [] };
    for (const [name, width, height] of [['wide', 1920, 1080], ['tall', 1080, 1920]] as const) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
      const page = await context.newPage();
      const errors: string[] = [];
      const responseReads: Promise<void>[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin !== base.origin || !(url.pathname.includes('/assets/') || response.request().resourceType() === 'document')) return;
        responseReads.push((async () => {
          if (!response.ok()) throw new Error('Installed player resource failed: '+url.pathname);
          const digest = createHash('sha256').update(await response.body()).digest('hex');
          const prior = rendererAssets.get(url.pathname);
          if (prior && prior !== digest) throw new Error('Installed player changed during capture: '+url.pathname);
          rendererAssets.set(url.pathname, digest);
        })().catch(error => { errors.push(String(error)); }));
      });
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (url.origin !== base.origin) return route.abort();
        if (url.pathname.endsWith('/grades.json') || url.pathname.endsWith('/reviews.json') || url.pathname.endsWith('/review')) return route.fulfill({ json: {} });
        if (url.pathname.endsWith('/index.json')) return route.fulfill({ json: [] });
        if (url.pathname.endsWith('/'+encodeURIComponent(item.id)+'.json')) return route.fulfill({ json: played });
        if (/\.(m4a|mp3|wav)(?:$|\?)/.test(url.pathname)) return route.abort();
        return route.continue();
      });
      const url = new URL(base);
      url.searchParams.set('id', item.id);
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('.live.ready', { timeout: 60000 });
      await page.addStyleTag({ content: `html,body,#app,.live{margin:0!important;padding:0!important;overflow:hidden!important;width:${width}px!important;height:${height}px!important}.live-frame{position:fixed!important;left:0!important;top:0!important;width:${width}px!important;height:${height}px!important;max-width:none!important;max-height:none!important;border:0!important;border-radius:0!important}.live-bar,.live-cover,.live-poster,.live-toast{display:none!important}` });
      await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
      const frame = page.locator('.live-frame');
      const size = await frame.boundingBox();
      if (!size || Math.round(size.width)!==width || Math.round(size.height)!==height) throw new Error('Incorrect player capture dimensions');
      const directory = join(out, 'board-'+name);
      const litDirectory = join(directory, 'lit');
      mkdirSync(litDirectory, { recursive: true });
      const seek = async (time: number) => {
        await page.evaluate(async (t) => {
          const scrub = document.querySelector<HTMLInputElement>('.live-scrub');
          if (!scrub) throw new Error('Review player has no scrub control');
          scrub.value = String(t);
          scrub.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        }, time);
      };
      for (let index=0; index<times.length; index++) {
        await seek(times[index]!);
        await frame.screenshot({ path: join(directory, String(index).padStart(3,'0')+'.jpg'), type: 'jpeg', quality: 94, animations: 'disabled' });
      }
      // Held lights, beside the beat-end frames. Names match make.ts --board, so a reader of 000.jpg is unchanged.
      const lights = heldHighlights(payload.script as never, payload.timing as never);
      const byBeat = new Map<number, typeof lights>();
      for (const light of lights) {
        const list = byBeat.get(light.beat) ?? [];
        list.push(light);
        byBeat.set(light.beat, list);
      }
      const slug = (word: string) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'highlight';
      const lit: { beat: number; t: number; word: string; file: string }[] = [];
      for (const [beat, mine] of [...byBeat.entries()].sort((a, b) => a[0] - b[0])) {
        for (let k = 0; k < mine.length; k++) {
          const light = mine[k]!;
          const name = slug(light.word);
          const file = mine.length > 1 ? `${String(beat).padStart(3, '0')}-${k + 1}-${name}.jpg` : `${String(beat).padStart(3, '0')}-${name}.jpg`;
          await seek(light.t);
          await frame.screenshot({ path: join(litDirectory, file), type: 'jpeg', quality: 94, animations: 'disabled' });
          lit.push({ beat, t: light.t, word: light.word, file });
        }
      }
      await Promise.all(responseReads);
      if (errors.length) throw new Error('Player errors: '+errors.join('; '));
      (manifest.layouts as unknown[]).push({ name, width, height, directory, lit });
      await context.close();
    }
    manifest.renderer_assets = [...rendererAssets].map(([path, sha256]) => ({ path, sha256 }));
    writeFileSync(join(out, 'capture.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ id: item.id, frames: times.length, layouts: 2 }));
  }
} finally {
  await browser.close();
}

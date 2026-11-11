/**
 * Script to finished lesson film. One command:
 *
 *   npx tsx film/make.ts <template-id>                  voice, check, 4K60 film, captions, contact sheet
 *   npx tsx film/make.ts <template-id> --check          voice and layout check only; prints problems, renders nothing
 *   npx tsx film/make.ts <template-id> --dry            the same check on estimated timing: no voice, costs nothing
 *   npx tsx film/make.ts <template-id> --dry --board    plus storyboard.jpg: the end of every beat, and each held highlight
 *   npx tsx film/make.ts <template-id> --res 540 --fps 30   a quick look
 *   npx tsx film/make.ts <template-id> --still 12.5,40  single frames
 *
 * Voice takes are cached by their text, so editing one shot only pays for that shot.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { problemLesson } from "../src/content/problem-lessons";
import { audioProblems, envelope, fadeAround, FLOOR, quietRuns, SR, TAKE_FADE } from "./audio";
import { goodTake, pcmOf, type Alignment } from "./voice";
import { scriptSchema, type BeatTime, type Script, type Timing, type WordTime } from "./schema";
import { mathProblems } from "./mathcheck";
import { thingsProblems } from "./things";
import { isTagWord, neighbours, requireVoices, resolveCast, runsOf, templateOf, TURN_GAP, voiceBindings } from "./cast";
import { FILM_OUT, FILM_VOICES, FILM_LOCKS } from "./paths";
import { renderFormat } from "./render-format";
import { heldFrames } from "./held-frames";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    /** Re-voice a speaker for this run: `--voice narrator=paul`, `--voice learner=champ`. */
    voice: { type: "string", multiple: true, default: [] },
    res: { type: "string", default: "2160" },
    fps: { type: "string", default: "60" },
    check: { type: "boolean", default: false },
    dry: { type: "boolean", default: false },
    board: { type: "boolean", default: false },
    still: { type: "string" },
    out: { type: "string" },
    workers: { type: "string", default: "1" },
    /** Shoot the phone layout (1080 by 1920) instead of the 16:9 film: storyboard-tall.jpg, board-tall/, stills-tall/. */
    tall: { type: "boolean", default: false },
  },
});
const id = positionals[0];
if (!id) throw new Error("Usage: npx tsx film/make.ts <template-id>");
const res = Number(values.res), fps = Number(values.fps);
const { width: FW, height: FH, scale: SCALE } = renderFormat(res, values.tall);
if (!Number.isFinite(fps) || fps <= 0 || fps > 120) throw new Error("--fps must be greater than 0 and at most 120");
// `<template>--<variant>` is its own screenplay and output folder; its facts come from the template
const { template } = templateOf(id);
const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT_ROOT = values.out ?? FILM_OUT;
const OUT = join(OUT_ROOT, id);
// One voice cache for every output folder: a take is paid for once.
const VOICES = FILM_VOICES;
mkdirSync(OUT, { recursive: true });
mkdirSync(VOICES, { recursive: true });
const started = Date.now();
const clock: Record<string, number> = {};
const lap = (name: string, from: number) => (clock[name] = Math.round((Date.now() - from) / 100) / 10);

const raw: unknown = JSON.parse(readFileSync(join(HERE, "lessons", `${id}.json`), "utf8"));
// Things to count: an unknown kind, or a count whose words do not match the things on screen,
// is reported in plain words before the schema, the browser or a paid voice is involved.
const misuse = thingsProblems(raw);
if (misuse.length) {
  console.error(`PROBLEMS in ${id}:\n- ${misuse.join("\n- ")}`);
  process.exit(1);
}
const script: Script = scriptSchema.parse(raw);
const overrides = Object.fromEntries(values.voice.map((v) => {
  const m = v.match(/^([\w-]+)=(.+)$/);
  if (!m) throw new Error(`--voice takes role=voice, not "${v}"`);
  return [m[1]!, m[2]!];
}));
// Overrides name approved voices. A speaker left without a distinct one fails when the film is voiced, not in a dry check.
const cast = resolveCast(script, overrides);
const runs = runsOf(script, cast);

// ------------------------------------------------------------------ voice
let charsSpent = 0;
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
/**
 * Words with their times. A word runs from its first letter or digit to its
 * last: the service gives the pause after a sentence to its full stop, so a
 * word that kept its punctuation would end at the start of the next word.
 */
function wordsOf(a: Alignment): WordTime[] {
  const out: WordTime[] = [];
  let buf = "", st = -1, en = -1, st0 = 0, en0 = 0;
  // an audio tag ("[energetic]") sent before the words may come back in the alignment: it was not spoken
  const push = () => { if (buf.trim() && !isTagWord(buf)) out.push({ text: buf.trim(), start: st >= 0 ? st : st0, end: en >= 0 ? en : en0 }); };
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { push(); buf = ""; st = en = -1; return; }
    if (!buf) st0 = a.character_start_times_seconds[i]!;
    en0 = a.character_end_times_seconds[i]!;
    if (/[\p{L}\p{N}]/u.test(ch)) {
      if (st < 0) st = a.character_start_times_seconds[i]!;
      en = a.character_end_times_seconds[i]!;
    }
    buf += ch;
  });
  push();
  return out;
}
/** Shorten long silences inside a take, cutting only where it is measured silent; word times stay true. */
function tighten(pcm: Int16Array, words: WordTime[], maxGap = 0.34) {
  const env = envelope(pcm), n = env.length;
  const cuts: [number, number][] = [];
  for (let i = 0; i < n; ) {
    if (env[i]! >= FLOOR) { i++; continue; }
    let j = i;
    while (j < n && env[j]! < FLOOR) j++;
    const len = (j - i) * 0.01;
    if (len > maxGap && i > 0 && j < n) cuts.push([i * 0.01 + maxGap * 0.55, i * 0.01 + maxGap * 0.55 + (len - maxGap)]);
    i = j;
  }
  const map = (t: number) => {
    let d = 0;
    for (const [a, b] of cuts) { if (t >= b) d += b - a; else if (t > a) d += t - a; }
    return t - d;
  };
  const parts: Int16Array[] = [];
  let prev = 0;
  for (const [a, b] of cuts) { parts.push(pcm.subarray(Math.round(prev * SR), Math.round(a * SR))); prev = b; }
  parts.push(pcm.subarray(Math.round(prev * SR)));
  const out = new Int16Array(parts.reduce((s, p) => s + p.length, 0));
  const joins: number[] = [];
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    if (at) { joins.push(at / SR); fadeAround(out, at); }
    at += p.length;
  }
  fadeAround(out, 0, false, true, TAKE_FADE);
  fadeAround(out, out.length, true, false, TAKE_FADE);
  return { pcm: out, joins, words: words.map((w) => ({ text: w.text, start: map(w.start), end: map(w.end) })) };
}
function wav(pcm: Int16Array) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
/** One speaking level for every take: -21 dBFS while speaking, peaks under -1 dBFS. */
function even(src: Int16Array) {
  const env = envelope(src), loud = [...env].filter((x) => x > 0.02);
  if (!loud.length) return Int16Array.from(src);
  const level = Math.sqrt(loud.reduce((a, x) => a + x * x, 0) / loud.length);
  let peak = 1;
  for (const v of src) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(10 ** (-21 / 20) / level, (10 ** (-1 / 20) * 32767) / peak);
  return Int16Array.from(src, (v) => Math.round(v * gain));
}
/** Notes that do not stop the film: about the voice, and labels a crowded app figure left out. */
const voiceNotes: string[] = [];
async function voice(): Promise<Timing> {
  requireVoices(cast);
  const t0 = Date.now();
  const lead = 0.5, gapBetweenShots = 0.45;
  const chunks: Int16Array[] = [new Int16Array(Math.round(SR * lead))];
  const edits: { at: number; what: string }[] = [];
  let clockT = lead;
  const shots: BeatTime[][] = script.shots.map(() => []);
  // One take per run of beats by the same speaker, in that speaker's voice. Every
  // take is made (or read from the cache) and listened to, three at a time.
  const made: Awaited<ReturnType<typeof goodTake>>[] = new Array(runs.length);
  let nextRun = 0;
  await Promise.all([0, 1, 2].map(async () => {
    for (let ri; (ri = nextRun++) < runs.length; ) {
      const { prev, next } = neighbours(runs, ri);
      made[ri] = await goodTake(VOICES, runs[ri]!.text, prev, next, runs[ri]!.role.voice!);
    }
  }));
  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri]!, si = run.shot;
    const where = `Shot ${si + 1}${cast.named ? ` (${run.role.role})` : ""}`;
    const r = made[ri]!.take;
    charsSpent += made[ri]!.spent;
    for (const f of made[ri]!.faults) voiceNotes.push(`${where}: no take matched the script exactly (the same in each try): ${f}. Listen there.`);
    const { pcm, words, joins } = tighten(even(pcmOf(r)), wordsOf(r.alignment));
    const env = envelope(pcm);
    const beats = script.shots[si]!.beats.slice(run.from, run.to + 1);
    const out = shots[si]!;
    let w = 0, cut = 0;
    for (let bi = 0; bi < beats.length; bi++) {
      const need = tokens(beats[bi]!.say);
      const got: WordTime[] = [];
      let filled = 0;
      while (filled < need.length) {
        if (w >= words.length) throw new Error(`Voice ended during: ${beats[bi]!.say}`);
        const said = tokens(words[w]!.text);
        if (!said.length) { w++; continue; }
        if (need.slice(filled, filled + said.length).join(" ") !== said.join(" "))
          throw new Error(`Voice said "${words[w]!.text}" where the script says "${need.slice(filled, filled + said.length).join(" ")}"`);
        got.push(words[w]!);
        filled += said.length; w++;
      }
      const last = bi + 1 === beats.length;
      let pause = beats[bi]!.pause ?? 0;
      // Where this beat's audio ends. With no pause nothing is inserted, so any point
      // between the words will do. A pause goes only into a silence the take really has.
      let end = last ? pcm.length / SR : (got[got.length - 1]!.end + words[w]!.start) / 2;
      if (!last && pause > 0) {
        const quiet = quietRuns(env, got[got.length - 1]!.start, words[w]!.start + 0.06, 0.1);
        const best = quiet.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
        if (best) end = (best[0] + best[1]) / 2;
        else {
          voiceNotes.push(`${where}: the voice runs "${beats[bi]!.say}" straight into the next beat, so its ${pause} s pause was left out.`);
          pause = 0;
        }
      }
      const a = Math.round(cut * SR), b = Math.round(end * SR);
      if (pause > 0) fadeAround(pcm, b);
      const seg = pcm.subarray(a, b);
      for (const j of joins) if (j > cut && j < end) edits.push({ at: clockT + j - cut, what: `shortened silence in shot ${si + 1}` });
      out.push({
        start: clockT + got[0]!.start - cut,
        end: clockT + got[got.length - 1]!.end - cut,
        words: got.map((g) => ({ text: g.text, start: clockT + g.start - cut, end: clockT + g.end - cut })),
      });
      chunks.push(seg);
      clockT += seg.length / SR;
      if (pause > 0) {
        edits.push({ at: clockT, what: `pause after "${beats[bi]!.say}"` }, { at: clockT + pause, what: `end of the pause after "${beats[bi]!.say}"` });
        chunks.push(new Int16Array(Math.round(SR * pause)));
        clockT += pause;
      }
      cut = end;
    }
    // After a run: a breath before the other speaker answers, or the gap between shots.
    // Both are digital silence against takes that fade in and out (every kept take
    // ends in measured silence), and the finished narration's scan for hard edges
    // checks every one of them.
    const sameShot = runs[ri + 1]?.shot === si;
    const gap = sameShot ? TURN_GAP : gapBetweenShots;
    if (sameShot) edits.push({ at: clockT, what: `turn from ${run.role.role} to ${runs[ri + 1]!.role.role}` });
    chunks.push(new Int16Array(Math.round(SR * gap)));
    clockT += gap;
  }
  // the summary holds on screen after the last word
  chunks.push(new Int16Array(Math.round(SR * 1.8)));
  clockT += 1.8;
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const all = new Int16Array(total);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  // A narration with a bad edit is never rendered.
  const bad = audioProblems(all, edits);
  if (bad.length) throw new Error(`The narration has edits that would be heard:\n- ${bad.join("\n- ")}`);
  writeFileSync(join(OUT, "narration.wav"), wav(all));
  const timing: Timing = { duration: total / SR, shots, voices: voiceBindings(cast) };
  writeFileSync(join(OUT, "timing.json"), JSON.stringify(timing));
  lap("voice", t0);
  return timing;
}

/**
 * Timing guessed from the words, at the voice's usual pace, for --dry: every
 * check except the voice itself, for free. Real timing differs a little, so a
 * dry pass is a draft check; --check before rendering is still the gate.
 */
function estimate(): Timing {
  let t = 0.5;
  const shots: BeatTime[][] = [];
  for (const shot of script.shots) {
    const out: BeatTime[] = [];
    shot.beats.forEach((b, bi) => {
      // a change of speaker is a new take after a breath
      if (bi && runs.some((r) => r.shot === shots.length && r.from === bi)) t += TURN_GAP;
      const words: WordTime[] = [];
      for (const raw of b.say.split(/\s+/).filter(Boolean)) {
        // measured on the voice: about 0.05 s a letter, plus breaths at punctuation
        const d = 0.087 + 0.0487 * raw.replace(/[^\p{L}\p{N}]/gu, "").length;
        words.push({ text: raw, start: t, end: t + d });
        t += d + 0.035 + (/[.?!:]$/.test(raw) ? 0.35 : /[,;]$/.test(raw) ? 0.14 : 0);
      }
      out.push({ start: words[0]!.start, end: words[words.length - 1]!.end, words });
      t += (b.pause ?? 0) + 0.25;
    });
    shots.push(out);
    t += 0.45;
  }
  return { duration: t + 1.8, shots, voices: voiceBindings(cast) };
}

// ------------------------------------------------------------------ captions
function captions(timing: Timing) {
  const words = timing.shots.flat().flatMap((b) => b.words);
  const cues: WordTime[][] = [];
  let cur: WordTime[] = [];
  for (const w of words) {
    cur.push(w);
    const len = cur.map((x) => x.text).join(" ").length;
    if (/[.?!:]$/.test(w.text) || (len > 62 && /,$/.test(w.text)) || len > 74) { cues.push(cur); cur = []; }
  }
  if (cur.length) cues.push(cur);
  const fmt = (t: number, sep: string) => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}${sep}${String(Math.round((s % 1) * 1000)).padStart(3, "0")}`;
  };
  const fix = (s: string) => s.replace(/\b([A-Z]) ([A-Z])\b/g, "$1$2");
  const wrap = (s: string) => {
    if (s.length <= 42) return s;
    const mid = s.length / 2;
    let best = -1;
    for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return `${s.slice(0, best)}\n${s.slice(best + 1)}`;
  };
  const srt: string[] = [], vtt: string[] = ["WEBVTT\n"];
  cues.forEach((c, i) => {
    const a = c[0]!.start, b = Math.min(cues[i + 1]?.[0]!.start ?? c[c.length - 1]!.end + 0.4, c[c.length - 1]!.end + 0.5);
    const line = wrap(fix(c.map((x) => x.text).join(" ")));
    srt.push(`${i + 1}\n${fmt(a, ",")} --> ${fmt(b, ",")}\n${line}\n`);
    vtt.push(`${fmt(a, ".")} --> ${fmt(b, ".")}\n${line}\n`);
  });
  writeFileSync(join(OUT, `${id}.en.srt`), srt.join("\n"));
  writeFileSync(join(OUT, `${id}.en.vtt`), vtt.join("\n"));
  writeFileSync(join(OUT, "transcript.txt"), fix(words.map((w) => w.text).join(" ")));
}

// ------------------------------------------------------------------ machine budget
/**
 * At most FILM_SLOTS (default 2) films use the browser and encoder at once on
 * this machine, however many authors run --dry: the rest wait their turn.
 */
async function takeSlot() {
  const dir = FILM_LOCKS;
  mkdirSync(dir, { recursive: true });
  const slots = Number(process.env.FILM_SLOTS ?? 2);
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < slots; i++) {
      const p = join(dir, `slot-${i}`);
      try {
        mkdirSync(p);
        writeFileSync(join(p, "pid"), String(process.pid));
        process.on("exit", () => rmSync(p, { recursive: true, force: true }));
        for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(130));
        return p;
      } catch {
        // a slot whose owner is gone is free again
        try {
          const old = Date.now() - statSync(p).mtimeMs > 10_000;
          const pid = Number(readFileSync(join(p, "pid"), "utf8"));
          if (old) process.kill(pid, 0);
        } catch {
          if (Date.now() - (statSync(p, { throwIfNoEntry: false })?.mtimeMs ?? 0) > 10_000) rmSync(p, { recursive: true, force: true });
        }
      }
    }
    if (waited === 0) console.log(`waiting for a free slot (${slots} films at a time on this machine)`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// ------------------------------------------------------------------ pictures
const timing = values.dry ? estimate() : await voice();
const slotDir = await takeSlot();
if (!values.dry) captions(timing);
const lesson = problemLesson(template, script.seed ?? "film");
const suffix = values.tall ? "-tall" : "";
const server = await createServer({
  root: join(HERE, ".."),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null }, // a saved file must never reload a page mid-render
  plugins: [{
    name: "film",
    configureServer(vite) {
      vite.middlewares.use(async (req, res_, next) => {
        if (!req.url?.startsWith("/__film")) return next();
        // estimated timing runs a little off the real voice: hold the dry check to a 6 s still limit for margin.
        // `figure` is the template's example, for {example: true} shots; a shot's own scene travels in the script.
        const payload = JSON.stringify({ script, timing, figure: lesson.example.figure ?? null, still: values.dry ? 6 : 7.5, layout: values.tall ? "tall" : "wide" }).replace(/</g, "\\u003c");
        res_.setHeader("Content-Type", "text/html");
        res_.end(await vite.transformIndexHtml(req.url, `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"></head><body><div id="film"></div><script>window.__filmData=${payload}</script><script type="module" src="/film/page.tsx"></script></body></html>`));
      });
    },
  }],
});
await server.listen();
const addr = server.httpServer!.address();
if (!addr || typeof addr === "string") throw new Error("No server address");
const browser = await secureChromium(rawChromium).launch();
const problems: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: FW, height: FH }, deviceScaleFactor: 1, colorScheme: "light" });
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push(m.text()); });
  await page.goto(`http://127.0.0.1:${addr.port}/__film`);
  await page.waitForFunction(() => !!(window as any).__film, undefined, { timeout: 60000 });
  await page.evaluate(() => (window as any).__film.ready);
  problems.push(...(await page.evaluate(() => (window as any).__film.issues as string[])));
  voiceNotes.push(...(await page.evaluate(() => ((window as any).__film.notes ?? []) as string[])));
  // the board's math, checked without rendering: arithmetic true, every step consistent with its answer
  problems.push(...mathProblems(script));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > ((window as any).__filmData.layout === "tall" ? 1080 : 1920));
  if (overflow) problems.push("The frame scrolls horizontally: something is wider than the film.");
  if (timing.duration > 180) voiceNotes.push(`The lesson runs ${Math.round(timing.duration)} s. Check that every example is a different case and nothing is said twice (AUTHORING.md, "The test").`);
  for (const n of voiceNotes) console.log(`note: ${n}`);
  if (problems.length) {
    console.error(`PROBLEMS in ${id}:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
  }
  const cdp = await page.context().newCDPSession(page);
  const shot = async (t: number) => {
    await page.evaluate((x) => (window as any).__film.seek(x), t);
    // Scale once, in the capture clip, from the stage's CSS pixels to the output raster.
    const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 96, optimizeForSpeed: true, clip: { x: 0, y: 0, width: FW, height: FH, scale: SCALE } });
    return Buffer.from(r.data, "base64");
  };
  if (values.board) {
    // the screen as each beat ends, just before the next begins: what the learner has seen
    const beats = timing.shots.flat();
    // a shot fades out half a second before the next shot's first word: sample before that
    const shotEnd = timing.shots.flatMap((sh, si) => sh.map((_, bi) => (bi === sh.length - 1 && timing.shots[si + 1] ? timing.shots[si + 1]![0]!.start - 0.55 : Infinity)));
    const dir = join(OUT, `board${suffix}`);
    const litDir = join(dir, "lit");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(litDir, { recursive: true });
    const lights = heldFrames(script, timing);
    const byBeat = new Map<number, typeof lights>();
    for (const light of lights) {
      const list = byBeat.get(light.beat) ?? [];
      list.push(light);
      byBeat.set(light.beat, list);
    }
    // Beat-end frames stay NNN.jpg. Lit frames live in lit/ so a reader of the
    // numbered sequence (the line's pages, the critic's first N frames) is unchanged.
    const sheet: { file: string; label: string }[] = [];
    for (let i = 0; i < beats.length; i++) {
      const next = beats[i + 1]?.start ?? timing.duration;
      const t = Math.max(beats[i]!.end, Math.min(beats[i]!.end + 0.9, next - 0.05, shotEnd[i]!));
      const beatFile = join(dir, `${String(i).padStart(3, "0")}.jpg`);
      writeFileSync(beatFile, await shot(t));
      sheet.push({ file: beatFile, label: String(i) });
      const mine = byBeat.get(i) ?? [];
      for (let k = 0; k < mine.length; k++) {
        const light = mine[k]!;
        const name = light.label;
        const file = join(litDir, light.file);
        writeFileSync(file, await shot(light.t));
        sheet.push({ file, label: name === "highlight" ? `${i} lit` : `${i} lit ${name.replace(/-/g, " ")}` });
      }
    }
    const cols = values.tall ? 6 : 4, rows = Math.ceil(sheet.length / cols);
    const sheetDir = mkdtempSync(join(tmpdir(), "film-sheet-"));
    try {
      const scaleW = values.tall ? 540 : 960;
      for (let k = 0; k < sheet.length; k++) {
        const label = sheet[k]!.label.replace(/[%:'\\]/g, "").slice(0, 48);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", sheet[k]!.file, "-vf", `scale=${scaleW}:-1,drawtext=text='${label}':x=12:y=10:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.6`, "-q:v", "3", join(sheetDir, `${String(k).padStart(4, "0")}.jpg`)]);
      }
      execFileSync("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", join(sheetDir, "*.jpg"), "-vf", `tile=${cols}x${rows}:padding=6`, "-frames:v", "1", "-q:v", "3", join(OUT, `storyboard${suffix}.jpg`)]);
    } finally {
      try { execFileSync("trash", [sheetDir], { stdio: "ignore" }); } catch { /* the sheet copies are temporary */ }
    }
    // the single frames stay beside it, for a reviewer that reads them one by one
    console.log(`storyboard: ${join(OUT, `storyboard${suffix}.jpg`)} (${beats.length} beats, ${lights.length} lit; beat frames 000.jpg…, lit frames in ${litDir})`);
  }
  if (values.still) {
    const dir = join(OUT, `stills${suffix}`);
    mkdirSync(dir, { recursive: true });
    for (const s of values.still.split(",")) writeFileSync(join(dir, `t${Number(s).toFixed(2).padStart(7, "0")}.jpg`), await shot(Number(s)));
  } else if (!values.check && !values.dry) {
    const t0 = Date.now();
    const total = Math.ceil(timing.duration * fps);
    const ranges = await page.evaluate(() => (window as any).__film.moving() as [number, number][]);
    const moving = new Uint8Array(total);
    for (const [a, b] of ranges) for (let f = Math.max(0, Math.floor(a * fps)); f <= Math.min(total - 1, Math.ceil(b * fps)); f++) moving[f] = 1;
    const dir = join(OUT, `frames${suffix}-${res}`);
    mkdirSync(dir, { recursive: true });
    const list: string[] = [];
    let unique = 0, last = "", run = 0;
    const flush = () => { if (last) list.push(`file '${last}'\nduration ${(run / fps).toFixed(6)}`); };
    for (let f = 0; f < total; f++) {
      if (moving[f] || !last) {
        flush();
        last = `${String(unique++).padStart(6, "0")}.jpg`;
        writeFileSync(join(dir, last), await shot(f / fps));
        run = 1;
      } else run++;
    }
    flush();
    list.push(`file '${last}'`);
    writeFileSync(join(dir, "list.txt"), list.join("\n"));
    lap("frames", t0);
    const t1 = Date.now();
    const film = join(OUT, `${id}${suffix}-${res}p${fps}.mp4`);
    const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-i", join(OUT, "narration.wav"),
      "-vf", `fps=${fps},format=yuv420p`, "-c:v", "libx264", "-preset", res > 1080 ? "veryfast" : "medium", "-crf", res > 1080 ? "16" : "18", "-threads", "5",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", "-shortest", film], { stdio: "inherit" });
    if (ff.status !== 0) throw new Error("ffmpeg failed");
    lap("encode", t1);
    const every = Math.max(4, Math.ceil(timing.duration / 40));
    const rows = Math.ceil(Math.ceil(timing.duration / every) / 4);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", film, "-vf", `fps=1/${every},scale=640:-1,tile=4x${rows}`, "-frames:v", "1", "-q:v", "4", join(OUT, "contact.jpg")]);
    rmSync(dir, { recursive: true, force: true });
    const report = { id, res, fps, seconds: Math.round(timing.duration * 10) / 10, uniqueFrames: unique, totalFrames: total, timings: clock, wallSeconds: Math.round((Date.now() - started) / 1000), charsSpent, problems, voiceNotes };
    writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } else {
    console.log(JSON.stringify({ id, ...(values.dry ? { dry: true } : {}), seconds: Math.round(timing.duration * 10) / 10, problems, charsSpent }));
  }
} finally {
  await browser.close();
  await server.close();
  rmSync(slotDir, { recursive: true, force: true });
}

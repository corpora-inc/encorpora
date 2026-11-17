/**
 * Crisp screen capture for product grabs: CDP Page.startScreencast frames,
 * written as JPEG files with their compositor timestamps. Sections wrapped in
 * `skip()` (network waits, typing pauses) are dropped by encode.py.
 * Nothing here talks to anything but the local browser.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserContext, CDPSession, Page } from "playwright";

export const FORMATS = {
  // 1920×1080: 1280×720 CSS at 1.5×.
  "16x9": { viewport: { width: 1280, height: 720 }, scale: 1.5, out: [1920, 1080] },
  // 1080×1920: a phone, 360×640 CSS at 3×.
  "9x16": { viewport: { width: 360, height: 640 }, scale: 3, out: [1080, 1920] },
  // 1080×1080: 720×720 CSS at 1.5×.
  "1x1": { viewport: { width: 720, height: 720 }, scale: 1.5, out: [1080, 1080] },
} as const;
export type Format = keyof typeof FORMATS;

type Frame = { file: string; t: number };
export class Recorder {
  frames: Frame[] = [];
  skips: [number, number][] = [];
  marks: { t: number; label: string }[] = [];
  private cdp?: CDPSession;
  private n = 0;
  private skipStart: number | null = null;
  private writes: Promise<unknown>[] = [];
  private lastT = 0;
  constructor(
    public page: Page,
    public dir: string,
    public format: Format,
  ) {}
  /** Wall-clock seconds on the same clock as screencast timestamps. */
  now() {
    return Date.now() / 1000;
  }
  async start() {
    await mkdir(join(this.dir, "frames"), { recursive: true });
    const [w, h] = FORMATS[this.format].out;
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (ev: any) => {
      const t = ev.metadata.timestamp ?? this.now();
      const file = `f${String(this.n++).padStart(6, "0")}.jpg`;
      this.frames.push({ file, t });
      this.lastT = t;
      this.writes.push(writeFile(join(this.dir, "frames", file), Buffer.from(ev.data, "base64")));
      void this.cdp!.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 95,
      maxWidth: w,
      maxHeight: h,
      everyNthFrame: 1,
    });
    this.mark("start");
  }
  mark(label: string) {
    this.marks.push({ t: this.now(), label });
  }
  private skipDepth = 0;
  /** Skips nest: footage resumes when the outermost one ends. */
  beginSkip() {
    if (this.skipDepth++ === 0) this.skipStart = this.now();
  }
  endSkip() {
    if (this.skipDepth === 0) return;
    if (--this.skipDepth === 0 && this.skipStart !== null) {
      this.skips.push([this.skipStart, this.now()]);
      this.skipStart = null;
    }
  }
  /** Run work whose screen time should be cut from the video. */
  async skip<T>(work: () => Promise<T>): Promise<T> {
    this.beginSkip();
    try {
      return await work();
    } finally {
      // Let the settled screen paint before footage resumes.
      await this.page.waitForTimeout(120);
      this.endSkip();
    }
  }
  async hold(ms: number) {
    await this.page.waitForTimeout(ms);
  }
  /** Force a frame now, so a static screen still has footage up to this point. */
  async stop() {
    this.mark("end");
    await this.page.waitForTimeout(300);
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    await Promise.all(this.writes);
    const end = this.now();
    await writeFile(
      join(this.dir, "capture.json"),
      JSON.stringify(
        { format: this.format, out: FORMATS[this.format].out, end, frames: this.frames, skips: this.skips, marks: this.marks },
        null,
        1,
      ),
    );
    return { frames: this.frames.length };
  }
}

export async function newCaptureContext(
  browserOrContext: { newContext: (o: any) => Promise<BrowserContext> },
  format: Format,
  colorScheme: "light" | "dark" = "light",
) {
  const f = FORMATS[format];
  return browserOrContext.newContext({
    viewport: f.viewport,
    deviceScaleFactor: f.scale,
    colorScheme,
    isMobile: format === "9x16",
    hasTouch: format === "9x16",
  });
}

/** Humanly paced pointer: move to the element's centre, short settle, click. */
export async function tap(page: Page, locator: ReturnType<Page["locator"]>, settle = 250) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  }
  await page.waitForTimeout(settle);
  await locator.click({ timeout: 8000 });
}

/** Smooth scroll by a distance in CSS px over a duration (string-evaluated so
 * tsx's helper injection never reaches the page). */
export async function glide(page: Page, dy: number, ms = 900, selector?: string) {
  await page.evaluate(`new Promise((done) => {
    const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : "document.scrollingElement"};
    const from = el.scrollTop, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ${ms});
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      el.scrollTop = from + ${dy} * e;
      k < 1 ? requestAnimationFrame(step) : done();
    };
    requestAnimationFrame(step);
  })`);
}

/** A browser for one format: Chromium renders at the format's true device
 * scale only when it is forced at launch, so each format is its own launch.
 * With `profile`, the persistent signed-in profile is reused (headless). */
export async function launchFor(
  format: Format,
  opts: { profile?: string; colorScheme?: "light" | "dark" } = {},
) {
  const { chromium } = await import("playwright");
  const { chromePath } = await import("../../browser-security.mjs");
  const f = FORMATS[format];
  const common = {
    executablePath: chromePath(),
    args: [`--force-device-scale-factor=${f.scale}`],
  };
  const ctxOpts = {
    viewport: f.viewport,
    deviceScaleFactor: f.scale,
    colorScheme: opts.colorScheme ?? "light",
    isMobile: format === "9x16",
    hasTouch: format === "9x16",
  } as const;
  if (opts.profile) {
    const context = await chromium.launchPersistentContext(opts.profile, { ...common, ...ctxOpts, headless: true });
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, close: () => context.close() };
  }
  const browser = await chromium.launch(common);
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  return { context, page, close: () => browser.close() };
}

/** Log page errors and failed API calls into a findings-friendly list. */
export function watchProblems(page: Page, sink: string[]) {
  page.on("pageerror", (e) => sink.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      sink.push(`http ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
}

/** Keep every AMP API exchange of a take (private, local) so a take can be
 * reviewed, and so another format can re-render the same session. */
export function logApi(page: Page, sink: { method: string; path: string; status: number; req?: string; res?: string; t: number }[]) {
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/")) return;
    const req = r.request();
    let res: string | undefined;
    try {
      res = await r.text();
    } catch {}
    sink.push({ method: req.method(), path: u.pathname + u.search, status: r.status(), req: req.postData() ?? undefined, res, t: Date.now() });
  });
}

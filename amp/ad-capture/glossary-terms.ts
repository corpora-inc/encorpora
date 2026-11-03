/**
 * Ad capture: the real TermCard for single glossary entries, opened on its
 * own from the real KeyWords strip (as a lesson's "Key words" chip opens it).
 * Payload: glossaryPayload([], {}, [id]), the server's own card builder.
 *
 * Phone 390x844 @3x (bottom sheet): full screenshot + sheet crop.
 * Tablet 1024x768 @2x (anchored card): card crop.
 * Crops are element screenshots with the page and scrim hidden, so the
 * rounded corners are transparent.
 *
 *   cd amp && npx tsx ad-capture/glossary-terms.ts
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { chromium } from "playwright";
import { createServer } from "vite";
import { glossary } from "../src/glossary/index";
import { glossaryPayload } from "../src/glossary/resolve";

const OUT =
  process.env.AD_GLOSSARY_OUT ??
  "/Users/skyl/corpora-media/AMP-media/2026-11-02/amp-feature-ad-contest/entrants/anthropic/captures/glossary/terms";
const IDS = [
  "ten-frame",
  "fraction",
  "ratio",
  "slope",
  "quadratic",
  "vertical-asymptote",
  "polar-form",
];
const payloads = Object.fromEntries(
  IDS.map((id) => {
    const p = glossaryPayload([], {}, [id]);
    assert.ok(p.glossary.some((c) => c.id === id), `no card for ${id}`);
    return [id, p];
  }),
);

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GlossaryProvider} from '/src/web/ui/Glossary.tsx';
import {KeyWords} from '/src/web/ui/KeyWords.tsx';
import '/src/web/app/styles.ts';
const payloads=${JSON.stringify(payloads)};
const id=new URLSearchParams(location.search).get('term');
function App(){
  // Inside the app shell, as in practice (not .lesson-sheet, whose h2 rule
  // would also restyle the card heading).
  return <div className="shell app-shell"><main style={{maxWidth:720,margin:'auto',padding:12}}>
    <GlossaryProvider payload={payloads[id]}><article className="problem-lesson"><KeyWords ids={[id]}/></article></GlossaryProvider>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server } },
  appType: "custom",
  logLevel: "warn",
  plugins: [
    {
      name: "glossary-terms",
      resolveId(id) {
        if (id === "/glossary-terms-entry.tsx") return id;
      },
      load(id) {
        if (id === "/glossary-terms-entry.tsx") return entry;
      },
      configureServer(vite) {
        vite.middlewares.use("/glossary-terms", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              "/glossary-terms",
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>AMP</title></head><body><div id="root"></div><script type="module" src="/glossary-terms-entry.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");

const VIEWPORTS = [
  { name: "phone", viewport: { width: 390, height: 844 }, dpr: 3, isMobile: true },
  { name: "tablet", viewport: { width: 1024, height: 768 }, dpr: 2, isMobile: false },
] as const;
/** Hide everything but the card, scrim included, for transparent crops. */
const CROP_STYLE = `html,body,#root{background:transparent!important}
#root{visibility:hidden}.term-dialog{visibility:visible}
.term-dialog::backdrop{background:transparent!important}
.term-card{box-shadow:none!important}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const terms: Record<string, unknown>[] = [];
try {
  for (const id of IDS) {
    const card = payloads[id]!.glossary.find((c) => c.id === id)!;
    const record: Record<string, unknown> = {
      id,
      term: card.term,
      band: glossary.find((e) => e.id === id)!.band,
      definition: card.plain,
      example: card.example ?? null,
      figure: card.figure ? glossary.find((e) => e.id === id)!.figure : null,
      linkedInCard: Object.entries(card.lexicon ?? {})
        .filter(([, t]) => t)
        .map(([form, t]) => ({ form, id: t })),
    };
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: vp.viewport,
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        hasTouch: true,
        colorScheme: "light",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning")
          errors.push(`${m.type()}: ${m.text()}`);
      });
      await page.goto(
        `http://127.0.0.1:${address.port}/glossary-terms?term=${id}`,
      );
      const chip = page.locator(`.key-word[data-term-id="${id}"]`);
      await chip.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await chip.tap();
      const dialog = page.locator(".term-dialog[open]");
      await dialog.waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Let Chromium's transient tap highlight on the chip fade out.
      await page.waitForTimeout(1000);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            for (const a of document.getAnimations()) a.finish();
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const panel = dialog.locator(".term-card");
      const m = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const body = el.querySelector(".term-card-body")!.getBoundingClientRect();
        const katexErrors = el.querySelectorAll(".katex-error").length;
        return {
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          contentBottom: body.bottom,
          scrolls: el.scrollHeight > el.clientHeight + 1,
          katexErrors,
          hasFigure: !!el.querySelector(".term-card-figure svg"),
          heading: el.querySelector("h2")!.textContent,
          text: el.querySelector(".term-card-plain")!.textContent,
        };
      });
      assert.equal(m.scrolls, false, `${id} ${vp.name}: card scrolls`);
      assert.equal(m.katexErrors, 0, `${id} ${vp.name}: KaTeX error`);
      assert.equal(!!card.figure, m.hasFigure, `${id}: figure rendered`);
      const files: Record<string, string> = {};
      if (vp.name === "phone") {
        files.full = `phone-term-${id}.png`;
        await page.screenshot({ path: `${OUT}/${files.full}` });
      }
      await page.addStyleTag({ content: CROP_STYLE });
      files.crop =
        vp.name === "phone" ? `term-${id}-sheet.png` : `tablet-term-${id}-card.png`;
      await panel.screenshot({ path: `${OUT}/${files.crop}`, omitBackground: true });
      const b = m.box;
      record[vp.name] = {
        viewport: vp.viewport,
        deviceScaleFactor: vp.dpr,
        files,
        cropBox: {
          css: b,
          device: {
            x: Math.round(b.x * vp.dpr),
            y: Math.round(b.y * vp.dpr),
            width: Math.round(b.width * vp.dpr),
            height: Math.round(b.height * vp.dpr),
          },
        },
        contentBottomCss: m.contentBottom,
        renderedHeading: m.heading,
        renderedDefinition: m.text,
      };
      assert.deepEqual(errors, [], `${id} ${vp.name}: console errors`);
      await context.close();
    }
    terms.push(record);
    console.log(id, "ok");
  }
  await writeFile(
    `${OUT}/terms.json`,
    JSON.stringify(
      {
        sourceCommit: "cd71711864e61fd20ffed7ba41ef6baa666ed07c",
        script: "amp/ad-capture/glossary-terms.ts",
        command: "cd amp && npx tsx ad-capture/glossary-terms.ts",
        colorScheme: "light",
        how: "Each card is the real TermCard opened from the real KeyWords chip, with the payload from glossaryPayload([], {}, [id]) (the server's card builder). Crops are element screenshots of .term-card with the page, scrim and card shadow hidden, so corners outside the rounded panel are transparent. Phone crop = the whole bottom sheet (its top edge to the viewport bottom, including its own bottom padding); tablet crop = the anchored card.",
        context: "Mounted in div.shell.app-shell, as the practice workspace is, so the card heading has the same bold sans as the drill-down capture. Note: on the LessonIndex page (.lesson-sheet) the theme rule '.lesson-sheet h2' also catches the card heading and sets it in the serif at weight 400.",
        note: "renderedDefinition is the DOM text, where each linked word is followed by its '?' mark.",
        terms,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await vite.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

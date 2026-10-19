/**
 * Scene timelines in a real browser: the two flagship walkthroughs in a
 * lesson (revealed) and in a hint (the learner's own masked scene and its
 * cue), at 320, 390, 768 and 1280 px in light and dark.
 *
 *   npx tsx scripts/verify-scene-player-ui.ts   screenshots in artifacts/scene-player/
 *
 * Fails on horizontal overflow, a panel that changes size between steps,
 * controls under 44 px, playback that does not finish, or a reduced-motion
 * view that is not the final frame with every caption.
 */
import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { problemLesson } from "../src/content/problem-lessons";
import { generateProblem } from "../src/math/engine";

const lessons = [
  problemLesson("add-within-20", "scene-player"),
  problemLesson("tens-contribution", "scene-player"),
];
const hints = ["add-within-20", "tens-contribution"].map((id, i) => {
  // A crossing-ten sum makes the two-jump hint.
  for (let s = 0; ; s++) {
    const p = generateProblem(id, `scene-hint-${i}-${s}`);
    const prompt = p.public.prompt.match(/\d+/g)!.map(Number);
    if (
      id !== "add-within-20" ||
      (prompt[0]! < 10 && prompt[0]! + prompt[1]! > 10)
    )
      return {
        id: p.public.id,
        figure: p.public.figure,
        cue: p.hintCue ?? null,
      };
  }
});
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/web/style.css';import '/src/web/theme.css';import '/node_modules/katex/dist/katex.min.css';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import {ScenePlayer} from '/src/web/scene/ScenePlayer.tsx';
const q = new URLSearchParams(location.search);
document.documentElement.dataset.theme = q.get('theme') || 'light';
const lessons = ${JSON.stringify(lessons)};
const hints = ${JSON.stringify(hints)};
const h = React.createElement;
const which = q.get('view');
const i = Number(q.get('i'));
function App(){
  return h('main',{style:{maxWidth:660, margin:'0 auto', padding:'8px 16px'}},
    which === 'lesson'
      ? h(ProblemLesson,{lesson: lessons[i]})
      : h('div',{role:'dialog','aria-label':'Hint'}, h('p',{className:'hint'},'Hint text'), h(ScenePlayer,{scene: hints[i].figure.scene, mode:'hint', cue: hints[i].cue ?? undefined})));
}
createRoot(document.getElementById('root')).render(h(App));
`;
const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server }, fs: { strict: false } },
  appType: "custom",
  logLevel: "error",
  plugins: [
    {
      name: "scene-player",
      resolveId(id) {
        if (id === "/scene-player-entry.tsx") return id;
      },
      load(id) {
        if (id === "/scene-player-entry.tsx") return entry;
      },
      configureServer(server) {
        server.middlewares.use("/scene-player", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/scene-player",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:var(--color-surface);color:var(--color-on-surface)"><div id="root"></div><script type="module" src="/scene-player-entry.tsx"></script></body></html>`,
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
const out = new URL("../artifacts/scene-player/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const failures: string[] = [];
const views = [
  ["lesson", 0, "lesson-add"],
  ["lesson", 1, "lesson-area"],
  ["hint", 0, "hint-add"],
  ["hint", 1, "hint-area"],
] as const;
try {
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 768, 1280])
      for (const [view, i, name] of views) {
        const tag = `${name} ${theme} ${width}`;
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
        });
        page.on("pageerror", (e) => failures.push(`${tag}: ${e.message}`));
        page.on(
          "console",
          (m) => m.type() === "error" && failures.push(`${tag}: ${m.text()}`),
        );
        await page.goto(
          `http://127.0.0.1:${address.port}/scene-player?view=${view}&i=${i}&theme=${theme}`,
        );
        const panel = page.locator(".scene-player");
        await panel.waitFor();
        await page.evaluate(() => document.fonts.ready);
        await panel.scrollIntoViewIfNeeded();
        const box = async () => {
          const b = (await panel.boundingBox())!;
          return `${b.width.toFixed(1)}x${b.height.toFixed(1)}`;
        };
        const initial = await box();
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          failures.push(`${tag}: horizontal overflow`);
        for (const button of await panel.locator("button").all()) {
          const b = (await button.boundingBox())!;
          if (b.height < 44) failures.push(`${tag}: control under 44 px`);
        }
        if (theme === "light" || width === 390)
          await panel.screenshot({
            path: new URL(`${name}-${theme}-${width}-start.png`, out).pathname,
          });
        // Step through with Next: the panel keeps its size at every step.
        const count = Number(
          (await panel
            .locator(".scene-player-count")
            .first()
            .textContent())!.split("/")[1],
        );
        for (let s = 0; s < count; s++) {
          await panel.getByRole("button", { name: "Next" }).click();
          if ((await box()) !== initial)
            failures.push(`${tag}: panel resized at step ${s + 1}`);
          if (s === 1 && (theme === "light" || width === 390))
            await panel.screenshot({
              path: new URL(`${name}-${theme}-${width}-step.png`, out).pathname,
            });
        }
        if ((await panel.getAttribute("data-done")) !== "true")
          failures.push(`${tag}: Next did not finish`);
        if (theme === "light" || width === 390)
          await panel.screenshot({
            path: new URL(`${name}-${theme}-${width}-end.png`, out).pathname,
          });
        // Replay from the start with Play: it runs to the end on its own.
        if (width === 390) {
          await panel.getByRole("button", { name: "Replay" }).click();
          await page.waitForFunction(
            () =>
              document
                .querySelector(".scene-player")
                ?.getAttribute("data-done") === "true",
            undefined,
            { timeout: 30000 },
          );
          if ((await box()) !== initial)
            failures.push(`${tag}: panel resized during playback`);
        }
        await page.close();
      }
  // Reduced motion: the final frame and every caption, no controls.
  const page = await browser.newPage({
    viewport: { width: 390, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto(
    `http://127.0.0.1:${address.port}/scene-player?view=lesson&i=1`,
  );
  const panel = page.locator(".scene-player");
  await panel.waitFor();
  assert.equal(await panel.getAttribute("data-done"), "true");
  assert.equal(await panel.locator("button").count(), 0);
  assert.equal(
    await panel.locator(".scene-player-all li").count(),
    lessons[1]!.example.figure!.kind === "scene" ? 5 : -1,
  );
  await panel.screenshot({
    path: new URL("lesson-area-reduced-390.png", out).pathname,
  });
  await page.close();
} finally {
  await browser.close();
  server.close();
  await vite.close();
}
if (failures.length) {
  console.error(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log(`scene player: ${views.length * 8} views verified`);

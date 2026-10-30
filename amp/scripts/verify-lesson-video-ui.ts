import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { problemLesson } from "../src/content/problem-lessons";
import nativeConfig from "../mobile/tauri.conf.json";

// Apply the native preview's actual media restrictions to browser playback.
const mediaCsp = nativeConfig.app.security.csp
  .split(";")
  .filter((directive) => /^\s*(img-src|media-src) /.test(directive))
  .join(";");

const lesson = problemLesson("add-fractions", "library");
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import {FocusDialog} from '/src/web/PracticeWorkspace.tsx';
import '/src/web/app/styles.ts';
function App(){const [modal,setModal]=React.useState(false);const lesson=${JSON.stringify(lesson)};return <main style={{maxWidth:720,margin:'auto',padding:12}}><button onClick={()=>setModal(true)}>Open practice lesson</button>{modal ? <FocusDialog title={lesson.title} close={()=>setModal(false)}><ProblemLesson lesson={lesson}/></FocusDialog> : <section className="lesson-sheet"><h2>{lesson.title}</h2><ProblemLesson lesson={lesson}/></section>}</main>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server } },
  appType: "custom",
  plugins: [
    {
      name: "lesson-video-review",
      resolveId(id) {
        if (id === "/video-review-entry.tsx") return id;
      },
      load(id) {
        if (id === "/video-review-entry.tsx") return entry;
      },
      configureServer(vite) {
        vite.middlewares.use("/video-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Content-Security-Policy", mediaCsp);
          res.end(
            await vite.transformIndexHtml(
              "/video-review",
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/video-review-entry.tsx"></script></body></html>',
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
const output =
  process.env.AMP_VIDEO_REVIEW_OUTPUT ?? "/tmp/amp-lesson-video-ui";
await mkdir(output, { recursive: true });
const metrics: unknown[] = [];
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 390, 768, 1280]) {
        for (const colorScheme of ["light", "dark"] as const) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
            colorScheme,
          });
          const requests: string[] = [],
            errors: string[] = [];
          page.on("request", (r) => requests.push(r.url()));
          page.on("pageerror", (e) => {
            errors.push(e.message);
            console.error(e.message);
          });
          await page.goto(`http://127.0.0.1:${address.port}/video-review`);
          await page
            .getByRole("button", { name: "Watch an example" })
            .waitFor();
          assert(
            !requests.some((url) => url.includes("/amp/lessons/")),
            "Media requested before opening",
          );
          for (const mode of ["library", "practice"]) {
            console.log(engine.name(), width, colorScheme, mode);
            if (mode === "practice")
              await page
                .getByRole("button", { name: "Open practice lesson" })
                .click();
            await page
              .getByRole("button", { name: "Watch an example" })
              .click();
            const video = page.locator("video");
            assert.equal(await video.getAttribute("preload"), "none");
            assert.equal(
              await video.evaluate((v: HTMLVideoElement) => v.paused),
              true,
            );
            await video.evaluate(async (v: HTMLVideoElement) => {
              v.muted = true;
              await v.play();
              // Safari respects the OS caption preference over the track's
              // default flag. Enable it as a viewer would via the CC control.
              v.textTracks[0].mode = "showing";
            });
            await page
              .waitForFunction(() => {
                const v = document.querySelector("video")!;
                return v.currentTime > 0 && v.textTracks[0]?.cues?.length;
              })
              .catch(async (error) => {
                console.error(
                  await video.evaluate((v: HTMLVideoElement) => ({
                    time: v.currentTime,
                    paused: v.paused,
                    readyState: v.readyState,
                    error: v.error?.message,
                    track: v.querySelector("track")?.readyState,
                    cues: v.textTracks[0]?.cues?.length,
                    captionMode: v.textTracks[0]?.mode,
                  })),
                );
                throw error;
              });
            const media = await video.evaluate((v: HTMLVideoElement) => {
              v.pause();
              v.currentTime = 39;
              return {
                duration: v.duration,
                width: v.videoWidth,
                height: v.videoHeight,
                captionMode: v.textTracks[0].mode,
                cues: v.textTracks[0].cues?.length,
              };
            });
            assert(Math.abs(media.duration - 69.033333) < 0.1);
            assert.equal(media.width, 1920);
            assert.equal(media.captionMode, "showing");
            await page.waitForFunction(
              () => !document.querySelector("video")!.seeking,
            );
            const bounds = await video.boundingBox();
            assert(
              bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
            );
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
            await page.screenshot({
              path: `${output}/${engine.name()}-${width}-${colorScheme}-${mode}.png`,
              fullPage: true,
            });
            await page
              .getByText("Read the video transcript", { exact: true })
              .click();
            assert(
              await page
                .getByText("How do you add two thirds and one fourth?", {
                  exact: true,
                })
                .isVisible(),
            );
            await video.evaluate(async (v: HTMLVideoElement) => {
              await v.play();
            });
            await page.getByRole("button", { name: "Close video" }).click();
            assert.equal(
              await page.locator("video").count(),
              0,
              "Closing removes playing media",
            );
            if (mode === "practice") {
              await page.keyboard.press("Escape");
              assert.equal(await page.getByRole("dialog").count(), 0);
            }
            metrics.push({
              browser: engine.name(),
              viewportWidth: width,
              colorScheme,
              mode,
              ...media,
            });
          }
          // A failed media request leaves the transcript and written example usable.
          if (width === 390 && colorScheme === "light") {
            await page.route("**/*.mp4", (route) => route.abort());
            await page
              .getByRole("button", { name: "Watch an example" })
              .click();
            await page.locator("video").evaluate((v: HTMLVideoElement) => {
              v.load();
            });
            await page
              .getByText("The video could not load.", { exact: false })
              .waitFor();
            await page
              .getByText("Read the video transcript", { exact: true })
              .click();
            assert(
              await page
                .getByRole("heading", { name: "Method", exact: true })
                .isVisible(),
            );
            await page.unroute("**/*.mp4");
            await page.getByRole("button", { name: "Try again" }).click();
            await page
              .locator("video")
              .evaluate(async (v: HTMLVideoElement) => {
                v.muted = true;
                await v.play();
              });
          }
          assert.deepEqual(errors, []);
          assert(
            !requests.some((url) =>
              /youtube|googlevideo|doubleclick/.test(url),
            ),
          );
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`Verified ${metrics.length} lesson views; evidence: ${output}`);
} finally {
  await vite.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

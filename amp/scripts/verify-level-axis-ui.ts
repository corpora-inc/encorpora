import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { chromium, firefox } from "playwright";
import { createServer } from "vite";
const root = new URL("../", import.meta.url).pathname;
const dir = root + "artifacts/level-axis/";
await mkdir(dir, { recursive: true });
const entry = dir + "fixture.tsx",
  html = dir + "index.html";
await writeFile(
  entry,
  `import React from 'react';import{createRoot}from'react-dom/client';import{LevelAxis,LevelTrack}from'../../src/web/ui/LevelChart';import{gradeName}from'../../src/web/Home';import '../../src/web/ui/tokens.css';import '../../src/web/theme.css';
const scales=[{lo:4,hi:13,center:12},{lo:7,hi:13,center:13},{lo:0,hi:6,center:0},{lo:0,hi:6,center:3},{lo:0,hi:13,center:12}];
createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:900,margin:'auto'}}><h1>Level scale</h1>{scales.map((scale,i)=><section key={i} data-axis-case={i} style={{margin:'32px 0',padding:16,border:'1px solid var(--color-border)',borderRadius:16}}><LevelTrack estimate={{level:8,sd:1}} scale={scale}/><div style={{marginTop:12}}><LevelAxis scale={scale} name={gradeName}/></div></section>)}</main>);`,
);
await writeFile(
  html,
  `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/artifacts/level-axis/fixture.tsx"></script></body></html>`,
);
const server = await createServer({
  root,
  configFile: root + "vite.config.ts",
  server: {
    host: "127.0.0.1",
    port: 4460,
    strictPort: true,
    fs: { allow: [root, realpathSync(root + "node_modules")] },
  },
});
await server.listen();
try {
  for (const [name, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      for (const width of [320, 384, 390, 768, 1280])
        for (const theme of ["light", "dark"]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(
            "http://127.0.0.1:4460/artifacts/level-axis/index.html",
          );
          await page.locator('[data-axis-case="4"]').waitFor();
          await page.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          for (const zoom of [1, 2]) {
            await page.evaluate(
              (zoom) => (document.body.style.zoom = String(zoom)),
              zoom,
            );
            await page.evaluate(
              () =>
                new Promise((r) =>
                  requestAnimationFrame(() => requestAnimationFrame(r)),
                ),
            );
            const cases = await page
              .locator("[data-axis-case]")
              .evaluateAll((sections) =>
                sections.map((section) => {
                  const labels = [
                    ...section.querySelectorAll('span[aria-hidden="true"]'),
                  ].at(-1)!.children;
                  return [...labels]
                    .filter((n) => getComputedStyle(n).visibility !== "hidden")
                    .map((n) => {
                      const b = n.getBoundingClientRect();
                      return {
                        text: n.textContent,
                        left: b.left,
                        right: b.right,
                        top: b.top,
                        bottom: b.bottom,
                      };
                    });
                }),
              );
            if (width >= 384 && zoom === 1)
              assert.equal(
                cases[3]!.length,
                3,
                "show the middle label when it fits",
              );
            for (const labels of cases) {
              assert.ok(labels.length >= 2);
              for (let i = 0; i < labels.length; i++)
                for (let j = i + 1; j < labels.length; j++) {
                  const a = labels[i]!,
                    b = labels[j]!;
                  assert.ok(
                    a.right <= b.left ||
                      b.right <= a.left ||
                      a.bottom <= b.top ||
                      b.bottom <= a.top,
                    `${name}/${width}/${theme}/${zoom}: ${a.text} overlaps ${b.text}`,
                  );
                }
            }
          }
          await page.evaluate(() => (document.body.style.zoom = "1"));
          await page.evaluate(
            () =>
              new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r)),
              ),
          );
          if (width === 384 && theme === "dark")
            await page.screenshot({ path: dir + name + "-phone.png" });
        }
    } finally {
      await browser.close();
    }
  }
  console.log(
    "Level axes: Chrome/Firefox, 320–1280 px, light/dark and 200% zoom; adult, edge and centered markers never overlap.",
  );
} finally {
  await server.close();
  await rm(entry);
  await rm(html);
}

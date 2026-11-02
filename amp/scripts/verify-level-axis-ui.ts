import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";
import { createServer } from "vite";
const root = new URL("../", import.meta.url).pathname;
const dir = root + "artifacts/level-axis/";
await mkdir(dir, { recursive: true });
const entry = dir + "fixture.tsx",
  html = dir + "index.html";
await writeFile(
  entry,
  `import React from 'react';import{createRoot}from'react-dom/client';import{LevelAxis,LevelTrack}from'../../src/web/ui/LevelChart';import{gradeName,FrontierMap}from'../../src/web/Home';import{CurriculumDetailsProvider,CurriculumDetailsControl}from'../../src/web/features/curriculum/CurriculumDetails';import{Checkbox}from'../../src/web/ui/Checkbox';import '../../src/web/ui/tokens.css';import '../../src/web/theme.css';
const scales=[{lo:4,hi:13,center:12},{lo:7,hi:13,center:13},{lo:0,hi:6,center:0},{lo:0,hi:6,center:3},{lo:0,hi:13,center:12}];
function Confirmation(){const[checked,set]=React.useState(false);return <Checkbox checked={checked} onChange={set}>Confirm example</Checkbox>};
const frontiers=[0,1,4,12,null];
createRoot(document.getElementById('root')).render(<CurriculumDetailsProvider><main style={{padding:24,maxWidth:900,margin:'auto'}}><h1>Level scale</h1><CurriculumDetailsControl/><Confirmation/>{frontiers.map((expected,i)=><section key={i} data-home-case={i} data-expected={expected??4} data-reference={expected!==null}><FrontierMap name="Example learner" birthYear={expected===null?null:2026-5-expected} frontier={{expected:expected??4,overall:{level:3,sd:1,answered:12,independent:10},strands:{operations:{level:3,sd:1,answered:12,independent:10}}}} strands={["operations","fractions"]}/></section>)}{scales.map((scale,i)=><section key={i} data-axis-case={i} style={{margin:'32px 0',padding:16,border:'1px solid var(--color-border)',borderRadius:16}}><LevelTrack estimate={{level:8,sd:1}} scale={scale}/><div style={{marginTop:12}}><LevelAxis scale={scale} name={gradeName}/></div></section>)}</main></CurriculumDetailsProvider>);`,
);
await writeFile(
  html,
  `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/artifacts/level-axis/fixture.tsx"></script></body></html>`,
);
const server = await createServer({
  root,
  plugins: [
    {
      name: "level-axis-scope",
      enforce: "pre",
      load(id) {
        if (
          id.split("?")[0] ===
          fileURLToPath(
            new URL(
              "../src/web/features/curriculum/useCurriculumScope.ts",
              import.meta.url,
            ),
          )
        )
          return 'export function useCurriculumScope(){return {scope:"axis-example",ready:true}}';
      },
    },
  ],
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
          // The real Home chart keeps its geometry and colors when only numbers change.
          const preference = page.getByRole("checkbox", {
            name: "Show grade numbers",
          });
          await preference.uncheck();
          const snapshot = () =>
            page.locator("[data-home-case]").evaluateAll((sections) =>
              sections.map((section) => {
                const tracks = [
                  ...section.querySelectorAll(".frontier-track"),
                ].map((track) => {
                  const bounds = track.getBoundingClientRect();
                  return {
                    width: bounds.width,
                    height: bounds.height,
                    color: getComputedStyle(track).backgroundColor,
                    parts: [...track.children].map((child) => {
                      const b = child.getBoundingClientRect();
                      const style = getComputedStyle(child);
                      return {
                        kind: child.className,
                        x: b.x - bounds.x,
                        y: b.y - bounds.y,
                        width: b.width,
                        height: b.height,
                        background: style.background,
                        border: style.border,
                      };
                    }),
                  };
                });
                return tracks;
              }),
            );
          const hidden = await snapshot();
          assert.equal(hidden.length, 5);
          for (const tracks of hidden)
            assert.equal(
              tracks.length,
              2,
              "default retains both measured and unpracticed area charts",
            );
          assert.equal(
            await page.locator(".frontier-track.estimated").count(),
            5,
          );
          const descriptions = await page
            .locator(".frontier-map")
            .evaluateAll((maps) =>
              maps.map((map) =>
                [
                  map.textContent,
                  ...[...map.querySelectorAll("[aria-label],[title]")].map(
                    (n) =>
                      n.getAttribute("aria-label") ?? n.getAttribute("title"),
                  ),
                ].join(" "),
              ),
            );
          assert(
            descriptions.every(
              (text) =>
                !/(?:Grade|Level)\s+\d|Kindergarten|Grade\s+\d|[0-9]\.[0-9]/i.test(
                  text,
                ),
            ),
            "hidden chart does not expose grade values in text, titles or accessible names",
          );
          for (let i = 0; i < 5; i++) {
            const section = page.locator(`[data-home-case="${i}"]`);
            const expected = Number(
              await section.getAttribute("data-expected"),
            );
            const markers = section.locator(".frontier-center");
            assert.equal(
              await markers.count(),
              i === 4 ? 0 : 2,
              "only known birth year supplies an age reference",
            );
            if (i !== 4) {
              const lo = Math.max(0, Math.min(expected - 3, 7));
              const fraction =
                (Math.min(lo + 6, Math.max(lo, expected)) - lo) / 6;
              for (const left of await markers.evaluateAll((nodes) =>
                nodes.map((n) => parseFloat((n as HTMLElement).style.left)),
              ))
                assert(
                  Math.abs(left - fraction * 100) < 0.001,
                  `age reference ${expected} is placed on its actual scale`,
                );
            }
          }
          await preference.focus();
          await page.keyboard.press("Space");
          assert(
            await preference.isChecked(),
            "Space reveals numbers through the native checkbox",
          );
          assert.deepEqual(
            await snapshot(),
            hidden,
            "revealing grade values cannot move or recolor chart parts",
          );
          for (const label of ["Show grade numbers", "Confirm example"]) {
            const control = page.getByRole("checkbox", { name: label });
            await control.scrollIntoViewIfNeeded();
            const geometry = await control.evaluate((input) => {
              const r = input.getBoundingClientRect(),
                indicator = input.nextElementSibling!.getBoundingClientRect();
              return {
                width: r.width,
                height: r.height,
                indicatorWidth: indicator.width,
                indicatorHeight: indicator.height,
                hit:
                  document.elementFromPoint(
                    r.x + r.width / 2,
                    r.y + r.height / 2,
                  ) === input,
              };
            });
            assert(
              geometry.width >= 44 && geometry.height >= 44,
              `${label}: full input target`,
            );
            assert(
              geometry.hit,
              `${label}: the indicator is inside the input hit surface`,
            );
            assert.equal(geometry.indicatorWidth, 24);
            assert.equal(geometry.indicatorHeight, 24);
            await control.focus();
            await page.keyboard.press("Space");
            assert.equal(
              await control.evaluate((input) =>
                input.matches(":focus-visible"),
              ),
              true,
            );
            await control.check();
          }
          const actualLabels = await page
            .locator(".frontier-axis")
            .evaluateAll((axes) =>
              axes.map((axis) =>
                [...axis.querySelectorAll("span")]
                  .filter(
                    (n) =>
                      !n.children.length &&
                      n.textContent &&
                      getComputedStyle(n).visibility !== "hidden",
                  )
                  .map((n) => ({
                    text: n.textContent,
                    left: n.getBoundingClientRect().left,
                    right: n.getBoundingClientRect().right,
                  })),
              ),
            );
          for (const labels of actualLabels) {
            assert(
              labels.length >= 2,
              "revealed Home axes retain both end labels",
            );
            for (let i = 0; i < labels.length; i++)
              for (let j = i + 1; j < labels.length; j++)
                assert(
                  labels[i]!.right <= labels[j]!.left ||
                    labels[j]!.right <= labels[i]!.left,
                  "Home edge labels do not overlap",
                );
          }
          await preference.uncheck();
          assert.deepEqual(
            await snapshot(),
            hidden,
            "hiding numbers preserves the same chart",
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

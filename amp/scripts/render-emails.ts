/**
 * Renders every email AMP sends (scripts/email-previews.ts, synthetic data)
 * for review. Nothing is sent.
 *
 *   npx tsx scripts/render-emails.ts <out-dir> [--shots]
 *
 * Writes <id>.html and <id>.txt per email and an index.html. With --shots it
 * also screenshots each one in light and dark at 320 and 600 px
 * (<id>-<theme>-<width>.png) and lays the four side by side in <id>.png.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { emailPreviews } from "./email-previews";

const out = process.argv[2];
if (!out) throw new Error("Pass an output directory");
const dir = resolve(out);
await mkdir(dir, { recursive: true });
const previews = emailPreviews();
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
for (const { id, email } of previews) {
  await writeFile(join(dir, `${id}.html`), email.html);
  await writeFile(
    join(dir, `${id}.txt`),
    `Subject: ${email.subject}\n\n${email.text}\n`,
  );
}
await writeFile(
  join(dir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>AMP emails</title>
<body style="font-family:system-ui;margin:24px;line-height:1.6">
<h1>AMP emails (${previews.length})</h1><ol>${previews
    .map(
      ({ id, title, email }) =>
        `<li><a href="${id}.html">${escape(title)}</a> · <a href="${id}.txt">text</a><br><small>${escape(email.subject)}</small></li>`,
    )
    .join("")}</ol></body>`,
);
console.log(`Rendered ${previews.length} emails to ${dir}`);

if (process.argv.includes("--shots")) {
  const browser = await secureChromium(chromium).launch();
  const shots: [theme: "light" | "dark", width: number][] = [
    ["light", 320],
    ["dark", 320],
    ["light", 600],
    ["dark", 600],
  ];
  for (const { id } of previews) {
    for (const [theme, width] of shots) {
      const page = await browser.newPage({
        viewport: { width, height: 600 },
        colorScheme: theme,
        deviceScaleFactor: 2,
      });
      await page.goto(pathToFileURL(join(dir, `${id}.html`)).href, {
        waitUntil: "networkidle",
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0)
        throw new Error(`${id} overflows ${width} px by ${overflow} px`);
      await page.screenshot({
        path: join(dir, `${id}-${theme}-${width}.png`),
        fullPage: true,
      });
      await page.close();
    }
    // The four side by side, for the pull request.
    const sheet = await browser.newPage({
      viewport: { width: 1960, height: 600 },
      deviceScaleFactor: 1,
    });
    const sheetFile = join(dir, "sheet.html");
    await writeFile(
      sheetFile,
      `<!doctype html><body style="margin:0;background:#888;display:flex;gap:16px;align-items:flex-start;padding:16px">${shots
        .map(
          ([theme, width]) =>
            `<img style="width:${width}px" src="${id}-${theme}-${width}.png">`,
        )
        .join("")}</body>`,
    );
    await sheet.goto(pathToFileURL(sheetFile).href, { waitUntil: "load" });
    await sheet.screenshot({ path: join(dir, `${id}.png`), fullPage: true });
    await sheet.close();
  }
  await browser.close();
  console.log(`Screenshots in ${dir}`);
}

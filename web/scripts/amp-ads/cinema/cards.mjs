// Render full-frame transparent text-card PNGs with Playwright.
// Every card is laid out in a flex box centred on the frame and shrunk until it
// fits the centred text area the Python side passes in (spec.text_area). Each
// card is written twice from the same DOM: <name>.png (with its darkening scrim,
// composited into the video) and <name>.text.png (text only, which the Python
// safe-zone gate measures pixel by pixel). Usage: node cards.mjs <job.json>
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function html(item) {
  const [w, h] = [item.width, item.height];
  const end = item.kind === "end";
  const scrim = end
    ? "rgba(4,13,24,.9)"
    : "radial-gradient(ellipse at center, rgba(4,10,18,.55) 0, rgba(4,10,18,.28) 45%, rgba(4,10,18,0) 75%)";
  const body = end
    ? `<div class="brand">${esc(item.brand)}</div><div class="tagline">${esc(item.tagline)}</div><div class="bar"></div><div class="cta">${esc(item.cta)}</div><div class="url">${esc(item.url)}</div>`
    : esc(item.text);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden;background:transparent}
.scrim{position:absolute;inset:0;background:${scrim}}
.stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
#t{color:#fff;font-family:'Avenir Next','Helvetica Neue',Arial,sans-serif;text-align:center;white-space:pre-line;
 text-wrap:balance;max-width:${Math.floor(item.area[0] * 0.92)}px;line-height:1.08;letter-spacing:-.02em;font-weight:700;
 text-shadow:0 .03em .18em rgba(0,0,0,.45)}
#t.end{display:flex;flex-direction:column;align-items:center}.brand,.cta,.url{white-space:nowrap}
.brand{font-size:3.6em;font-weight:800;letter-spacing:-.04em;line-height:1}
.tagline{font-size:1em;font-weight:500;margin-top:.35em}
.bar{width:3.2em;height:.12em;background:#6ce2d0;margin:.8em 0}
.cta{font-size:1.2em;font-weight:700}
.url{font-size:.8em;font-weight:500;color:#a5eee4;margin-top:.5em}
</style></head><body><div class="scrim"></div><div class="stage"><div id="t" class="${end ? "end" : ""}">${body}</div></div></body></html>`;
}

async function fit(page, item) {
  const [aw, ah] = item.area;
  const start = item.kind === "end" ? Math.min(item.width, item.height) * 0.07 : Math.min(item.width, item.height) * 0.11;
  return page.evaluate(
    ({ aw, ah, start }) => {
      const t = document.getElementById("t");
      let size = start;
      for (let i = 0; i < 200; i++) {
        t.style.fontSize = size + "px";
        // Measure the laid-out content itself, not the container, so overflow counts.
        const range = document.createRange();
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (r.width <= aw * 0.92 && r.height <= ah * 0.92) return { size, box: [r.left, r.top, r.right, r.bottom] };
        size *= 0.96;
      }
      throw new Error("text cannot fit the centred safe area; shorten it");
    },
    { aw, ah, start },
  );
}

export async function renderCards(job) {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const item of job.items) {
      const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
      await page.setContent(html(item));
      await page.evaluate(() => document.fonts.ready);
      const layout = await fit(page, item);
      await page.screenshot({ path: item.out, omitBackground: true });
      await page.addStyleTag({ content: ".scrim{display:none}" });
      await page.screenshot({ path: item.textOut, omitBackground: true });
      results.push({ name: item.name, fontSize: layout.size, domBox: layout.box });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const job = JSON.parse(await readFile(process.argv[2], "utf8"));
  console.log(JSON.stringify(await renderCards(job)));
}

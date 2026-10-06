/** Diagram contrast guard (TEST-ONLY). Renders every Activity Spec TEST FIXTURE and every local task
 * visual in light AND dark, then measures, in the browser, what a learner actually sees:
 *   - every SVG <text>/<tspan> (and every text run in a figure's HTML) against the effective colour
 *     behind it: its own paint-order halo when it has one, else every filled layer under it, composited.
 *     WCAG AA: 4.5:1, or 3:1 for large text (24px, or 18.66px bold).
 *   - every stroke-only mark (lines, ticks, axes, outlines, arcs) against what is behind it: 3:1.
 * Decorative texture is exempt only by an explicit class (DECORATIVE below), never by colour.
 * Used by verify-ui.mjs; run alone with `npm run contrast`. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

/** Background texture whose information is carried elsewhere (labelled axes, ticks, unit squares). */
const DECORATIVE = ['ax-grid', 'ax-graph-minor', 'ax-graph-major', 'grid-line'];

/** Runs in the page. Returns one line per violation inside every element matching `figureSel`. */
function measure({ figureSel, decorative }) {
  const ctx = document.createElement('canvas').getContext('2d');
  const rgba = (css) => {
    if (!css || css === 'none' || css.startsWith('url(')) return null;
    ctx.fillStyle = '#000'; ctx.fillStyle = css;
    const s = ctx.fillStyle; // "#rrggbb" or "rgba(r, g, b, a)"
    if (s.startsWith('#')) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat(1);
    const m = s.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const over = (top, a, bottom) => top.slice(0, 3).map((c, i) => c * a + bottom[i] * (1 - a));
  const lum = (c) => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const opacity = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const isSvg = (el) => el instanceof SVGElement;
  const name = (el) => `${el.tagName.toLowerCase()}${[...el.classList].map(c => `.${c}`).join('')}`;
  // Hit-test fills only: strokes and glyphs are never "behind" anything.
  const style = document.createElement('style');
  style.textContent = '* { pointer-events: auto !important; } svg * { pointer-events: visibleFill !important; } svg text, svg tspan { pointer-events: none !important; }';
  document.head.append(style);
  const pageBg = rgba(getComputedStyle(document.documentElement).backgroundColor);
  const base = pageBg && pageBg[3] === 1 ? pageBg.slice(0, 3) : (matchMedia('(prefers-color-scheme: dark)').matches ? [0, 0, 0] : [255, 255, 255]);
  /** The colour behind (x, y) for `self`: every filled layer painted before it, composited bottom first. */
  const behind = (x, y, self) => {
    const layers = [];
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === self || self.contains(el)) continue;
      // Only what is painted under `self`: its ancestors and everything earlier in document order.
      if (!el.contains(self) && !(self.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      let c, a;
      if (isSvg(el)) {
        if (el instanceof SVGSVGElement || el instanceof SVGGElement) continue;
        c = rgba(cs.fill); if (!c) continue;
        a = c[3] * +cs.fillOpacity * opacity(el);
      } else {
        c = rgba(cs.backgroundColor); if (!c) continue;
        a = c[3] * opacity(el);
      }
      if (a <= 0.001) continue;
      layers.push([c, a]);
      if (a >= 0.999) break;
    }
    return layers.reverse().reduce((bg, [c, a]) => over(c, a, bg), base);
  };
  const bad = [];
  for (const fig of document.querySelectorAll(figureSel)) {
    fig.scrollIntoView({ block: 'center' });
    const where = fig.closest('[data-fixture],[data-visual]');
    const id = where?.dataset.fixture ?? where?.dataset.visual ?? '?';
    // Text: SVG text/tspan, plus every HTML element that owns a non-empty text run.
    const texts = [...fig.querySelectorAll('text, tspan')].filter(t => t.tagName !== 'text' || !t.querySelector('tspan'));
    for (const el of fig.querySelectorAll('*:not(svg *)')) if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) texts.push(el);
    for (const el of texts) {
      if (el.closest('title, desc, .katex-mathml')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      const svg = isSvg(el);
      const fg = rgba(svg ? cs.fill : cs.color);
      if (!fg) { bad.push(`${id}: ${name(el)} "${el.textContent.trim().slice(0, 20)}" has no fill`); continue; }
      const scale = svg ? (el.ownerSVGElement?.getScreenCTM()?.a ?? 1) : 1;
      const px = parseFloat(cs.fontSize) * scale, bold = +cs.fontWeight >= 700;
      const large = px >= 24 || (bold && px >= 18.66);
      const need = large ? 3 : 4.5;
      const alpha = fg[3] * (svg ? +cs.fillOpacity : 1) * opacity(el);
      // A paint-order halo at least 2px wide is the background the glyph edges sit on.
      const halo = svg && cs.paintOrder.startsWith('stroke') && rgba(cs.stroke) && parseFloat(cs.strokeWidth) * scale >= 2 ? rgba(cs.stroke) : null;
      let worst = Infinity, at = null;
      for (const fx of [0.25, 0.5, 0.75]) {
        const x = r.left + r.width * fx, y = r.top + r.height / 2;
        const under = behind(x, y, el);
        const bg = halo ? over(halo, halo[3] * +cs.strokeOpacity * opacity(el), under) : under;
        const k = ratio(over(fg, alpha, bg), bg);
        if (k < worst) { worst = k; at = bg; }
      }
      if (worst < need) bad.push(`${id}: ${name(el)} "${el.textContent.trim().slice(0, 20)}" ${worst.toFixed(2)}:1 < ${need}:1 (fill ${cs.fill === 'none' ? cs.color : svg ? cs.fill : cs.color} on rgb(${at.map(Math.round).join(', ')}))`);
    }
    // Stroke-only marks.
    for (const el of fig.querySelectorAll('svg :is(line, path, polyline, polygon, circle, ellipse, rect)')) {
      if (el.closest('defs, clipPath, marker, mask')) continue;
      if (decorative.some(c => el.classList.contains(c) || el.parentElement?.classList.contains(c))) continue;
      const cs = getComputedStyle(el);
      if (rgba(cs.fill) && +cs.fillOpacity > 0) continue;
      const st = rgba(cs.stroke);
      if (!st || parseFloat(cs.strokeWidth) <= 0) continue;
      const total = el.getTotalLength(), m = el.getScreenCTM();
      if (!(total > 0) || !m) continue;
      // Sample along the stroke and judge it by its weakest stretch. At each point the mark is an edge
      // between what lies either side of it, so it reads when it stands out from at least one side.
      const half = parseFloat(cs.strokeWidth) / 2 + 1.5, ink = (bg) => over(st, st[3] * +cs.strokeOpacity * opacity(el), bg);
      const screen = (p) => [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f];
      let worst = Infinity, at = null;
      for (const f of [0.15, 0.4, 0.6, 0.85]) {
        const p = el.getPointAtLength(total * f), q = el.getPointAtLength(Math.min(total, total * f + 0.5));
        const t = Math.hypot(q.x - p.x, q.y - p.y) || 1, n = { x: -(q.y - p.y) / t, y: (q.x - p.x) / t };
        const sides = [1, -1].map(s => behind(...screen({ x: p.x + n.x * half * s, y: p.y + n.y * half * s }), el));
        const best = sides.map(bg => [ratio(ink(bg), bg), bg]).sort((a, b) => b[0] - a[0])[0];
        if (best[0] < worst) { [worst, at] = best; }
      }
      if (worst < 3) bad.push(`${id}: stroke ${name(el)} ${worst.toFixed(2)}:1 < 3:1 (stroke ${cs.stroke} on rgb(${at.map(Math.round).join(', ')}))`);
    }
  }
  style.remove();
  return [...new Set(bad)];
}

/** Audits every fixture and local visual in light and dark; returns violations as `theme: line`. */
export async function auditFigureContrast(browser, base) {
  const out = [];
  let figures = 0;
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 2000 }, colorScheme: theme });
    const page = await context.newPage();
    const pages = [
      [`${base}/src/activity/gallery/index.html?theme=${theme}`, '.aha-activity'],
      [`${base}/src/ui/gallery/visuals.html`, '.math-visual'],
    ];
    for (const [url, ready] of pages) {
      await page.goto(url);
      await page.locator(ready).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const sel = '.ax-figure, .math-visual';
      figures += await page.locator(sel).count();
      for (const v of await page.evaluate(measure, { figureSel: sel, decorative: DECORATIVE })) out.push(`${theme}: ${v}`);
    }
    await context.close();
  }
  return { violations: out, figures };
}

if (import.meta.main) {
  const { chromium } = await import('playwright');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const port = Number(process.env.AHA_CONTRAST_PORT || 1441), base = `http://127.0.0.1:${port}`;
  const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; vite.stdout.on('data', b => log += b); vite.stderr.on('data', b => log += b);
  let browser;
  try {
    for (let i = 0; i < 150; i++) {
      if (vite.exitCode !== null) throw new Error(`Vite exited: ${log}`);
      try { if (stripVTControlCharacters(log).includes(base) && (await fetch(base)).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({ headless: true });
    const { violations, figures } = await auditFigureContrast(browser, base);
    if (violations.length) { console.log(`Diagram contrast violations (${violations.length}):\n${violations.join('\n')}`); process.exitCode = 1; }
    else console.log(`Diagram contrast: ${figures} figures in light and dark, every label and line passes.`);
  } finally { await browser?.close(); vite.kill(); }
}

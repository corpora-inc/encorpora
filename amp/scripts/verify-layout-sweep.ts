/**
 * Every screen, every width: the layout sweep (premium UI rules 1, 4 and 8
 * in /AGENTS.md). For each design-preview person (scripts/design-personas.ts)
 * and the signed-out pages, it finds the screens they can reach (their nav,
 * then one of each kind of page those link to: a child, a class, a student
 * layer, a skill or lesson sheet, the devices sheet, the setup steps), and
 * checks each at every width, light and dark:
 *
 *   overflow   the page scrolls sideways, or something sits off its edge
 *   overlap    two visible text-bearing or interactive boxes overlap (an
 *              open sheet, a fixed bar, a sticky header or a raised panel
 *              is its own layer)
 *   clipped    text cut by its container (hidden overflow, an ellipsis, a
 *              line clamp)
 *   target     a control under 44 × 44 px (links inside a sentence excepted)
 *   mid-word   a word broken across lines
 *   nested-scroll  at 768 px or less, a box that scrolls up and down inside
 *              the page (the page itself, a full-screen frame and a modal
 *              sheet's one scroll region excepted; sideways table scrollers
 *              are fine)
 *
 * Writes `<out>/<label>.json` and one marked screenshot per new failure under
 * `<out>/shots/<label>/`. Exits 1 when anything fails.
 *
 *   scripts/design-preview.sh start   # with AMP_WEB_PORT etc. of your own
 *   npx tsx scripts/verify-layout-sweep.ts --origin http://127.0.0.1:4840 \
 *     [--people family,teacher] [--widths 390,1280] [--schemes light] \
 *     [--label before] [--out <dir>] [--max-screens 40]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  PERSONA_PASSPHRASE,
  PREVIEW_PERSONAS,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { stubAnalytics } from "./analytics-stub";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const origin = argument("origin") ?? "http://127.0.0.1:4840";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
if (origin.endsWith(":4310")) throw new Error("4310 is the founder's preview");
const WIDTHS = (
  argument("widths") ?? "320,360,390,430,600,768,820,900,1024,1280,1440"
)
  .split(",")
  .map(Number);
const SCHEMES = (argument("schemes") ?? "light,dark").split(",") as (
  | "light"
  | "dark"
)[];
/** "signed-out" is the pitch and the schools page without an account. */
const PEOPLE = (
  argument("people") ??
  [
    "signed-out",
    ...PREVIEW_PERSONAS.map((persona) => persona.slug).filter(
      (slug) => slug !== "signed-up",
    ),
    "signed-up",
  ].join(",")
).split(",");
const LABEL = argument("label") ?? "sweep";
const OUT =
  argument("out") ??
  join(homedir(), ".config/corpora/amp-qa/reports/spaces/responsive");
const MAX_SCREENS = Number(argument("max-screens") ?? 40);
const ONLY = argument("screens"); // a substring of the screen's address
/** Only these kinds of failure (all when not given). */
const KINDS = argument("kinds")?.split(",");
const SHOTS = join(OUT, "shots", LABEL);
mkdirSync(SHOTS, { recursive: true });

/** Screens no link reaches: first-run steps and sheets opened by a button. */
const EXTRA: Record<string, string[]> = {
  "signed-out": ["/", "/schools", "/sign-in", "/sign-up"],
  "signed-up": [
    "/start",
    "/start/parent",
    "/start/parent/name",
    "/start/myself",
    "/start/school",
    "/school/start",
  ],
  "parent-new": ["/start/parent/ready"],
};
/** Sheets a button opens at the page's own address: swept over the page
 * whose shape matches. */
const SHEETS: { page: RegExp; search: string }[] = [
  { page: /^\/family\/:id$/, search: "devices=1" },
  { page: /^\/family\/:id\/kids\/:id$/, search: "devices=1" },
  // Pathways' one search, its results open, over each view.
  { page: /\/pathways$/, search: "topic=add" },
  { page: /\/pathways$/, search: "view=grades&topic=add" },
];
/** Addresses never opened: they sign out, sign someone else in, or leave. */
const SKIP =
  /^\/(api|dev)\/|^\/(c|p)(\/|$|\?)|^\/join(\/|$|\?)|sign-out|\.pdf(\?|$)|^\/design(\/|$)/;

type Failure = {
  kind:
    | "overflow"
    | "overlap"
    | "clipped"
    | "target"
    | "mid-word"
    | "nested-scroll";
  /** What is wrong, in the page's terms. */
  detail: string;
  /** The element(s), described. */
  what: string;
  rects: { x: number; y: number; width: number; height: number }[];
};
type Row = Failure & {
  person: string;
  screen: string;
  url: string;
  width: number;
  scheme: string;
  signature: string;
  shot?: string;
};

/**
 * The checks, in the page. Self-contained: it runs in the browser.
 */
function audit(): Failure[] {
  const failures: Failure[] = [];
  const vw = document.documentElement.clientWidth;
  type R = { left: number; top: number; right: number; bottom: number };
  // In page coordinates, at the scroll it was measured at.
  const rect = (r: R) => ({
    x: Math.round(r.left + window.scrollX),
    y: Math.round(r.top + window.scrollY),
    width: Math.round(r.right - r.left),
    height: Math.round(r.bottom - r.top),
  });
  const describe = (node: Element | null): string => {
    if (!node) return "?";
    const part = (element: Element) => {
      let name = element.tagName.toLowerCase();
      const classes = [...element.classList]
        .map((value) => value.replace(/^_?([A-Za-z][\w]*?)_[\w-]+$/, "$1"))
        .slice(0, 2);
      if (classes.length) name += `.${classes.join(".")}`;
      for (const attribute of element.getAttributeNames())
        if (attribute.startsWith("data-") && !attribute.startsWith("data-radix"))
          return `${name}[${attribute}]`;
      return name;
    };
    const parts: string[] = [];
    let at: Element | null = node;
    for (let i = 0; at && i < 3 && at !== document.body; i++) {
      parts.unshift(part(at));
      at = at.parentElement;
    }
    const text = (node.textContent ?? "").trim().replace(/\s+/g, " ");
    return `${parts.join(" > ")}${text ? ` “${text.slice(0, 40)}”` : ""}`;
  };
  const styleOf = (element: Element) => getComputedStyle(element);
  const shown = (element: Element) =>
    element.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
      contentVisibilityAuto: true,
    });
  /** Kept for screen readers only, or clipped away on purpose. */
  const hiddenOnPurpose = (element: Element) => {
    for (let at: Element | null = element; at; at = at.parentElement) {
      const style = styleOf(at);
      if (style.clipPath !== "none" && /inset\(50%/.test(style.clipPath))
        return true;
      if (style.clip && style.clip !== "auto") return true;
      const box = at.getBoundingClientRect();
      if (
        style.position === "absolute" &&
        (box.width <= 1 || box.height <= 1) &&
        style.overflow !== "visible"
      )
        return true;
    }
    return false;
  };
  /** The layer an element paints in: a fixed or sticky box, a dialog, a
   * popover; the page itself otherwise. */
  const layerOf = (element: Element): Element => {
    for (let at: Element | null = element; at; at = at.parentElement) {
      if (
        at.matches(
          "dialog, [role=dialog], [role=alertdialog], [role=tooltip], [role=menu], [role=listbox], [popover], [data-radix-popper-content-wrapper]",
        )
      )
        return at;
      const style = styleOf(at);
      if (style.position === "fixed" || style.position === "sticky") return at;
      // A panel raised over the page on purpose (practice feedback rising
      // over its problem, a browser over the map).
      if (style.position === "absolute" && Number(style.zIndex) >= 1)
        return at;
    }
    return document.documentElement;
  };
  /** The part of a box its clipping ancestors let show; null when none. */
  const clipped = (element: Element, box: R): R | null => {
    let { left, top, right, bottom } = box;
    for (let at = element.parentElement; at; at = at.parentElement) {
      const style = styleOf(at);
      if (style.position === "fixed") break;
      const clipsX = style.overflowX !== "visible";
      const clipsY = style.overflowY !== "visible";
      if (clipsX || clipsY) {
        const outer = at.getBoundingClientRect();
        if (clipsX) {
          left = Math.max(left, outer.left);
          right = Math.min(right, outer.right);
        }
        if (clipsY) {
          top = Math.max(top, outer.top);
          bottom = Math.min(bottom, outer.bottom);
        }
        if (right - left < 1 || bottom - top < 1) return null;
      }
    }
    return { left, top, right, bottom };
  };

  // An open modal sheet: the page under it can't be read or touched, and
  // is checked on its own without the sheet.
  const modals = [
    ...document.querySelectorAll("[aria-modal=true], dialog[open]"),
  ].filter(
    (element) =>
      shown(element) &&
      (element.getAttribute("aria-modal") === "true" ||
        element.matches(":modal")),
  );
  // A sheet that covers the window is modal in effect: nothing under it
  // can be read or touched.
  for (const sheet of document.querySelectorAll("[role=dialog]")) {
    const box = sheet.getBoundingClientRect();
    if (
      shown(sheet) &&
      !modals.includes(sheet) &&
      box.width >= vw * 0.9 &&
      box.height >= window.innerHeight * 0.85
    )
      modals.push(sheet);
  }
  const inScope = (element: Element) =>
    !modals.length ||
    modals.some((modal) => modal.contains(element)) ||
    (layerOf(element) !== document.documentElement &&
      !element.closest("[aria-hidden=true], [inert]"));

  // ---- overflow
  const page = document.scrollingElement!;
  if (page.scrollWidth > vw + 1) {
    const wide = [...document.body.querySelectorAll("*")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.right > vw + 1 && box.width > 0 && shown(element);
      })
      // The outermost ones: their children are wide because they are.
      .filter(
        (element, _, all) =>
          !all.some((other) => other !== element && other.contains(element)),
      )
      .slice(0, 3);
    failures.push({
      kind: "overflow",
      detail: `the page is ${page.scrollWidth}px wide in a ${vw}px window`,
      what: wide.map(describe).join(" | ") || "?",
      rects: wide.map((element) => rect(element.getBoundingClientRect())),
    });
  }

  // ---- the boxes: controls and lines of text
  const CONTROL =
    "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], [role=slider]";
  type Box = {
    element: Element;
    control: boolean;
    box: R;
    layer: Element;
    text?: Text;
  };
  const boxes: Box[] = [];
  const controls = [...document.querySelectorAll(CONTROL)].filter(
    (element) =>
      shown(element) &&
      !hiddenOnPurpose(element) &&
      inScope(element) &&
      !element.closest("[inert], [data-decorative]"),
  );
  for (const element of controls) {
    const visible = clipped(element, element.getBoundingClientRect());
    if (visible)
      boxes.push({ element, control: true, box: visible, layer: layerOf(element) });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || !text.data.trim()) continue;
    if (parent.closest("script, style, noscript, template, title, option"))
      continue;
    if (parent.closest("svg") && !parent.closest("svg text")) continue;
    if (!shown(parent) || hiddenOnPurpose(parent) || !inScope(parent))
      continue;
    if (parent.closest("[inert], [data-decorative]")) continue;
    texts.push(text);
  }
  const range = document.createRange();
  for (const text of texts) {
    range.selectNodeContents(text);
    const parent = text.parentElement!;
    const layer = layerOf(parent);
    for (const line of range.getClientRects()) {
      if (line.width < 1 || line.height < 1) continue;
      const visible = clipped(parent, line);
      if (!visible) continue;
      boxes.push({ element: parent, control: false, box: visible, layer, text });
      // ---- clipped: a line cut by a container that hides overflow
      const cut =
        visible.right < line.right - 2 ||
        visible.left > line.left + 2 ||
        visible.bottom < line.bottom - Math.max(2, line.height * 0.25) ||
        visible.top > line.top + Math.max(2, line.height * 0.25);
      if (cut) {
        // Only a container that hides it, not one that scrolls to it.
        let hides = false;
        for (let at = parent as Element | null; at; at = at.parentElement) {
          const style = styleOf(at);
          if (style.position === "fixed") break;
          if (
            ["hidden", "clip"].includes(style.overflowX) ||
            ["hidden", "clip"].includes(style.overflowY)
          ) {
            const outer = at.getBoundingClientRect();
            if (
              outer.right < line.right - 2 ||
              outer.left > line.left + 2 ||
              outer.bottom < line.bottom - Math.max(2, line.height * 0.25) ||
              outer.top > line.top + Math.max(2, line.height * 0.25)
            ) {
              hides = true;
              break;
            }
          }
          if (["auto", "scroll"].includes(style.overflowX)) break;
        }
        if (hides)
          failures.push({
            kind: "clipped",
            detail: "text is cut by its container",
            what: describe(parent),
            rects: [rect(line)],
          });
      }
    }
  }
  // Ellipses and line clamps: text the reader can't see.
  for (const element of new Set(texts.map((text) => text.parentElement!))) {
    for (let at: Element | null = element; at && at !== document.body; at = at.parentElement) {
      const style = styleOf(at);
      const html = at as HTMLElement;
      if (
        style.textOverflow === "ellipsis" &&
        html.scrollWidth > html.clientWidth + 1
      ) {
        failures.push({
          kind: "clipped",
          detail: "text ends in an ellipsis",
          what: describe(at),
          rects: [rect(at.getBoundingClientRect())],
        });
        break;
      }
      const clamp = style.getPropertyValue("-webkit-line-clamp");
      if (clamp && clamp !== "none" && html.scrollHeight > html.clientHeight + 1) {
        failures.push({
          kind: "clipped",
          detail: `text is clamped to ${clamp} lines`,
          what: describe(at),
          rects: [rect(at.getBoundingClientRect())],
        });
        break;
      }
      if (style.display !== "inline" && style.display !== "contents") break;
    }
  }

  // ---- overlap
  const area = (a: R, b: R) => {
    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return width > 0 && height > 0 ? { width, height } : null;
  };
  /** A control and the text of its own label (a radio over its tile). */
  const labelled = (control: Element, other: Element) =>
    [...((control as HTMLInputElement).labels ?? [])].some((label) =>
      label.contains(other),
    );
  const sorted = [...boxes].sort((a, b) => a.box.top - b.box.top);
  const seen = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (b.box.top >= a.box.bottom) break;
      if (a.layer !== b.layer) continue;
      if (a.element === b.element && (!a.control || !b.control) && a.text === b.text)
        continue;
      if (a.element.contains(b.element) || b.element.contains(a.element)) {
        // Two lines of one text, or text in its own control: not an overlap.
        if (a.control || b.control || a.text === b.text) continue;
      }
      if (
        (a.control && labelled(a.element, b.element)) ||
        (b.control && labelled(b.element, a.element))
      )
        continue;
      const overlap = area(a.box, b.box);
      if (!overlap) continue;
      // A control stretched over its card on purpose (a poster's play
      // cover, a row's link): positioned, and it holds the other whole.
      const covers = (outer: Box, inner: Box) =>
        outer.control &&
        styleOf(outer.element).position === "absolute" &&
        outer.box.left <= inner.box.left + 1 &&
        outer.box.right >= inner.box.right - 1 &&
        outer.box.top <= inner.box.top + 1 &&
        outer.box.bottom >= inner.box.bottom - 1;
      if (covers(a, b) || covers(b, a)) continue;
      const shorter = Math.min(a.box.bottom - a.box.top, b.box.bottom - b.box.top);
      const narrower = Math.min(a.box.right - a.box.left, b.box.right - b.box.left);
      // Glyph boxes of tight lines touch: an overlap is a real share of both.
      if (overlap.height < Math.max(3, shorter * 0.3)) continue;
      if (overlap.width < Math.max(3, Math.min(8, narrower * 0.3))) continue;
      const key = `${describe(a.element)}|${describe(b.element)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({
        kind: "overlap",
        detail: `${a.control ? "a control" : "text"} and ${b.control ? "a control" : "text"} overlap by ${Math.round(overlap.width)}×${Math.round(overlap.height)}px`,
        what: `${describe(a.element)} ⟂ ${describe(b.element)}`,
        rects: [rect(a.box), rect(b.box)],
      });
    }
  }

  // ---- targets
  /** Whether a pointer 21.5 px from the control's centre, each way, still
   * lands on it: its real target, whatever draws it (a drawn-out ::after,
   * a padded wrapper). */
  const reaches = (element: Element) => {
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const on = (px: number, py: number) => {
      const hit = document.elementFromPoint(px, py);
      return !!hit && (hit === element || element.contains(hit));
    };
    const reach = 21.5;
    return (
      on(x - reach, y) && on(x + reach, y) && on(x, y - reach) && on(x, y + reach)
    );
  };
  const scrolled = { x: window.scrollX, y: window.scrollY };
  for (const element of controls) {
    let box = element.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const style = styleOf(element);
    // A link or a term inside a sentence: its line is the target (WCAG
    // 2.5.8). The sentence is the nearest block around it.
    if (style.display === "inline" || style.display === "inline-block") {
      let block = element.parentElement;
      while (block && styleOf(block).display === "inline")
        block = block.parentElement;
      const own = (element.textContent ?? "").trim().length;
      const all = (block?.textContent ?? "").trim().length;
      if (block && all > own + 2) continue;
    }
    const after = getComputedStyle(element, "::after");
    const before = getComputedStyle(element, "::before");
    const drawn = (pseudo: CSSStyleDeclaration) =>
      pseudo.content !== "none" &&
      pseudo.position === "absolute" &&
      pseudo.pointerEvents !== "none";
    // A drawn-out hit area: its size, or the box grown by its insets.
    const size = (pseudo: CSSStyleDeclaration, axis: "x" | "y") => {
      if (!drawn(pseudo)) return 0;
      const own = parseFloat(axis === "x" ? pseudo.width : pseudo.height);
      if (own > 0) return own;
      const [a, b] =
        axis === "x" ? [pseudo.left, pseudo.right] : [pseudo.top, pseudo.bottom];
      return (
        (axis === "x" ? box.width : box.height) -
        (parseFloat(a) || 0) -
        (parseFloat(b) || 0)
      );
    };
    const wide = Math.max(box.width, size(after, "x"), size(before, "x"));
    const tall = Math.max(box.height, size(after, "y"), size(before, "y"));
    // A control held by its label (a designed radio or checkbox): the
    // label is the target.
    const label = (element as HTMLInputElement).labels?.[0];
    const labelBox = label?.getBoundingClientRect();
    const labelOk =
      !!labelBox && labelBox.width >= 43.5 && labelBox.height >= 43.5;
    if ((wide < 43.5 || tall < 43.5) && !labelOk && !reaches(element)) {
      box = element.getBoundingClientRect();
      failures.push({
        kind: "target",
        detail: `${Math.round(wide)}×${Math.round(tall)}px target`,
        what: describe(element),
        rects: [rect(box)],
      });
    }
  }

  window.scrollTo(scrolled.x, scrolled.y);

  // ---- mid-word: only where the styles let a word break
  const WORD = /[^\s\-‐–—/]{2,}/g;
  for (const text of texts) {
    const parent = text.parentElement!;
    const style = styleOf(parent);
    const breaks =
      style.overflowWrap !== "normal" ||
      style.wordBreak === "break-all" ||
      style.wordBreak === "break-word" ||
      style.hyphens === "auto";
    if (!breaks) continue;
    range.selectNodeContents(text);
    const lines = new Set(
      [...range.getClientRects()].map((line) => Math.round(line.top)),
    );
    if (lines.size < 2) continue;
    for (const match of text.data.matchAll(WORD)) {
      range.setStart(text, match.index!);
      range.setEnd(text, match.index! + match[0].length);
      const tops = new Set(
        [...range.getClientRects()]
          .filter((line) => line.width > 0)
          .map((line) => Math.round(line.top / 4)),
      );
      if (tops.size > 1) {
        failures.push({
          kind: "mid-word",
          detail: `“${match[0]}” breaks across lines`,
          what: describe(parent),
          rects: [rect(range.getBoundingClientRect())],
        });
        break;
      }
    }
  }
  // ---- nested-scroll: on a phone or a small tablet, one scroll
  if (vw <= 768) {
    const scrollers = [...document.body.querySelectorAll("*")].filter(
      (element) => {
        if (element.matches("textarea, select")) return false;
        const style = styleOf(element);
        if (!["auto", "scroll", "overlay"].includes(style.overflowY))
          return false;
        const html = element as HTMLElement;
        return (
          html.clientHeight > 0 &&
          html.scrollHeight > html.clientHeight + 1 &&
          shown(element) &&
          inScope(element)
        );
      },
    );
    const allowed = new Set<Element>();
    for (const element of scrollers) {
      // The page's own frame: a scroller the size of the window.
      const box = element.getBoundingClientRect();
      if (box.width >= vw - 1 && box.height >= window.innerHeight * 0.85)
        allowed.add(element);
    }
    // A sheet's one scroll region (a layer's sheet, modal or not).
    const sheets = [
      ...document.querySelectorAll(
        "[role=dialog], [role=alertdialog], dialog[open]",
      ),
    ].filter((element) => shown(element));
    for (const modal of sheets) {
      const inside = scrollers.filter(
        (element) => !allowed.has(element) && modal.contains(element),
      );
      if (inside.length === 1) allowed.add(inside[0]!);
    }
    for (const element of scrollers) {
      if (allowed.has(element)) continue;
      const html = element as HTMLElement;
      failures.push({
        kind: "nested-scroll",
        detail: `scrolls ${html.scrollHeight - html.clientHeight}px inside a ${html.clientHeight}px box`,
        what: describe(element).replace(/ “.*$/, ""),
        rects: [rect(element.getBoundingClientRect())],
      });
    }
  }
  return failures;
}

/** Outlines the failures on the page for a screenshot; returns the top of
 * the first. */
function mark(rects: { x: number; y: number; width: number; height: number }[]) {
  document.querySelector("#__sweep-marks")?.remove();
  const layer = document.createElement("div");
  layer.id = "__sweep-marks";
  layer.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
  for (const box of rects) {
    const outline = document.createElement("div");
    outline.style.cssText = `position:absolute;left:${box.x - 2}px;top:${box.y - 2}px;width:${box.width + 4}px;height:${box.height + 4}px;outline:2px solid #e0007a;background:rgba(224,0,122,.08)`;
    layer.appendChild(outline);
  }
  document.body.appendChild(layer);
  return rects[0]?.y ?? 0;
}
function unmark() {
  document.querySelector("#__sweep-marks")?.remove();
}

const browser = await chromium.launch();
const rows: Row[] = [];
const screensSwept: { person: string; screen: string; url: string }[] = [];
const shotFor = new Map<string, string>();
const checks = new Map<number, number>();
const started = Date.now();

async function contextFor(person: string): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  if (person !== "signed-out") {
    const response = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
      },
    );
    if (!response.ok())
      throw new Error(`${person} sign-in answered ${response.status()}`);
  }
  return context;
}

async function settle(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 6000 })
    .catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          "[aria-busy=true]:not(button):not([data-keep-busy])",
        ),
      undefined,
      { timeout: 6000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

/** Path words whose next part is one of many (a lesson, a skill). */
const COLLECTIONS = new Set(["lessons", "skills", "skill", "profiles", "work"]);
/** A layer over a layer: kept to the top one, over the same page. */
function topLayerOnly(url: URL) {
  const open = url.searchParams.get("open");
  if (!open || !open.includes(",")) return url;
  const next = new URL(url);
  next.searchParams.set("open", open.split(",").at(-1)!);
  return next;
}
/** An address's shape: ids, dates and numbers as placeholders, the layer
 * kinds of `?open=` and the other keys. One screen per shape. */
function shape(url: URL) {
  const path = url.pathname
    .split("/")
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part) ||
      /^[0-9a-f]{16,}$/i.test(part)
        ? ":id"
        : /^\d{4}-\d{2}-\d{2}$/.test(part)
          ? ":date"
          : /^\d+$/.test(part)
            ? ":n"
            : part,
    )
    .map((part, index, parts) =>
      COLLECTIONS.has(parts[index - 1] ?? "") && !part.startsWith(":")
        ? ":slug"
        : part,
    )
    .join("/");
  const keys = [...url.searchParams.keys()]
    .filter((key) => !["from", "returnTo", "back"].includes(key))
    .sort()
    .map((key) =>
      key === "open"
        ? `open=${url.searchParams
            .get("open")!
            .split(",")
            .map((layer) => layer.split(":")[0])
            .join(",")}`
        : key,
    );
  return keys.length ? `${path}?${keys.join("&")}` : path;
}

async function linksOn(page: Page, scope: "nav" | "all") {
  const hrefs = await page.evaluate((scope) => {
    const root =
      scope === "nav"
        ? [
            ...document.querySelectorAll(
              "header a[href], nav a[href], [role=navigation] a[href], [role=tablist] a[href]",
            ),
          ]
        : [...document.querySelectorAll("a[href]")];
    return root
      .filter((a) => !a.hasAttribute("download"))
      .map((a) => (a as HTMLAnchorElement).href);
  }, scope);
  return hrefs
    .map((href) => new URL(href))
    .filter(
      (url) =>
        url.origin === origin &&
        !SKIP.test(url.pathname) &&
        !url.pathname.startsWith("/@"),
    );
}

async function sweepScreen(
  page: Page,
  person: string,
  screen: string,
  url: string,
) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.waitForTimeout(120);
      let found: Failure[];
      try {
        found = await page.evaluate(audit);
      } catch (error) {
        console.error(`audit failed on ${url} at ${width}`, error);
        continue;
      }
      checks.set(width, (checks.get(width) ?? 0) + 1);
      const fresh: Row[] = [];
      for (const failure of found.filter(
        (failure) => !KINDS || KINDS.includes(failure.kind),
      )) {
        // One failure per element and screen, whatever text it holds.
        const signature = `${failure.kind}|${screen}|${failure.what.replace(/ “[^”]*”/g, "")}`;
        const row: Row = {
          ...failure,
          person,
          screen,
          url,
          width,
          scheme,
          signature,
        };
        rows.push(row);
        if (!shotFor.has(signature)) fresh.push(row);
      }
      if (fresh.length) {
        const name = `${person}__${screen.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}__${width}-${scheme}.png`;
        const path = join(SHOTS, name);
        const top = await page.evaluate(
          mark,
          fresh.flatMap((row) => row.rects),
        );
        await page.evaluate(
          (y) => window.scrollTo(0, Math.max(0, y - 200)),
          top,
        );
        await page.screenshot({ path }).catch(() => undefined);
        await page.evaluate(unmark);
        await page.evaluate(() => window.scrollTo(0, 0));
        for (const row of fresh) shotFor.set(row.signature, path);
      }
    }
  }
}

for (const person of PEOPLE) {
  const context = await contextFor(person);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.error(`[${person}] page error: ${error.message}`),
  );
  // Discovery at 1280, light: the home, the nav, one of each linked shape.
  const queue: URL[] = [];
  const shapes = new Set<string>();
  const add = (raw: URL) => {
    const url = topLayerOnly(raw);
    const key = shape(url);
    if (shapes.has(key)) return;
    shapes.add(key);
    queue.push(url);
  };
  add(new URL("/", origin));
  for (const path of EXTRA[person] ?? []) add(new URL(path, origin));
  let swept = 0;
  const done = new Set<string>();
  while (queue.length && swept < MAX_SCREENS) {
    const target = queue.shift()!;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    try {
      await page.goto(target.href, { waitUntil: "domcontentloaded" });
    } catch (error) {
      console.error(`[${person}] ${target.href} did not open`, error);
      continue;
    }
    await settle(page);
    const landed = new URL(page.url());
    const screen = shape(landed);
    // Every shape it opens or redirects to is noted, so it isn't queued again.
    shapes.add(screen);
    if (done.has(screen)) continue;
    done.add(screen);
    for (const sheet of SHEETS)
      if (sheet.page.test(screen)) {
        const url = new URL(landed);
        url.search = sheet.search;
        add(url);
      }
    for (const url of await linksOn(page, "nav")) add(url);
    for (const url of await linksOn(page, "all")) add(url);
    if (ONLY && !landed.href.includes(ONLY)) continue;
    swept++;
    const label = `${landed.pathname}${landed.search}`;
    console.log(`[${person}] ${screen}  (${label})`);
    screensSwept.push({ person, screen, url: label });
    await sweepScreen(page, person, screen, label);
  }
  await context.close();
}
await browser.close();

// ---- the report
const byWidth: Record<number, number> = {};
const signaturesByWidth: Record<number, Set<string>> = {};
for (const row of rows) {
  byWidth[row.width] = (byWidth[row.width] ?? 0) + 1;
  (signaturesByWidth[row.width] ??= new Set()).add(row.signature);
}
const byKind: Record<string, number> = {};
const unique = new Map<string, Row & { widths: number[]; schemes: string[] }>();
for (const row of rows) {
  const entry = unique.get(row.signature);
  if (entry) {
    if (!entry.widths.includes(row.width)) entry.widths.push(row.width);
    if (!entry.schemes.includes(row.scheme)) entry.schemes.push(row.scheme);
  } else {
    unique.set(row.signature, {
      ...row,
      shot: shotFor.get(row.signature),
      widths: [row.width],
      schemes: [row.scheme],
    });
    byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
  }
}
const report = {
  label: LABEL,
  origin,
  finished: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  people: PEOPLE,
  widths: WIDTHS,
  schemes: SCHEMES,
  screens: screensSwept,
  checksByWidth: Object.fromEntries(checks),
  failuresByWidth: byWidth,
  distinctFailuresByWidth: Object.fromEntries(
    Object.entries(signaturesByWidth).map(([width, set]) => [width, set.size]),
  ),
  distinctByKind: byKind,
  distinct: [...unique.values()].map(
    ({ rects: _rects, width: _width, scheme: _scheme, ...rest }) => rest,
  ),
};
writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(report, null, 2));
console.log(
  `\n${screensSwept.length} screens, ${[...checks.values()].reduce((a, b) => a + b, 0)} checks in ${report.seconds}s`,
);
console.log(`failures by width (all / distinct):`);
for (const width of WIDTHS)
  console.log(
    `  ${String(width).padStart(4)}  ${byWidth[width] ?? 0} / ${signaturesByWidth[width]?.size ?? 0}`,
  );
console.log(`distinct by kind: ${JSON.stringify(byKind)}`);
console.log(`report: ${join(OUT, `${LABEL}.json`)}`);
process.exit(unique.size ? 1 : 0);

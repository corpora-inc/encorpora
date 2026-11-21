/**
 * The comparison pages in a real browser, from the production build as the
 * server serves it (docker/nginx.conf): `/versus` and one comparison at 390,
 * 768 and 1280, light and dark.
 *
 * - Each address is its own document: title, description, canonical, the
 *   page's words (hidden until there is no JavaScript) and structured data.
 *   A slug with no comparison is a 404.
 * - The app takes the document's place with nothing moving: one heading
 *   ever shows, no control shifts, no layout shift is recorded.
 * - No horizontal overflow. The table reads at each width: three columns
 *   with AMP first where there is room, and each row stacked (its name, AMP,
 *   the other program) where there is not.
 * - Every citation is a link to its own source in the page's list, and
 *   following one lands on it.
 * - Try it free is on the first screen and goes where the homepage's goes.
 * - A reason's research link lands on that part of `/research`, in view.
 * - Moving between comparisons inside the app rewrites the head.
 * - No accessibility violations (WCAG 2.1 AA).
 *
 * Screenshots land in docs/reviews/versus/ as WebP for a person to look at.
 * The API is synthetic; nothing leaves the machine.
 *
 *     npm run build && npx tsx scripts/verify-versus-ui.ts
 *       [--slug i-ready] [--widths 390,768,1280] [--port 4612] [--dist dist]
 *       [--shots docs/reviews/versus]
 */
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { versusRows, type VersusRow } from "../src/versus/amp";
import { relatedComparisons, versusGroups } from "../src/versus/catalog";
import { readVersus } from "../src/versus/files";
import { versusHubHead, versusPageHead } from "../src/versus/head";
import type { VersusPage } from "../src/versus/types";
import { knownDocumentPath } from "../src/web/app/document-routes";
import { settle, shellRecord, shiftRecorder } from "./app-shell-probe";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const port = Number(argument("port") ?? 4612);
const origin = `http://127.0.0.1:${port}`;
const widths = (argument("widths") ?? "390,768,1280").split(",").map(Number);
const themes = ["light", "dark"] as const;
const dist = resolve(argument("dist") ?? "dist");
const REVIEW = argument("shots") ?? "docs/reviews/versus";
const ARTIFACTS = "artifacts/versus";

const { catalog, pages } = readVersus();
const found = pages.find(
  (page) => page.slug === (argument("slug") ?? "i-ready"),
);
if (!found) throw new Error("The comparison to check does not exist");
const subject: VersusPage = found;
const subjectPath = `/versus/${subject.slug}`;
const subjectHead = versusPageHead(subject);
assert.ok(
  existsSync(join(dist, "versus", subject.slug, "index.html")),
  `${dist} has no comparison documents: run \`npm run build\` first`,
);

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

// dist/ as docker/nginx.conf serves it.
const types: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const isFile = (path: string) => {
  const full = join(dist, normalize(path));
  return full.startsWith(dist) && existsSync(full) && statSync(full).isFile()
    ? full
    : null;
};
/** The file nginx answers an address with, or null for its 404 page. */
function served(path: string): string | null {
  if (path === "/") return isFile("/home.html");
  if (path === "/versus" || path === "/versus/")
    return isFile("/versus/index.html");
  // `location ^~ /versus/`: the file, its index, or 404. Never the app.
  if (path.startsWith("/versus/"))
    return isFile(path) ?? isFile(`${path}/index.html`);
  if (path === "/research" || path === "/research/")
    return isFile("/research/index.html");
  if (extname(path)) return isFile(path);
  return (
    isFile(path) ??
    isFile(`${path}/index.html`) ??
    (knownDocumentPath(path) ? isFile("/index.html") : null)
  );
}
const server = http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", origin).pathname);
  const file = served(path);
  if (!file) {
    response.writeHead(404, {
      "Content-Type": types[".html"],
      "Cache-Control": "no-store",
    });
    createReadStream(join(dist, "404.html")).pipe(response);
    return;
  }
  response.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(file).pipe(response);
});
await new Promise<void>((done) =>
  server.listen(port, "127.0.0.1", () => done()),
);

/** A signed-out visitor: the API answers as it does for one. */
async function synthetic(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/v1/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: ["google"] },
      });
    if (path === "/api/auth/get-session") return route.fulfill({ json: null });
    if (path === "/api/v1/billing/prices")
      return route.fulfill({
        json: { available: true, offers: [], extraOffers: [] },
      });
    if (path === "/api/v1/funding/invoice-offers")
      return route.fulfill({ json: { offers: [] } });
    return route.fulfill({ status: 204 });
  });
}

const head = (page: Page) =>
  page.evaluate(() => ({
    title: document.title,
    description: document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )?.content,
    canonical: [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
    ].map((link) => link.href),
    robots:
      document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ??
      null,
    ogTitle: document.querySelector<HTMLMetaElement>(
      'meta[property="og:title"]',
    )?.content,
    ogUrl: document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.content,
    twitterTitle: document.querySelector<HTMLMetaElement>(
      'meta[name="twitter:title"]',
    )?.content,
    data: [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].flatMap((script) => {
      const parsed = JSON.parse(script.textContent ?? "null");
      return (Array.isArray(parsed) ? parsed : [parsed]).map(
        (entry) => entry["@type"] as string,
      );
    }),
  }));

/** The settled page: what moved while the app took the document's place. */
async function arrived(page: Page, tag: string, heading: string) {
  await page
    .getByRole("heading", { level: 1, name: heading, exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const record = await shellRecord(page);
  check(
    `${tag} nothing moves as the app takes over`,
    record.shifts.length === 0,
    record.shifts,
  );
  check(`${tag} no layout shift`, record.cls <= 0.01, record.cls);
  check(
    `${tag} one heading ever shows`,
    record.headings.length === 1 && record.headings[0] === heading,
    record.headings,
  );
  check(`${tag} never blank after content`, record.blank === 0, record.blank);
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - innerWidth,
    wide: [
      ...document.querySelectorAll(
        "#root main *, #root footer *, #root header *",
      ),
    ]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1);
      })
      .slice(0, 5)
      .map(
        (element) =>
          `${element.tagName}.${String(element.className).slice(0, 40)}`,
      ),
  }));
  check(
    `${tag} no horizontal overflow`,
    overflow.page <= 0 && overflow.wide.length === 0,
    overflow,
  );
  // The static words stay out of the way once the app has the page.
  check(
    `${tag} the static words are hidden`,
    await page.evaluate(() => {
      const words = document.querySelector(".versus-static");
      return !!words && getComputedStyle(words).display === "none";
    }),
  );
}

async function accessible(page: Page, tag: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  check(
    `${tag} accessible`,
    violations.length === 0,
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .map((node) => node.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    ),
  );
}

async function shot(page: Page, name: string) {
  const png = join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: png, fullPage: true, animations: "disabled" });
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "80",
    png,
    "-o",
    join(REVIEW, `${name}.webp`),
  ]);
}

const browser = await chromium.launch();
try {
  await mkdir(REVIEW, { recursive: true });
  await mkdir(ARTIFACTS, { recursive: true });

  // 1. The documents themselves, as a crawler reads them.
  {
    const document = async (path: string) => {
      const response = await fetch(`${origin}${path}`);
      return { status: response.status, html: await response.text() };
    };
    for (const path of [subjectPath, `${subjectPath}/`]) {
      const { status, html } = await document(path);
      check(`${path} is a document`, status === 200, status);
      check(
        `${path} title`,
        html.includes(
          `<title>${subjectHead.title.replace(/&/g, "&amp;")}</title>`,
        ),
        html.match(/<title>[^<]*<\/title>/)?.[0],
      );
      check(
        `${path} canonical`,
        html.includes(`<link rel="canonical" href="${subjectHead.canonical}">`),
      );
      check(
        `${path} words`,
        new RegExp(
          `<main class="versus-static" hidden="">\\s*<h1>AMP vs ${subject.name}</h1>`,
        ).test(html),
      );
      check(
        `${path} noscript shows the words`,
        html.includes(
          "<noscript><style>.versus-static[hidden]{display:block}</style></noscript>",
        ),
      );
      check(
        `${path} #root holds only the loading frame`,
        !/<div id="root">[\s\S]*versus-static[\s\S]*<\/div>\s*<main class="versus-static"/.test(
          html,
        ),
      );
    }
    const hub = await document("/versus");
    check("/versus is a document", hub.status === 200, hub.status);
    check(
      "/versus title",
      hub.html.includes(`<title>${versusHubHead.title}</title>`),
    );
    check(
      "/versus canonical",
      hub.html.includes(
        '<link rel="canonical" href="https://amp.corpora.inc/versus">',
      ),
    );
    for (const entry of catalog)
      check(
        `/versus lists ${entry.slug}`,
        hub.html.includes(`<a href="/versus/${entry.slug}">AMP vs `),
      );
    const missing = await document("/versus/no-such-program");
    check(
      "a slug with no comparison is a 404",
      missing.status === 404,
      missing.status,
    );
    check(
      "the 404 is the missing page, not the app",
      missing.html.includes("Page not found") &&
        !missing.html.includes('type="module"'),
    );
    const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
    for (const path of [
      "/versus",
      ...catalog.map((entry) => `/versus/${entry.slug}`),
    ])
      check(
        `the sitemap lists ${path}`,
        sitemap.includes(`<loc>https://amp.corpora.inc${path}</loc>`),
      );
  }

  // 2. Without JavaScript: the words show, and a citation reaches its source.
  {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    await synthetic(context);
    const page = await context.newPage();
    await page.goto(`${origin}${subjectPath}`);
    await page
      .getByRole("heading", {
        level: 1,
        name: `AMP vs ${subject.name}`,
        exact: true,
      })
      .waitFor();
    const cite = page.locator('.versus-static sup a[href^="#source-"]').first();
    const target = (await cite.getAttribute("href"))!;
    await cite.click();
    check(
      "no JavaScript: a citation lands on its source",
      (await page.locator(`.versus-static ${target}`).isVisible()) &&
        new URL(page.url()).hash === target,
      page.url(),
    );
    await context.close();
  }

  // 3. The pages at each width and theme.
  for (const theme of themes)
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 900 },
        colorScheme: theme,
      });
      await synthetic(context);
      await context.addInitScript(shiftRecorder);
      const tag = `${theme} ${width}`;

      // The hub.
      const hub = await context.newPage();
      await hub.goto(`${origin}/versus`);
      await arrived(hub, `${tag} /versus`, "AMP vs other math programs");
      const listed = await hub.evaluate(() =>
        [...document.querySelectorAll("[data-versus-category]")].map(
          (list) => ({
            category: list.getAttribute("data-versus-category"),
            entries: [...list.querySelectorAll("li")].map((item) => ({
              href: item.querySelector("a")?.getAttribute("href"),
              name: item.querySelector("a")?.textContent,
              line: item.querySelector("span")?.textContent,
            })),
          }),
        ),
      );
      assert.deepEqual(
        listed,
        versusGroups(catalog).map(({ category, entries }) => ({
          category: category.id,
          entries: entries.map((entry) => ({
            href: `/versus/${entry.slug}`,
            name: `AMP vs ${entry.name}`,
            line: entry.line,
          })),
        })),
        `${tag}: the hub lists the catalog by category`,
      );
      check(
        `${tag} /versus links to the research`,
        (await hub.locator('#root main a[href="/research"]').count()) >= 1,
      );
      check(
        `${tag} /versus has no search box or filter`,
        (await hub
          .locator(
            "#root main input, #root main select, #root main [role=search]",
          )
          .count()) === 0,
      );
      const hubHead = await head(hub);
      check(
        `${tag} /versus head`,
        hubHead.title === versusHubHead.title &&
          hubHead.canonical.join() === "https://amp.corpora.inc/versus" &&
          hubHead.robots === null &&
          hubHead.data.join() === "BreadcrumbList",
        hubHead,
      );
      await accessible(hub, `${tag} /versus`);
      await shot(hub, `hub-${width}-${theme}`);
      await hub.close();

      // One comparison.
      const page = await context.newPage();
      await page.goto(`${origin}${subjectPath}`);
      await arrived(page, `${tag} ${subjectPath}`, `AMP vs ${subject.name}`);
      const pageHead = await head(page);
      check(
        `${tag} head`,
        pageHead.title === subjectHead.title &&
          pageHead.description === subject.description &&
          pageHead.canonical.join() === subjectHead.canonical &&
          pageHead.robots === null &&
          pageHead.ogTitle === subjectHead.title &&
          pageHead.ogUrl === subjectHead.canonical &&
          pageHead.twitterTitle === subjectHead.title &&
          pageHead.data.join() === "FAQPage,BreadcrumbList",
        pageHead,
      );

      // Try it free, on the first screen.
      const action = page
        .locator("[data-versus-action]")
        .getByRole("button", { name: "Try it free", exact: true });
      const actionBox = (await action.boundingBox())!;
      check(
        `${tag} Try it free is on the first screen`,
        !!actionBox &&
          actionBox.y + actionBox.height <= page.viewportSize()!.height,
        actionBox,
      );
      check(
        `${tag} Try it free is a full target`,
        actionBox.height >= 44,
        actionBox.height,
      );

      // The sections, in order.
      const sections = await page.evaluate(() =>
        [...document.querySelectorAll("#root main h1, #root main h2")].map(
          (heading) => heading.textContent?.trim(),
        ),
      );
      assert.deepEqual(
        sections,
        [
          `AMP vs ${subject.name}`,
          "Why AMP",
          "Side by side",
          `What ${subject.name} is`,
          `What ${subject.name} does well`,
          "The evidence",
          `Choose ${subject.name} if`,
          "Choose AMP if",
          "Questions",
          "Sources",
          "More comparisons",
        ],
        `${tag}: the page's sections`,
      );

      // The table.
      const table = await page.evaluate(() => {
        const box = (element: Element | null | undefined) => {
          const rect = element!.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            bottom: rect.bottom,
          };
        };
        const root = document.querySelector("[data-versus-table]")!;
        return {
          width: box(root).width,
          head: [...root.querySelectorAll("thead th")].map((cell) =>
            cell.textContent?.trim(),
          ),
          headShown: [...root.querySelectorAll("thead th")].map(
            (cell) => cell.getBoundingClientRect().width > 2,
          ),
          rows: [...root.querySelectorAll("tbody tr")].map((row) => {
            const [label, ours, theirs] = [...row.children];
            const who = (cell: Element) => {
              const mark = cell.querySelector("span");
              return mark && getComputedStyle(mark).display !== "none"
                ? mark.textContent
                : null;
            };
            return {
              id: row.getAttribute("data-versus-row"),
              label: { text: label!.textContent?.trim(), ...box(label) },
              ours: {
                ...box(ours),
                who: who(ours!),
                clipped: ours!.scrollWidth > ours!.clientWidth + 1,
                size: parseFloat(getComputedStyle(ours!).fontSize),
              },
              theirs: {
                ...box(theirs),
                who: who(theirs!),
                clipped: theirs!.scrollWidth > theirs!.clientWidth + 1,
                size: parseFloat(getComputedStyle(theirs!).fontSize),
              },
            };
          }),
        };
      });
      const expectedRows: VersusRow[] = versusRows.filter(
        (row) => subject.rows[row.id] !== undefined,
      );
      assert.deepEqual(
        table.rows.map((row) => [row.id, row.label.text]),
        expectedRows.map((row) => [row.id, row.label]),
        `${tag}: only the page's rows, in order`,
      );
      assert.deepEqual(
        table.head,
        ["AMP", subject.name],
        `${tag}: AMP's column first`,
      );
      for (const row of table.rows) {
        const at = `${tag} row ${row.id}`;
        check(
          `${at} reads at a text size`,
          row.ours.size >= 16 && row.theirs.size >= 16,
          [row.ours.size, row.theirs.size],
        );
        check(
          `${at} no cell is clipped`,
          !row.ours.clipped && !row.theirs.clipped,
        );
        if (width < 700) {
          // Stacked: the row's name, then AMP, then the other program.
          check(
            `${at} stacks label, AMP, them`,
            row.label.bottom <= row.ours.top + 1 &&
              row.ours.bottom <= row.theirs.top + 1,
            row,
          );
          check(
            `${at} each cell has the row's width`,
            row.ours.width >= table.width * 0.9 &&
              row.theirs.width >= table.width * 0.9,
            [row.ours.width, table.width],
          );
          check(
            `${at} each cell says whose it is`,
            row.ours.who === "AMP" && row.theirs.who === subject.name,
            [row.ours.who, row.theirs.who],
          );
        } else {
          check(
            `${at} sits on one line: label, AMP, them`,
            Math.abs(row.label.top - row.ours.top) <= 2 &&
              Math.abs(row.ours.top - row.theirs.top) <= 2 &&
              row.label.left < row.ours.left &&
              row.ours.left < row.theirs.left,
            row,
          );
          check(
            `${at} columns are equal and wide enough to read`,
            Math.abs(row.ours.width - row.theirs.width) <= 2 &&
              row.ours.width >= 220,
            [row.ours.width, row.theirs.width],
          );
          check(
            `${at} the column names say whose it is`,
            row.ours.who === null &&
              row.theirs.who === null &&
              table.headShown.every(Boolean),
            table.headShown,
          );
        }
      }

      // Citations: each a link to its own source.
      const cites = await page.evaluate(() => {
        const sources = [
          ...document.querySelectorAll("#root main ol > li[id^=source-]"),
        ];
        return {
          sources: sources.map((item) => ({
            id: item.id,
            href: item.querySelector("a")?.getAttribute("href"),
          })),
          links: [...document.querySelectorAll("#root main a[data-cite]")].map(
            (link) => {
              const target = document.getElementById(
                link.getAttribute("href")!.slice(1),
              );
              return {
                number: Number(link.getAttribute("data-cite")),
                text: link.textContent,
                href: link.getAttribute("href"),
                place: target ? sources.indexOf(target) + 1 : 0,
                raised: link.closest("sup") !== null,
              };
            },
          ),
          raw: /\[\d+\]/.test(
            document.querySelector("#root main")!.textContent ?? "",
          ),
        };
      });
      assert.deepEqual(
        cites.sources,
        subject.sources.map((source, index) => ({
          id: `source-${index + 1}`,
          href: source.url,
        })),
        `${tag}: the sources, numbered`,
      );
      check(`${tag} the page cites its sources`, cites.links.length > 0);
      check(
        `${tag} every citation resolves to its own source`,
        cites.links.every(
          (link) =>
            link.place === link.number &&
            link.href === `#source-${link.number}` &&
            link.text === String(link.number) &&
            link.raised,
        ),
        cites.links.filter((link) => link.place !== link.number),
      );
      check(`${tag} no raw citation marker shows`, !cites.raw);
      check(
        `${tag} the checked date and the correction line`,
        (await page
          .locator("#root")
          .getByText("Checked November 2026.", { exact: true })
          .count()) === 1 &&
          (await page
            .locator('#root main a[href="mailto:skylar@corpora.inc"]')
            .textContent()) === "skylar@corpora.inc",
      );
      const others = await page
        .locator('#root main section[aria-labelledby="versus-more"] a')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      assert.deepEqual(
        others,
        [
          ...relatedComparisons(subject.slug, catalog).map(
            (entry) => `/versus/${entry.slug}`,
          ),
          "/versus",
        ],
        `${tag}: other comparisons, then the hub`,
      );

      await accessible(page, `${tag} ${subjectPath}`);
      await shot(page, `${subject.slug}-${width}-${theme}`);

      // Following a citation lands on its source, on the same page.
      const first = page.locator("#root main a[data-cite]").first();
      const number = await first.getAttribute("data-cite");
      await first.click();
      await settle(page, 300);
      check(
        `${tag} a citation's address`,
        new URL(page.url()).hash === `#source-${number}` &&
          new URL(page.url()).pathname === subjectPath,
        page.url(),
      );
      check(
        `${tag} a citation lands on its source`,
        await page.evaluate((id) => {
          const rect = document.getElementById(id)!.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight;
        }, `source-${number}`),
      );
      check(
        `${tag} the page is still the comparison`,
        (await page.getByRole("heading", { level: 1 }).textContent()) ===
          `AMP vs ${subject.name}`,
      );

      // A reason's research link lands on that part of /research, in view.
      const research = page.locator('#root main a[href^="/research#"]').first();
      const component = (await research.getAttribute("href"))!.split("#")[1]!;
      check(
        `${tag} the research link says what it opens`,
        /^The research: /.test((await research.textContent()) ?? ""),
      );
      await research.click();
      await page
        .getByRole("heading", {
          level: 1,
          name: "The research behind AMP",
          exact: true,
        })
        .waitFor();
      await settle(page, 500);
      const landed = await page.evaluate((id) => {
        const target = document.querySelector(`#root main #${id}`);
        if (!target) return { found: false };
        const rect = target.getBoundingClientRect();
        // What paints over the target's first line, if anything does.
        const top = document.elementFromPoint(rect.left + 24, rect.top + 20);
        return {
          found: true,
          top: rect.top,
          inView: rect.top >= 0 && rect.top < innerHeight * 0.6,
          uncovered: !!top && target.contains(top),
          hash: location.hash,
        };
      }, component);
      check(
        `${tag} /research#${component} lands on its part, in view and uncovered`,
        landed.found === true &&
          landed.inView === true &&
          landed.uncovered === true &&
          landed.hash === `#${component}`,
        landed,
      );
      // And the research page's own way to the comparisons is the hub.
      check(
        `${tag} /research links to the hub`,
        (await page
          .locator("#root footer")
          .getByRole("link", { name: "Compare", exact: true })
          .getAttribute("href")) === "/versus",
      );
      await page.close();
      await context.close();
    }

  // 4. Inside the app: the action's destination, and the head between pages.
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await synthetic(context);
    const page = await context.newPage();
    await page.goto(`${origin}${subjectPath}`);
    await page
      .getByRole("heading", {
        level: 1,
        name: `AMP vs ${subject.name}`,
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("link", { name: "All comparisons", exact: true })
      .click();
    await page
      .getByRole("heading", {
        level: 1,
        name: "AMP vs other math programs",
        exact: true,
      })
      .waitFor();
    await page.waitForFunction(
      (title) => document.title === title,
      versusHubHead.title,
    );
    let now = await head(page);
    check(
      "in the app: the hub's head",
      now.canonical.join() === "https://amp.corpora.inc/versus" &&
        now.robots === null &&
        now.data.join() === "BreadcrumbList" &&
        now.ogUrl === "https://amp.corpora.inc/versus",
      now,
    );
    const other = pages.find((entry) => entry.slug !== subject.slug);
    if (other) {
      const otherHead = versusPageHead(other);
      await page
        .getByRole("link", { name: `AMP vs ${other.name}`, exact: true })
        .click();
      await page
        .getByRole("heading", {
          level: 1,
          name: `AMP vs ${other.name}`,
          exact: true,
        })
        .waitFor();
      await page.waitForFunction(
        (title) => document.title === title,
        otherHead.title,
      );
      now = await head(page);
      check(
        "in the app: the next comparison's head",
        now.description === other.description &&
          now.canonical.join() === otherHead.canonical &&
          now.ogTitle === otherHead.title &&
          now.data.join() === "FAQPage,BreadcrumbList",
        now,
      );
      check(
        "in the app: the structured data is the page's own",
        await page.evaluate(
          (question) =>
            document
              .querySelector('script[type="application/ld+json"]')!
              .textContent!.includes(JSON.stringify(question).slice(1, -1)),
          other.questions[0]!.question,
        ),
      );
      await page.goBack();
      await page.waitForFunction(
        (title) => document.title === title,
        versusHubHead.title,
      );
      await page.goBack();
      await page.waitForFunction(
        (title) => document.title === title,
        subjectHead.title,
      );
    }
    // A slug with no comparison, reached inside the app: the not-found screen.
    await page.evaluate(() => {
      history.pushState({}, "", "/versus/no-such-program");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await page
      .getByRole("heading", { level: 1, name: "Page not found", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content") === "noindex, follow",
    );
    check(
      "in the app: a missing comparison has no canonical",
      (await page.locator('link[rel="canonical"]').count()) === 0,
    );
    await page.goBack();
    await page
      .getByRole("heading", {
        level: 1,
        name: `AMP vs ${subject.name}`,
        exact: true,
      })
      .waitFor();
    // Try it free goes where the homepage's goes.
    await page
      .locator("[data-versus-action]")
      .getByRole("button", { name: "Try it free", exact: true })
      .click();
    await page.waitForURL(`${origin}/sign-up`);
    await page.waitForFunction(
      () =>
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content") === "noindex, follow",
    );
    now = await head(page);
    check(
      "leaving the comparisons: sign-up's head, and no comparison data",
      !now.title.startsWith("AMP vs") &&
        now.title.endsWith("| AMP") &&
        now.canonical.length === 0 &&
        !now.data.includes("FAQPage"),
      now,
    );
    // Sign-up knows why, as it does from the homepage's button (lib/program-choice.ts).
    const intent = await page.evaluate(() =>
      sessionStorage.getItem("amp.sign-up-entry"),
    );
    check(
      "Try it free tells sign-up why, as the homepage's does",
      JSON.parse(intent ?? "{}").entry === "pitch-try",
      intent,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}

if (failures.length) {
  console.error(
    `Comparison pages: ${failures.length} failure(s)\n` +
      failures.map((line) => `  ${line}`).join("\n"),
  );
  process.exit(1);
}
console.log(
  `Comparison pages: /versus and ${subjectPath} pass at ${widths.join(", ")} px, light and dark: documents, no movement, the table, citations, Try it free, research links and the head. Screenshots in ${REVIEW}/.`,
);

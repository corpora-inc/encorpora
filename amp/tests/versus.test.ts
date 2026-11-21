/**
 * The comparison pages' content and what is built from it (src/versus):
 * every file on disk passes the validator, the validator catches each kind
 * of mistake, AMP's side matches the code it describes, and the static
 * documents carry what a crawler needs. `npm run versus:check` runs the same
 * validator for a writer.
 */
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { stripeCatalog } from "../infra/stripe";
import { researchComponentIds, researchPage } from "../src/research/report";
import { researchStaticHtml } from "../src/research/static-document";
import { versusCategories, versusHub, versusRows } from "../src/versus/amp";
import {
  relatedComparisons,
  versusGroups,
  versusPath,
} from "../src/versus/catalog";
import {
  citations,
  citedParts,
  withoutCitations,
} from "../src/versus/citations";
import {
  checkVersusFiles,
  checkVersusPage,
  readVersus,
  writeVersusCatalog,
} from "../src/versus/files";
import {
  checkedLabel,
  researchLink,
  versusHubHead,
  versusHubJsonLd,
  versusPageHead,
  versusPageJsonLd,
  versusPageTitle,
} from "../src/versus/head";
import {
  versusHubStaticHtml,
  versusPageStaticHtml,
} from "../src/versus/static-document";
import {
  versusCategoryIds,
  versusRowIds,
  type VersusPage,
} from "../src/versus/types";
import {
  validateVersus,
  validateVersusPage,
  versusCatalogFrom,
  versusLimits,
  versusProblemLine,
} from "../src/versus/validate";
import {
  publicAppPageTitle,
  publicAppPageTitles,
} from "../src/analytics/page-titles";
import {
  indexableDocumentPath,
  knownDocumentPath,
} from "../src/web/app/document-routes";
import { routeHead } from "../src/web/app/route-head";
import { googlePageTitle } from "../src/analytics/google-analytics";

test("every comparison file on disk is valid", () => {
  assert.deepEqual(checkVersusFiles().map(versusProblemLine), []);
  const { catalog, pages } = readVersus();
  assert.ok(pages.length >= 1, "there is at least one comparison");
  assert.deepEqual(
    catalog,
    versusCatalogFrom(pages),
    "catalog.json is what the pages give: npm run versus:catalog",
  );
});

/** A valid page, to break one way at a time. */
const sample = (): VersusPage => ({
  slug: "sample",
  name: "Sample",
  category: "adaptive",
  checked: "2026-11-21",
  line: "Sample assigns lessons. AMP chooses each next problem.",
  description:
    "Sample is a program used in this test. AMP is a complete math curriculum, and this description is long enough to pass.",
  verdict: "Sample does one thing [1]. AMP does another.",
  theirs: ["Sample is a program [1][2]."],
  credit: ["It is clear [1].", "It is short."],
  reasons: [
    { title: "One", body: "First [2].", research: ["review"] },
    { title: "Two", body: "Second." },
    { title: "Three", body: "Third.", research: ["level", "mastery"] },
  ],
  evidence: { theirs: ["Theirs [1]."], ours: ["Ours."] },
  rows: { price: "$10 a month [2].", range: "K–8." },
  fit: { them: ["You want Sample."], amp: ["You want AMP."] },
  questions: [
    { question: "First?", answer: "Yes [1]." },
    { question: "Second?", answer: "No." },
  ],
  sources: [
    { title: "Sample: home", url: "https://example.com/" },
    { title: "Sample: pricing", url: "https://example.com/pricing" },
  ],
});

/** One page's problems after one change to the valid sample, as lines. The
 * page is checked alone: no catalog, no other page. */
function broken(change: (page: VersusPage) => void, file = "sample.json") {
  const page = sample();
  change(page);
  return validateVersusPage(file, page).map(versusProblemLine);
}
type Loose = Record<string, any>;
const words = (count: number) =>
  Array.from({ length: count }, (_, index) => `w${index}`).join(" ");
const many = (count: number) =>
  Array.from({ length: count }, (_, index) => `Paragraph ${index}.`);

test("the sample the validator's tests break is itself valid", () => {
  assert.deepEqual(
    broken(() => {}),
    [],
  );
});

test("the validator names each kind of mistake, with its file and place", () => {
  const cases: [string, Parameters<typeof broken>[0], RegExp][] = [
    [
      "a missing field",
      (page) => delete (page as Loose).verdict,
      /^pages\/sample\.json: verdict: must be a string/,
    ],
    [
      "an unknown field",
      (page) => ((page as Loose).summary = "x"),
      /^pages\/sample\.json: summary: is not a page field/,
    ],
    [
      "a wrong type",
      (page) => ((page as Loose).theirs = "one paragraph"),
      /^pages\/sample\.json: theirs: must be a list/,
    ],
    [
      "a slug that is not the file's name",
      (page) => (page.slug = "other"),
      /^pages\/sample\.json: slug: "other" must match the file's name, "sample"/,
    ],
    [
      "an unknown category",
      (page) => ((page as Loose).category = "apps"),
      /^pages\/sample\.json: category: unknown category "apps"/,
    ],
    [
      "no hub line",
      (page) => delete (page as Loose).line,
      /^pages\/sample\.json: line: must be a string with words in it/,
    ],
    [
      "a hub line that is too long",
      (page) => (page.line = "x".repeat(121)),
      /^pages\/sample\.json: line: is 121 characters; at most 120/,
    ],
    [
      "a hub line with a citation",
      (page) => (page.line = "Sample assigns lessons [1]."),
      /^pages\/sample\.json: line: must not carry a citation marker/,
    ],
    [
      "an unknown table row",
      (page) => ((page.rows as Loose).cost = "$10"),
      /^pages\/sample\.json: rows\.cost: unknown row id/,
    ],
    [
      "a table cell that is too long",
      (page) => (page.rows.range = `${words(31)} [1].`),
      /^pages\/sample\.json: rows\.range: is 31 words; at most 30/,
    ],
    [
      "an unknown research id",
      (page) => ((page.reasons[0] as Loose).research = ["spacing"]),
      /^pages\/sample\.json: reasons\[0\]\.research\[0\]: unknown research id "spacing"/,
    ],
    [
      "a citation with no source",
      (page) => (page.reasons[1]!.body = "Second [3]."),
      /^pages\/sample\.json: reasons\[1\]\.body: cites \[3\], and the page has 2 sources/,
    ],
    [
      "a citation of source zero",
      (page) => (page.rows.range = "K–8 [0]."),
      /^pages\/sample\.json: rows\.range: cites \[0\]/,
    ],
    [
      "a source that is not https",
      (page) => (page.sources[1]!.url = "http://example.com/pricing"),
      /^pages\/sample\.json: sources\[1\]\.url: "http:\/\/example\.com\/pricing" must be an https address/,
    ],
    [
      "a source that is not an address",
      (page) => (page.sources[1]!.url = "example.com/pricing"),
      /^pages\/sample\.json: sources\[1\]\.url: .* must be an https address/,
    ],
    [
      "a source listed twice",
      (page) => (page.sources[1]!.url = "https://example.com"),
      /^pages\/sample\.json: sources\[1\]\.url: repeats sources\[0\] \(source 1\)/,
    ],
    [
      "a description that is too short",
      (page) => (page.description = "Too short."),
      /^pages\/sample\.json: description: is 10 characters; 110 to 160/,
    ],
    [
      "a description that is too long",
      (page) => (page.description = "x".repeat(161)),
      /^pages\/sample\.json: description: is 161 characters; 110 to 160/,
    ],
    [
      "a description with a citation",
      (page) => (page.description = `${"x".repeat(120)} [1]`),
      /^pages\/sample\.json: description: must not carry a citation marker/,
    ],
    [
      "no reasons",
      (page) => (page.reasons = []),
      /^pages\/sample\.json: reasons: has 0; 3 to 8/,
    ],
    [
      "too many reasons",
      (page) =>
        (page.reasons = Array.from({ length: 9 }, (_, index) => ({
          title: `Reason ${index}`,
          body: "Body.",
        }))),
      /^pages\/sample\.json: reasons: has 9; 3 to 8/,
    ],
    [
      "a reason with no words",
      (page) => (page.reasons[2]!.body = " "),
      /^pages\/sample\.json: reasons\[2\]\.body: must be a string with words in it/,
    ],
    [
      "too much credit",
      (page) => (page.credit = many(6)),
      /^pages\/sample\.json: credit: has 6; 2 to 5/,
    ],
    [
      "too much of their evidence",
      (page) => (page.evidence.theirs = many(5)),
      /^pages\/sample\.json: evidence\.theirs: has 5; 1 to 4/,
    ],
    [
      "too much of our evidence",
      (page) => (page.evidence.ours = many(4)),
      /^pages\/sample\.json: evidence\.ours: has 4; 1 to 3/,
    ],
    [
      "none of their evidence",
      (page) => (page.evidence.theirs = []),
      /^pages\/sample\.json: evidence\.theirs: has 0; 1 to 4/,
    ],
    [
      "too many questions",
      (page) =>
        (page.questions = Array.from({ length: 6 }, (_, index) => ({
          question: `Q${index}?`,
          answer: "A.",
        }))),
      /^pages\/sample\.json: questions: has 6; 2 to 5/,
    ],
    [
      "no table rows",
      (page) => (page.rows = {}),
      /^pages\/sample\.json: rows: has no rows/,
    ],
    [
      "a day that isn't one",
      (page) => (page.checked = "2026-02-30"),
      /^pages\/sample\.json: checked: "2026-02-30" must be a day/,
    ],
    [
      "a title benefit that is too long",
      (page) => (page.benefit = "x".repeat(33)),
      /^pages\/sample\.json: benefit: is 33 characters; at most 32/,
    ],
  ];
  for (const [name, change, expected] of cases) {
    const lines = broken(change);
    assert.ok(
      lines.some((line) => expected.test(line)),
      `${name}: expected ${expected}, got ${JSON.stringify(lines)}`,
    );
  }
  assert.ok(
    broken(() => {}, "Sample Math.json").some((line) =>
      /^pages\/Sample Math\.json: the file's name must be lower-case words joined by hyphens/.test(
        line,
      ),
    ),
    "a file whose name can't be an address",
  );
});

test("the limits are exactly the writers' brief", () => {
  assert.deepEqual(versusLimits, {
    line: 120,
    description: [110, 160],
    benefit: 32,
    theirs: [1, 3],
    credit: [2, 5],
    reasons: [3, 8],
    evidenceTheirs: [1, 4],
    evidenceOurs: [1, 3],
    rowWords: 30,
    questions: [2, 5],
  });
  // At each limit, a page is valid: citation markers are not words.
  assert.deepEqual(
    broken((page) => {
      page.line = "x".repeat(120);
      page.rows.range = `${words(30)} [1][2].`;
      page.reasons = Array.from({ length: 8 }, (_, index) => ({
        title: `Reason ${index}`,
        body: "Body.",
      }));
      page.credit = many(5);
      page.evidence = { theirs: many(4), ours: many(3) };
    }),
    [],
  );
});

test("the catalog is derived from the pages, in the hub's order", () => {
  const page = (slug: string, name: string, category: string): VersusPage => ({
    ...sample(),
    slug,
    name,
    category: category as VersusPage["category"],
    line: `${name}: a line.`,
  });
  const pages = [
    page("zearn", "Zearn", "school"),
    page("ixl", "IXL", "adaptive"),
    page("i-ready", "i-Ready", "school"),
    page("aleks", "ALEKS", "adaptive"),
    page("khan-academy", "Khan Academy", "courses"),
  ];
  const catalog = versusCatalogFrom(pages);
  assert.deepEqual(
    catalog.map((entry) => entry.slug),
    ["aleks", "ixl", "i-ready", "zearn", "khan-academy"],
    "by category order, then by name whatever its case",
  );
  assert.deepEqual(catalog[0], {
    slug: "aleks",
    name: "ALEKS",
    category: "adaptive",
    line: "ALEKS: a line.",
  });
  const files = (given: unknown) =>
    validateVersus({
      catalog: given,
      pages: pages.map((data) => ({ file: `${data.slug}.json`, data })),
    }).map(versusProblemLine);
  assert.deepEqual(files(catalog), []);
  // Out of step in each way: every message says how to fix it.
  const stale: [string, unknown, RegExp][] = [
    ["a page not listed", catalog.slice(1), /"aleks" is missing/],
    [
      "a listing with no page",
      [...catalog, { ...catalog[0], slug: "gone" }],
      /"gone" has no page/,
    ],
    [
      "a line that changed in its page",
      catalog.map((entry, index) =>
        index === 2 ? { ...entry, line: "An older line." } : entry,
      ),
      /"i-ready" differs from its page/,
    ],
    ["another order", [...catalog].reverse(), /the order differs/],
    ["not a list", {}, /"aleks" is missing/],
  ];
  for (const [name, given, expected] of stale) {
    const lines = files(given);
    assert.equal(lines.length, 1, name);
    assert.match(
      lines[0]!,
      /^catalog\.json: is out of step with pages\//,
      name,
    );
    assert.match(lines[0]!, expected, name);
    assert.match(lines[0]!, /run `npm run versus:catalog`$/, name);
  }
});

test("one page is checked alone, whatever the catalog and the other pages are", () => {
  // The seed page on disk, by its slug: nothing about catalog.json.
  assert.deepEqual(checkVersusPage("i-ready"), []);
  assert.deepEqual(checkVersusPage("no-such-program").map(versusProblemLine), [
    "pages/no-such-program.json: does not exist",
  ]);
  assert.deepEqual(checkVersusPage("../catalog").map(versusProblemLine), [
    "pages/../catalog.json: does not exist",
  ]);
});

test("a writer's page checks alone; the catalog is stale until it is rewritten, once", () => {
  // A copy of the content, with one new page and catalog.json untouched: as
  // it is while the pages are being written.
  const directory = pathToFileURL(
    `${mkdtempSync(join(tmpdir(), "amp-versus-"))}/`,
  );
  mkdirSync(new URL("pages/", directory));
  const source = new URL("../src/versus/", import.meta.url);
  copyFileSync(
    new URL("catalog.json", source),
    new URL("catalog.json", directory),
  );
  for (const { slug } of readVersus().pages)
    copyFileSync(
      new URL(`pages/${slug}.json`, source),
      new URL(`pages/${slug}.json`, directory),
    );
  writeFileSync(
    new URL("pages/sample.json", directory),
    JSON.stringify(sample()),
  );
  // Another writer's file, half written.
  writeFileSync(
    new URL("pages/half-written.json", directory),
    '{"slug": "half',
  );

  assert.deepEqual(checkVersusPage("sample", directory), []);
  const whole = checkVersusFiles(directory).map(versusProblemLine);
  assert.ok(
    whole.some((line) =>
      /^catalog\.json: is out of step with pages\/ \("sample" is missing\): run `npm run versus:catalog`$/.test(
        line,
      ),
    ),
    JSON.stringify(whole),
  );
  assert.ok(
    whole.some((line) =>
      line.startsWith("pages/half-written.json: is not JSON"),
    ),
    JSON.stringify(whole),
  );
  // The catalog is never written from pages that don't pass.
  assert.throws(() => writeVersusCatalog(directory), /half-written\.json/);
  writeFileSync(
    new URL("pages/half-written.json", directory),
    JSON.stringify({ ...sample(), slug: "half-written", name: "Aardvark" }),
  );
  const catalog = writeVersusCatalog(directory);
  assert.deepEqual(checkVersusFiles(directory), []);
  assert.deepEqual(
    catalog.slice(0, 2).map((entry) => entry.slug),
    ["half-written", "sample"],
    "adaptive comes first on the hub, and Aardvark before Sample",
  );
  assert.deepEqual(
    JSON.parse(readFileSync(new URL("catalog.json", directory), "utf8")),
    catalog,
  );
});

test("research components have stable ids, and the screen links land on them", () => {
  assert.deepEqual(
    researchPage.components.map((component) => component.id),
    [...researchComponentIds],
  );
  assert.deepEqual(
    [...researchComponentIds],
    [
      "level",
      "feedback",
      "lessons",
      "hints",
      "mastery",
      "review",
      "films",
      "progress",
      "incentives",
    ],
    "an id is an address other pages link to: it never changes",
  );
  const html = researchStaticHtml();
  for (const id of researchComponentIds)
    assert.ok(html.includes(`<li id="${id}">`), `/research#${id}`);
  assert.deepEqual(researchLink("review"), {
    href: "/research#review",
    label: "The research: Spaced, mixed review",
  });
  // The app screen gives each component the same id.
  assert.match(
    readFileSync("src/web/features/research/ResearchScreen.tsx", "utf8"),
    /<li key=\{component\.id\} id=\{component\.id\}>/,
  );
});

test("AMP's side: every row and category, in order, and the prices on sale", () => {
  assert.deepEqual(
    versusRows.map((row) => row.id),
    [...versusRowIds],
  );
  assert.deepEqual(
    versusCategories.map((category) => category.id),
    [...versusCategoryIds],
  );
  for (const row of versusRows) {
    assert.ok(row.label && row.amp, row.id);
    assert.deepEqual(citations(row.amp), [], `${row.id} cites no source`);
  }
  const dollars = (minor: number) => `$${minor / 100}`;
  const price = versusRows.find((row) => row.id === "price")!.amp;
  // The amounts on sale, however the cell words them.
  for (const amount of [
    dollars(stripeCatalog.prices.year.unitAmount),
    dollars(stripeCatalog.prices.month.unitAmount),
  ])
    assert.match(price, new RegExp(`\\${amount}(?!\\d)`), price);
  for (const id of versusHub.why.components)
    assert.ok(researchComponentIds.includes(id), id);
});

test("citations are read one way", () => {
  assert.deepEqual(citedParts("A [1][4] b [2]."), [
    { text: "A" },
    { cite: 1, after: false },
    { cite: 4, after: true },
    { text: " b" },
    { cite: 2, after: false },
    { text: "." },
  ]);
  assert.deepEqual(citations("No markers [here] or [1a]."), []);
  assert.equal(
    withoutCitations("Sold to schools [2]. Not homes [1][3]."),
    "Sold to schools. Not homes.",
  );
});

test("a page's title names the benefit, and stays inside a search result", () => {
  assert.equal(
    versusPageTitle({ name: "i-Ready", category: "school" }),
    "AMP vs i-Ready: Math Families Can Buy | AMP",
  );
  assert.equal(
    versusPageTitle({
      name: "i-Ready",
      category: "school",
      benefit: "Through Precalculus",
    }),
    "AMP vs i-Ready: Through Precalculus | AMP",
  );
  // Too long with its benefit: the name alone.
  assert.equal(
    versusPageTitle({
      name: "Russian School of Mathematics",
      category: "tutoring",
    }),
    "AMP vs Russian School of Mathematics | AMP",
  );
  for (const page of readVersus().pages) {
    const head = versusPageHead(page);
    assert.ok(head.title.length <= 60, `${page.slug}: ${head.title}`);
    assert.ok(head.title.startsWith(`AMP vs ${page.name}`), head.title);
    assert.equal(head.canonical, `https://amp.corpora.inc/versus/${page.slug}`);
    assert.equal(head.robots, null);
    assert.equal(head.description, page.description);
  }
  for (const category of versusCategories)
    assert.ok(category.benefit.length <= 32, category.benefit);
  assert.equal(checkedLabel("2026-11-21"), "November 2026");
  assert.equal(checkedLabel("2026-01-01"), "January 2026");
});

test("the hub and each comparison are served, indexable documents; the app's head leaves a comparison to its screen", () => {
  for (const path of [
    "/versus",
    "/versus/",
    "/versus/i-ready",
    "/versus/i-ready/",
  ]) {
    assert.ok(knownDocumentPath(path), path);
    assert.ok(indexableDocumentPath(path), path);
  }
  assert.equal(knownDocumentPath("/versus/i-ready/more"), false);
  const hub = versusHubHead;
  assert.equal(hub.title, "AMP vs Other Math Programs | AMP");
  // The title is the hub's own, kept out of the app's entry: the fixed
  // table has none, and GA takes the one the screen gives.
  assert.equal(Object.hasOwn(publicAppPageTitles, "/versus"), false);
  assert.equal(publicAppPageTitle("/versus", "pitch"), undefined);
  assert.equal(
    googlePageTitle(
      "https://amp.corpora.inc/versus",
      "pitch",
      undefined,
      hub.title,
    ),
    hub.title,
  );
  assert.ok(
    hub.description.length >= 110 && hub.description.length <= 160,
    String(hub.description.length),
  );
  assert.equal(hub.canonical, "https://amp.corpora.inc/versus");
  assert.equal(hub.robots, null);
  // The comparisons' heads are their screens' to write: a comparison's comes
  // from its own file, which the app's entry never loads.
  assert.equal(routeHead("/versus", "pitch"), undefined);
  assert.equal(routeHead("/versus/i-ready", "pitch"), undefined);
  assert.equal(routeHead("/versus/i-ready/", "app"), undefined);
  // Anything deeper is no comparison: the app's own head, kept out of search.
  assert.equal(
    routeHead("/versus/i-ready/more", "pitch")?.robots,
    "noindex, follow",
  );
});

test("related comparisons: three others in the category, every page linked", () => {
  const catalog = ["a", "b", "c", "d", "e"].map((slug) => ({
    slug,
    name: slug.toUpperCase(),
    category: "adaptive" as const,
    line: "x",
  }));
  catalog.push({ slug: "z", name: "Z", category: "games" as never, line: "x" });
  const slugs = (slug: string) =>
    relatedComparisons(slug, catalog).map((entry) => entry.slug);
  assert.deepEqual(slugs("a"), ["b", "c", "d"]);
  assert.deepEqual(slugs("d"), ["e", "a", "b"]);
  assert.deepEqual(slugs("z"), []);
  assert.deepEqual(slugs("missing"), []);
  const linked = new Set(catalog.flatMap((entry) => slugs(entry.slug)));
  for (const slug of ["a", "b", "c", "d", "e"])
    assert.ok(linked.has(slug), slug);
  assert.deepEqual(
    versusGroups(catalog).map((group) => [
      group.category.id,
      group.entries.length,
    ]),
    [
      ["adaptive", 5],
      ["games", 1],
    ],
    "the hub's order, and no empty category",
  );
});

test("each comparison's static document carries its words, its sources and its data", () => {
  const { catalog, pages } = readVersus();
  for (const page of pages) {
    const html = versusPageStaticHtml(page, catalog);
    assert.match(html, /^<main class="versus-static">/);
    assert.ok(html.includes(`<h1>AMP vs ${page.name}</h1>`), page.slug);
    // Sections in the page's order.
    const order = [
      "<h2>Why AMP</h2>",
      "<h2>Side by side</h2>",
      `<h2>What ${page.name} is</h2>`,
      `<h2>What ${page.name} does well</h2>`,
      "<h2>The evidence</h2>",
      `<h2>Choose ${page.name} if</h2>`,
      "<h2>Choose AMP if</h2>",
      "<h2>Questions</h2>",
      "<h2>Sources</h2>",
      "is a trademark of its owner",
      'href="/versus"',
    ].map((mark) => html.indexOf(mark));
    assert.ok(!order.includes(-1), `${page.slug}: ${order}`);
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
      page.slug,
    );
    // Every citation link has its source, and every source its anchor.
    const cited = [...html.matchAll(/href="#source-(\d+)"/g)].map((match) =>
      Number(match[1]),
    );
    assert.ok(cited.length > 0, `${page.slug} cites its sources`);
    for (const number of cited)
      assert.ok(
        html.includes(`<li id="source-${number}">`),
        `${page.slug} #source-${number}`,
      );
    page.sources.forEach((source, index) => {
      assert.ok(
        html.includes(`<li id="source-${index + 1}"><a href="${source.url}">`),
        source.url,
      );
    });
    assert.ok(
      !/\[\d+\]/.test(html),
      `${page.slug}: a raw citation marker is left in the words`,
    );
    // Only the rows the page has, AMP's cell first.
    for (const row of versusRows)
      assert.equal(
        html.includes(`<th scope="row">${row.label}</th>`),
        page.rows[row.id] !== undefined,
        `${page.slug} ${row.id}`,
      );
    assert.match(html, /<th scope="col">AMP<\/th><th scope="col">/);
    // Research links, the correction line, and the way back to the hub.
    for (const reason of page.reasons)
      for (const id of reason.research ?? [])
        assert.ok(
          html.includes(`<a href="/research#${id}">The research: `),
          `${page.slug} ${id}`,
        );
    assert.ok(
      html.includes(
        '<a href="mailto:skylar@corpora.inc">skylar@corpora.inc</a>',
      ),
    );
    assert.ok(html.includes(`Checked ${checkedLabel(page.checked)}.`));
    for (const other of relatedComparisons(page.slug, catalog))
      assert.ok(
        html.includes(`<a href="${versusPath(other.slug)}">AMP vs `),
        other.slug,
      );

    const data = versusPageJsonLd(page);
    assert.deepEqual(
      data.map((entry) => entry["@type"]),
      ["FAQPage", "BreadcrumbList"],
    );
    const text = JSON.stringify(data);
    assert.ok(
      !/Review|AggregateRating|ratingValue/.test(text),
      "never a review or a rating",
    );
    assert.ok(!/\[\d+\]/.test(text), "no citation marker in structured data");
    const [faq, crumbs] = data as unknown as [Loose, Loose];
    assert.deepEqual(
      faq.mainEntity.map((entry: Loose) => entry.name),
      page.questions.map((entry) => entry.question),
    );
    assert.deepEqual(
      crumbs.itemListElement.map((entry: Loose) => [
        entry.position,
        entry.name,
        entry.item,
      ]),
      [
        [1, "AMP", "https://amp.corpora.inc/"],
        [2, "Compare", "https://amp.corpora.inc/versus"],
        [
          3,
          `AMP vs ${page.name}`,
          `https://amp.corpora.inc/versus/${page.slug}`,
        ],
      ],
    );
  }
});

test("the hub's static document lists every comparison under its category", () => {
  const { catalog } = readVersus();
  const html = versusHubStaticHtml(catalog);
  assert.ok(html.includes(`<h1>${versusHub.title}</h1>`));
  assert.ok(html.includes('<a href="/research">'));
  for (const entry of catalog) {
    assert.ok(
      html.includes(`<a href="/versus/${entry.slug}">AMP vs `),
      entry.slug,
    );
    assert.ok(
      html.indexOf(`/versus/${entry.slug}"`) > html.indexOf("<h2>"),
      entry.slug,
    );
  }
  assert.deepEqual(
    versusHubJsonLd().map((entry) => entry["@type"]),
    ["BreadcrumbList"],
  );
});

test("the server answers the comparisons with their own documents, and a missing one with 404", () => {
  const conf = readFileSync("docker/nginx.conf", "utf8");
  for (const exact of ["/versus", "/versus/"]) {
    const block =
      new RegExp(`location = ${exact} \\{([^}]*)\\}`).exec(conf)?.[1] ?? "";
    assert.match(block, /try_files \/versus\/index\.html =404;/, exact);
  }
  const pages = /location \^~ \/versus\/ \{([^}]*)\}/.exec(conf)?.[1] ?? "";
  assert.match(pages, /try_files \$uri \$uri\/index\.html =404;/);
  assert.doesNotMatch(pages, /@application/);
  // Before the file rule and the app's fallback, as /pathways/ is.
  assert.ok(
    conf.indexOf("location ^~ /versus/") < conf.indexOf("location / {"),
  );
});

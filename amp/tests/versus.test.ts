/**
 * The comparison pages' content and what is built from it (src/versus):
 * every file on disk passes the validator, the validator catches each kind
 * of mistake, AMP's side matches the code it describes, and the static
 * documents carry what a crawler needs. `npm run versus:check` runs the same
 * validator for a writer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripeCatalog } from "../infra/stripe";
import { FREE_ONLINE_PROBLEMS } from "../src/learning/free-allowance";
import { TRIAL_WORKBOOKS_MAX } from "../src/learning/trial-workbooks";
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
import { checkVersusFiles, readVersus } from "../src/versus/files";
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
  type VersusCatalogEntry,
  type VersusPage,
} from "../src/versus/types";
import { validateVersus, versusProblemLine } from "../src/versus/validate";
import {
  publicAppPageTitle,
  publicAppPageTitles,
} from "../src/analytics/page-titles";
import {
  indexableDocumentPath,
  knownDocumentPath,
} from "../src/web/app/document-routes";
import { routeHead } from "../src/web/app/route-head";

test("every comparison file on disk is valid", () => {
  assert.deepEqual(checkVersusFiles().map(versusProblemLine), []);
  const { catalog, pages } = readVersus();
  assert.ok(pages.length >= 1, "there is at least one comparison");
  assert.deepEqual(
    pages.map((page) => page.slug),
    catalog.map((entry) => entry.slug),
  );
});

/** A valid page and its catalog line, to break one way at a time. */
const sample = (): { catalog: VersusCatalogEntry[]; page: VersusPage } => ({
  catalog: [
    {
      slug: "sample",
      name: "Sample",
      category: "adaptive",
      line: "Sample assigns lessons. AMP chooses each next problem.",
    },
  ],
  page: {
    slug: "sample",
    name: "Sample",
    category: "adaptive",
    checked: "2026-11-21",
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
  },
});

/** The problems after one change to the valid sample, as lines. */
function broken(
  change: (files: {
    catalog: VersusCatalogEntry[];
    page: VersusPage;
    file: string;
  }) => void,
  { withPage = true } = {},
) {
  const files = { ...sample(), file: "sample.json" };
  change(files);
  return validateVersus({
    catalog: files.catalog,
    pages: withPage ? [{ file: files.file, data: files.page }] : [],
  }).map(versusProblemLine);
}
type Loose = Record<string, any>;

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
      ({ page }) => delete (page as Loose).verdict,
      /^pages\/sample\.json: verdict: must be a string/,
    ],
    [
      "an unknown field",
      ({ page }) => ((page as Loose).summary = "x"),
      /^pages\/sample\.json: summary: is not a page field/,
    ],
    [
      "a wrong type",
      ({ page }) => ((page as Loose).theirs = "one paragraph"),
      /^pages\/sample\.json: theirs: must be a list/,
    ],
    [
      "a slug that is not the file's name",
      ({ page }) => (page.slug = "other"),
      /^pages\/sample\.json: slug: "other" must match the file's name, "sample"/,
    ],
    [
      "a page the catalog doesn't list",
      (files) => (files.catalog = []),
      /^pages\/sample\.json: "sample" is missing from catalog\.json/,
    ],
    [
      "a name that differs from the catalog's",
      ({ page }) => (page.name = "Sample Math"),
      /^pages\/sample\.json: name: "Sample Math" differs from the catalog's "Sample"/,
    ],
    [
      "a category that differs from the catalog's",
      ({ page }) => (page.category = "games"),
      /^pages\/sample\.json: category: "games" differs from the catalog's "adaptive"/,
    ],
    [
      "an unknown category",
      ({ page, catalog }) => {
        (page as Loose).category = "apps";
        (catalog[0] as Loose).category = "apps";
      },
      /^pages\/sample\.json: category: unknown category "apps"/,
    ],
    [
      "an unknown category in the catalog",
      ({ catalog }) => ((catalog[0] as Loose).category = "apps"),
      /^catalog\.json: \[0\]\.category: unknown category "apps"/,
    ],
    [
      "an unknown table row",
      ({ page }) => ((page.rows as Loose).cost = "$10"),
      /^pages\/sample\.json: rows\.cost: unknown row id/,
    ],
    [
      "an unknown research id",
      ({ page }) => ((page.reasons[0] as Loose).research = ["spacing"]),
      /^pages\/sample\.json: reasons\[0\]\.research\[0\]: unknown research id "spacing"/,
    ],
    [
      "a citation with no source",
      ({ page }) => (page.reasons[1]!.body = "Second [3]."),
      /^pages\/sample\.json: reasons\[1\]\.body: cites \[3\], and the page has 2 sources/,
    ],
    [
      "a citation of source zero",
      ({ page }) => (page.rows.range = "K–8 [0]."),
      /^pages\/sample\.json: rows\.range: cites \[0\]/,
    ],
    [
      "a source that is not https",
      ({ page }) => (page.sources[1]!.url = "http://example.com/pricing"),
      /^pages\/sample\.json: sources\[1\]\.url: "http:\/\/example\.com\/pricing" must be an https address/,
    ],
    [
      "a source that is not an address",
      ({ page }) => (page.sources[1]!.url = "example.com/pricing"),
      /^pages\/sample\.json: sources\[1\]\.url: .* must be an https address/,
    ],
    [
      "a source listed twice",
      ({ page }) => (page.sources[1]!.url = "https://example.com"),
      /^pages\/sample\.json: sources\[1\]\.url: repeats sources\[0\] \(source 1\)/,
    ],
    [
      "a description that is too short",
      ({ page }) => (page.description = "Too short."),
      /^pages\/sample\.json: description: is 10 characters; 110 to 160/,
    ],
    [
      "a description that is too long",
      ({ page }) => (page.description = "x".repeat(161)),
      /^pages\/sample\.json: description: is 161 characters; 110 to 160/,
    ],
    [
      "a description with a citation",
      ({ page }) => (page.description = `${"x".repeat(120)} [1]`),
      /^pages\/sample\.json: description: must not carry a citation marker/,
    ],
    [
      "no reasons",
      ({ page }) => (page.reasons = []),
      /^pages\/sample\.json: reasons: has 0; 3 to 6/,
    ],
    [
      "a reason with no words",
      ({ page }) => (page.reasons[2]!.body = " "),
      /^pages\/sample\.json: reasons\[2\]\.body: must be a string with words in it/,
    ],
    [
      "too many questions",
      ({ page }) =>
        (page.questions = Array.from({ length: 6 }, (_, index) => ({
          question: `Q${index}?`,
          answer: "A.",
        }))),
      /^pages\/sample\.json: questions: has 6; 2 to 5/,
    ],
    [
      "no table rows",
      ({ page }) => (page.rows = {}),
      /^pages\/sample\.json: rows: has no rows/,
    ],
    [
      "a day that isn't one",
      ({ page }) => (page.checked = "2026-02-30"),
      /^pages\/sample\.json: checked: "2026-02-30" must be a day/,
    ],
    [
      "a title benefit that is too long",
      ({ page }) => (page.benefit = "x".repeat(33)),
      /^pages\/sample\.json: benefit: is 33 characters; at most 32/,
    ],
    [
      "a catalog line that is too long",
      ({ catalog }) => (catalog[0]!.line = "x".repeat(121)),
      /^catalog\.json: \[0\]\.line: is 121 characters; at most 120/,
    ],
    [
      "a slug that can't be an address",
      (files) => {
        files.catalog[0]!.slug = "Sample Math";
        files.page.slug = "Sample Math";
        files.file = "Sample Math.json";
      },
      /^catalog\.json: \[0\]\.slug: "Sample Math" must be lower-case words joined by hyphens/,
    ],
    [
      "a slug listed twice",
      ({ catalog }) => catalog.push({ ...catalog[0]! }),
      /^catalog\.json: \[1\]\.slug: "sample" is listed twice/,
    ],
  ];
  for (const [name, change, expected] of cases) {
    const lines = broken(change);
    assert.ok(
      lines.some((line) => expected.test(line)),
      `${name}: expected ${expected}, got ${JSON.stringify(lines)}`,
    );
  }
});

test("a catalog line with no page is a problem, by name", () => {
  assert.deepEqual(
    broken(() => {}, { withPage: false }),
    ['catalog.json: lists "sample", and pages/sample.json does not exist'],
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
  assert.ok(
    price.includes(`${dollars(stripeCatalog.prices.year.unitAmount)} a year`),
    price,
  );
  assert.ok(
    price.includes(`${dollars(stripeCatalog.prices.month.unitAmount)} a month`),
    price,
  );
  assert.ok(price.includes(`${FREE_ONLINE_PROBLEMS} problems`), price);
  assert.ok(price.includes(`${TRIAL_WORKBOOKS_MAX} workbooks`), price);
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
  assert.equal(
    hub.title,
    publicAppPageTitles["/versus"],
    "the title GA receives",
  );
  assert.equal(publicAppPageTitle("/versus", "pitch"), hub.title);
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

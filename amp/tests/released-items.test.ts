import assert from "node:assert/strict";
import test from "node:test";
import { archetypes } from "../src/curriculum/archetypes";
import {
  buildReleasedItemLedger,
  releasedLedgers,
} from "../src/curriculum/released-items";
import {
  buildReleasedItemReport,
  renderReleasedItemReport,
  type ReleasedItemInput,
} from "../src/curriculum/released-items/ledger";
import {
  defineLedger,
  type LedgerRow,
  type ReleasedSource,
} from "../src/curriculum/released-items/types";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { templates } from "../src/math/engine";

const source = (id: string, test = "Fixture"): ReleasedSource => ({
  id,
  test,
  form: "Form A",
  url: `https://example.org/${id}.pdf`,
  edition: "2026 fixture",
  retrievedAt: "2026-10-26",
  sha256: "a".repeat(64),
  complete: true,
});
const row = (
  number: string,
  overrides: Partial<LedgerRow> = {},
): LedgerRow => ({
  item: { number, page: "p.1" },
  responseFormat: "numeric",
  standards: [],
  archetypeIds: ["alg.solve"],
  demand: "Solve a one-step linear equation",
  status: "covered",
  templateIds: ["solve-numeric"],
  limitations: "",
  ...overrides,
});
const common = { labeledBy: "fixture", labeledAt: "2026-10-26", section: "M1" };
const fixture = (
  rowsA: LedgerRow[],
  rowsB: LedgerRow[] = [],
): ReleasedItemInput => ({
  ledgers: [
    defineLedger(source("a"), common, rowsA),
    defineLedger(source("b"), common, rowsB),
  ],
  archetypes: [
    { id: "alg.solve", domain: "algebra", summary: "Solve a linear equation" },
    { id: "geo.area", domain: "geometry", summary: "Find a polygon's area" },
    { id: "data.mean", domain: "data", summary: "Compute a data set's mean" },
  ],
  templates: [
    { id: "solve-numeric", skillId: "linear" },
    {
      id: "solve-choice",
      skillId: "linear",
      requiredResponseCapability: "single-choice-v1",
    },
    { id: "area-numeric", skillId: "area" },
  ],
  templateArchetypes: {
    "solve-numeric": ["alg.solve"],
    "solve-choice": ["alg.solve"],
    "area-numeric": ["geo.area"],
  },
  skillIds: ["linear", "area", "mean"],
  facetMappings: [
    { templateId: "solve-numeric", facetId: "linear.solve" },
    { templateId: "other", facetId: "mean.compute" },
  ],
});
const gap = (n: string, archetype: string, status: "partial" | "missing") =>
  row(n, {
    archetypeIds: [archetype],
    status,
    templateIds: status === "partial" ? ["area-numeric"] : [],
    limitations: "Related practice uses a different representation.",
  });

test("the registered ledger validates and labels every SAT practice math item once", () => {
  const report = buildReleasedItemLedger();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.predictsFutureQuestions, false);
  const sat = releasedLedgers.filter(
    (l) => l.source.test === "SAT" && l.source.complete,
  );
  assert.ok(sat.length >= 8);
  for (const ledger of sat) {
    assert.equal(ledger.items.length, 54, ledger.source.id);
    for (const module of ["Math module 1", "Math module 2"])
      assert.deepEqual(
        ledger.items
          .filter((i) => i.section === module)
          .map((i) => Number(i.item.number)),
        Array.from({ length: 27 }, (_, i) => i + 1),
      );
  }
  const satTests = report.tests.find((t) => t.test === "SAT")!;
  assert.equal(
    satTests.covered + satTests.partial + satTests.missing,
    satTests.items,
  );
});

test("every archetype link and item reference resolves", () => {
  const ids = new Set(archetypes.map((a) => a.id));
  assert.equal(ids.size, archetypes.length);
  const known = new Set(templates.map((t) => t.id));
  for (const [templateId, links] of Object.entries(templateArchetypes)) {
    assert.ok(known.has(templateId), templateId);
    for (const id of links) assert.ok(ids.has(id), `${templateId} → ${id}`);
  }
});

test("validation rejects unknown references, duplicates and unsupported coverage", () => {
  const errors = (input: ReleasedItemInput) =>
    buildReleasedItemReport(input).errors.join("\n");
  assert.equal(errors(fixture([row("1")])), "");
  assert.match(
    errors(fixture([row("1", { archetypeIds: ["nope"] })])),
    /unknown archetype nope/,
  );
  assert.match(
    errors(fixture([row("1", { templateIds: ["nope"] })])),
    /unknown template nope/,
  );
  assert.match(errors(fixture([row("1"), row("1")])), /duplicate item/);
  assert.match(
    errors({
      ...fixture([row("1")]),
      ledgers: [
        defineLedger(source("a"), common, [row("1")]),
        defineLedger(source("a"), common, []),
      ],
    }),
    /Duplicate source: a/,
  );
  const orphan = fixture([row("1")]);
  orphan.ledgers = [
    {
      source: source("a"),
      items: [{ ...orphan.ledgers[0]!.items[0]!, sourceId: "z" }],
    },
  ];
  assert.match(errors(orphan), /unknown source/);
  // A choice-only template cannot cover numeric entry.
  assert.match(
    errors(fixture([row("1", { templateIds: ["solve-choice"] })])),
    /covered needs a template linked to the item's archetype that accepts numeric responses/,
  );
  assert.equal(
    errors(
      fixture([
        row("1", {
          templateIds: ["solve-choice"],
          status: "partial",
          limitations: "Choice practice only; no numeric entry.",
        }),
      ]),
    ),
    "",
  );
  // Numeric entry may serve a choice item; nothing serves constructed responses.
  assert.equal(errors(fixture([row("1", { responseFormat: "choice" })])), "");
  assert.match(
    errors(fixture([row("1", { responseFormat: "constructed" })])),
    /that accepts constructed responses/,
  );
  assert.match(
    errors(fixture([row("1", { templateIds: [] })])),
    /covered items need at least one template/,
  );
  assert.match(
    errors(
      fixture([
        row("1", {
          status: "missing",
          limitations: "No practice for this task exists.",
        }),
      ]),
    ),
    /missing items cannot cite templates/,
  );
  assert.match(
    errors(fixture([row("1", { status: "partial" })])),
    /must state limitations/,
  );
  // A sub-step template may support a partial item but cannot cover it.
  assert.match(
    errors(fixture([row("1", { archetypeIds: ["geo.area"] })])),
    /covered needs a template linked to the item's archetype/,
  );
  assert.equal(
    errors(
      fixture([
        row("1", {
          archetypeIds: ["geo.area"],
          status: "partial",
          limitations: "Only the equation-solving step is practiced.",
        }),
      ]),
    ),
    "",
  );
  const unlinked = fixture([row("1")]);
  unlinked.templateArchetypes = { "area-numeric": ["geo.area"] };
  assert.match(errors(unlinked), /solve-numeric has no archetype link/);
  assert.match(
    errors({
      ...fixture([row("1")]),
      templateArchetypes: {
        ...fixture([]).templateArchetypes,
        ghost: ["alg.solve"],
      },
    }),
    /unknown template: ghost/,
  );
  const sat = fixture([]);
  sat.ledgers = [
    defineLedger(source("s", "SAT"), common, [
      row("1", { standards: ["sat.alg.nope"] }),
      row("2"),
      row("3", { standards: ["sat.alg.linear-functions"] }),
    ]),
  ];
  assert.match(errors(sat), /1: unknown SAT framework skill/);
  assert.match(errors(sat), /2: SAT items need exactly one framework skill/);
  assert.doesNotMatch(errors(sat), /\/ 3:/);
});

test("metrics, gaps and saturation are computed from a small fixture", () => {
  const input = fixture(
    [
      row("1"),
      row("2", { responseFormat: "choice", templateIds: ["solve-choice"] }),
      gap("3", "geo.area", "partial"),
    ],
    [
      row("1"),
      gap("2", "geo.area", "missing"),
      gap("3", "data.mean", "missing"),
      gap("4", "geo.area", "partial"),
    ],
  );
  const report = buildReleasedItemReport(input);
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.deepEqual(
    { ...report.summary },
    {
      sources: 2,
      items: 7,
      covered: 3,
      partial: 2,
      missing: 2,
      coveredPct: 42.9,
      partialPct: 28.6,
      missingPct: 28.6,
    },
  );
  assert.deepEqual(
    report.sources.map((s) => [s.id, s.covered, s.partial, s.missing]),
    [
      ["a", 2, 1, 0],
      ["b", 1, 1, 2],
    ],
  );
  assert.deepEqual(
    report.gaps.map((g) => [g.id, g.missing, g.partial, g.sources]),
    [
      ["geo.area", 1, 2, 2],
      ["data.mean", 1, 0, 1],
    ],
  );
  const numeric = report.responseFormatGaps.find(
    (f) => f.responseFormat === "numeric",
  )!;
  assert.equal(numeric.items, 6);
  assert.deepEqual(
    report.saturation.map((s) => [
      s.sourceId,
      s.newArchetypes,
      s.cumulativeArchetypes,
      s.itemsOnSeenArchetypes,
      s.seenSharePct,
    ]),
    [
      ["a", 2, 2, 0, 0],
      ["b", 1, 3, 3, 75],
    ],
  );
  assert.deepEqual(report.saturation[1]!.newArchetypeIds, ["data.mean"]);
  const formatLimited = buildReleasedItemReport(
    fixture([
      row("1", {
        templateIds: ["solve-choice"],
        status: "partial",
        limitations: "Choice practice only; no numeric entry.",
      }),
    ]),
  ).responseFormatGaps.find((f) => f.responseFormat === "numeric")!;
  assert.equal(formatLimited.formatLimited, 1);
  assert.equal(formatLimited.withoutNativeProtocol, 1);
  const choiceByEntry = buildReleasedItemReport(
    fixture([
      row("1", {
        responseFormat: "choice",
        status: "partial",
        limitations: "Choices are equations; practice enters numbers.",
      }),
    ]),
  ).responseFormatGaps.find((f) => f.responseFormat === "choice")!;
  assert.deepEqual(
    [choiceByEntry.formatLimited, choiceByEntry.withoutNativeProtocol],
    [0, 1],
  );
  assert.deepEqual(
    [
      report.archetypeLinks.templatesLinked,
      report.archetypeLinks.skillsLinked,
      report.archetypeLinks.facetsLinked,
      report.archetypeLinks.facets,
    ],
    [3, 2, 1, 2],
  );
  assert.deepEqual(report.archetypeLinks.archetypesWithoutTemplates, [
    "data.mean",
  ]);
});

test("reports are deterministic", () => {
  const input = fixture([row("1"), gap("2", "geo.area", "missing")]);
  assert.equal(
    JSON.stringify(buildReleasedItemReport(input)),
    JSON.stringify(buildReleasedItemReport(input)),
  );
  const a = buildReleasedItemLedger();
  assert.equal(JSON.stringify(a), JSON.stringify(buildReleasedItemLedger()));
  assert.equal(
    renderReleasedItemReport(a, { items: true }),
    renderReleasedItemReport(buildReleasedItemLedger(), { items: true }),
  );
  assert.match(
    renderReleasedItemReport(a),
    /not future or unpublished questions/,
  );
});

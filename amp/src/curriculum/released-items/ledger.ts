import type { Archetype } from "../archetypes";
import {
  acceptedResponses,
  itemStatuses,
  responseFormats,
  satSkills,
  type ItemStatus,
  type ReleasedItem,
  type SourceLedger,
  type TemplateResponse,
} from "./types";

export interface LedgerTemplate {
  id: string;
  skillId: string;
  requiredResponseCapability?: string;
}
export interface ReleasedItemInput {
  /** Stable order: the saturation curve reads sources in this order. */
  ledgers: readonly SourceLedger[];
  archetypes: readonly Archetype[];
  templates: readonly LedgerTemplate[];
  /** Template → archetypes it practices. Partial backfill is allowed. */
  templateArchetypes: Readonly<Record<string, readonly string[]>>;
  skillIds?: readonly string[];
  facetMappings?: readonly { templateId: string; facetId: string }[];
}
const date = /^\d{4}-\d{2}-\d{2}$/;
const digest = /^[a-f0-9]{64}$/;
const sat = new Set<string>(satSkills);
export const templateResponse = (t: LedgerTemplate): TemplateResponse =>
  (t.requiredResponseCapability as TemplateResponse | undefined) ?? "numeric";
export const itemKey = (
  i: Pick<ReleasedItem, "sourceId" | "section" | "item">,
) => `${i.sourceId} / ${i.section} / ${i.item.number}`;
const pct = (part: number, whole: number) =>
  whole ? Math.round((part * 1000) / whole) / 10 : 0;
function tally(items: readonly ReleasedItem[]) {
  const count = (s: ItemStatus) => items.filter((i) => i.status === s).length;
  const [covered, partial, missing] = itemStatuses.map(count) as [
    number,
    number,
    number,
  ];
  return {
    items: items.length,
    covered,
    partial,
    missing,
    coveredPct: pct(covered, items.length),
    partialPct: pct(partial, items.length),
    missingPct: pct(missing, items.length),
  };
}
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** Validate every ledger and compute bounded-set coverage metrics. Pure and
 * deterministic: the same input always yields the same report. */
export function buildReleasedItemReport(input: ReleasedItemInput) {
  const errors: string[] = [];
  const archetypeById = new Map(input.archetypes.map((a) => [a.id, a]));
  const templateById = new Map(input.templates.map((t) => [t.id, t]));
  const seenArchetypes = new Set<string>();
  for (const a of input.archetypes) {
    if (seenArchetypes.has(a.id)) errors.push(`Duplicate archetype: ${a.id}`);
    seenArchetypes.add(a.id);
    if (!/^[a-z]+(\.[a-z0-9-]+)+$/.test(a.id) || a.summary.length < 10)
      errors.push(`Malformed archetype: ${a.id}`);
  }
  for (const [templateId, ids] of Object.entries(input.templateArchetypes)) {
    if (!templateById.has(templateId))
      errors.push(`Archetype link names unknown template: ${templateId}`);
    if (!ids.length) errors.push(`Empty archetype link: ${templateId}`);
    for (const id of ids)
      if (!archetypeById.has(id))
        errors.push(`Template ${templateId} links unknown archetype: ${id}`);
  }
  const sourceIds = new Set<string>();
  for (const { source } of input.ledgers) {
    if (sourceIds.has(source.id)) errors.push(`Duplicate source: ${source.id}`);
    sourceIds.add(source.id);
    const docs = [source, ...(source.supplements ?? [])];
    if (
      docs.some((d) => !d.url.startsWith("https://") || !digest.test(d.sha256))
    )
      errors.push(`Source ${source.id} needs https URLs and SHA-256 digests`);
    if (!date.test(source.retrievedAt) || !source.edition || !source.form)
      errors.push(`Source ${source.id} needs edition, form and retrieval date`);
  }
  const keys = new Set<string>();
  const items = input.ledgers.flatMap((l) => l.items);
  for (const item of items) {
    const key = itemKey(item);
    const fail = (message: string) => errors.push(`${key}: ${message}`);
    if (!sourceIds.has(item.sourceId)) fail("unknown source");
    if (keys.has(key)) fail("duplicate item");
    keys.add(key);
    if (!responseFormats.includes(item.responseFormat))
      fail(`unknown response format ${item.responseFormat}`);
    if (!itemStatuses.includes(item.status))
      fail(`unknown status ${item.status}`);
    if (!item.item.page) fail("missing page locator");
    if (item.demand.length < 10 || item.demand.length > 240)
      fail("demand must be a one-line original summary");
    if (!item.labeledBy || !date.test(item.labeledAt))
      fail("missing labeler or label date");
    if (item.status !== "covered" && item.limitations.length < 20)
      fail("partial or missing items must state limitations");
    if (!item.archetypeIds.length) fail("no archetype");
    if (new Set(item.archetypeIds).size !== item.archetypeIds.length)
      fail("duplicate archetype");
    for (const id of item.archetypeIds)
      if (!archetypeById.has(id)) fail(`unknown archetype ${id}`);
    if (new Set(item.templateIds).size !== item.templateIds.length)
      fail("duplicate template");
    const source = input.ledgers.find((l) => l.source.id === item.sourceId);
    const satCodes = item.standards.filter((code) => code.startsWith("sat."));
    if (satCodes.some((code) => !sat.has(code)))
      fail("unknown SAT framework skill");
    if (source?.source.test === "SAT" && satCodes.length !== 1)
      fail("SAT items need exactly one framework skill");
    const known = item.templateIds.flatMap((id) => {
      const template = templateById.get(id);
      if (!template) fail(`unknown template ${id}`);
      else if (!input.templateArchetypes[id]?.length)
        fail(`template ${id} has no archetype link`);
      return template ? [template] : [];
    });
    if (item.status === "missing" && item.templateIds.length)
      fail("missing items cannot cite templates");
    if (item.status !== "missing" && !item.templateIds.length)
      fail(`${item.status} items need at least one template`);
    // Partial items may cite templates for a sub-step; coverage needs a
    // template that practices one of the item's own archetypes in a format
    // that can take the item's response.
    if (
      item.status === "covered" &&
      !known.some(
        (t) =>
          acceptedResponses[item.responseFormat]?.includes(
            templateResponse(t),
          ) &&
          input.templateArchetypes[t.id]?.some((a) =>
            item.archetypeIds.includes(a),
          ),
      )
    )
      fail(
        `covered needs a template linked to the item's archetype that accepts ${item.responseFormat} responses`,
      );
  }

  const capable = (item: ReleasedItem) =>
    item.templateIds.some((id) => {
      const t = templateById.get(id);
      return (
        !!t &&
        acceptedResponses[item.responseFormat].includes(templateResponse(t))
      );
    });
  const responseFormatGaps = responseFormats
    .map((format) => {
      const group = items.filter((i) => i.responseFormat === format);
      return {
        responseFormat: format,
        ampProtocols: acceptedResponses[format],
        ...tally(group),
        // Related practice exists, but no cited template can take this format.
        formatLimited: group.filter((i) => i.templateIds.length && !capable(i))
          .length,
        // Not covered, and no cited template uses the item's own protocol
        // (e.g. choice items practiced only by numeric entry).
        withoutNativeProtocol: group.filter(
          (i) =>
            i.status !== "covered" &&
            i.templateIds.length &&
            !i.templateIds.some((id) => {
              const t = templateById.get(id);
              return (
                !!t && templateResponse(t) === acceptedResponses[format][0]
              );
            }),
        ).length,
      };
    })
    .filter((row) => row.items > 0);

  const linked = (archetypeId: string) =>
    sorted(
      Object.entries(input.templateArchetypes)
        .filter(([, ids]) => ids.includes(archetypeId))
        .map(([id]) => id),
    );
  const archetypeRows = input.archetypes
    .map((a) => {
      const group = items.filter((i) => i.archetypeIds.includes(a.id));
      return {
        id: a.id,
        domain: a.domain,
        summary: a.summary,
        sources: sorted(group.map((i) => i.sourceId)).length,
        ...tally(group),
        responseFormats: sorted(group.map((i) => i.responseFormat)),
        templateIds: linked(a.id),
      };
    })
    .sort((x, y) => x.id.localeCompare(y.id));
  const gaps = archetypeRows
    .filter((a) => a.missing + a.partial > 0)
    .map(({ id, domain, summary, items, missing, partial, sources }) => ({
      id,
      domain,
      summary,
      items,
      missing,
      partial,
      sources,
    }))
    .sort(
      (x, y) =>
        y.missing + y.partial - (x.missing + x.partial) ||
        y.missing - x.missing ||
        x.id.localeCompare(y.id),
    );

  const seen = new Set<string>();
  let cumulative = 0;
  const saturation = input.ledgers.map(({ source, items: group }) => {
    const here = sorted(group.flatMap((i) => i.archetypeIds));
    const added = here.filter((id) => !seen.has(id));
    const onSeen = group.filter((i) =>
      i.archetypeIds.every((id) => seen.has(id)),
    ).length;
    added.forEach((id) => seen.add(id));
    cumulative += added.length;
    return {
      sourceId: source.id,
      items: group.length,
      archetypes: here.length,
      newArchetypes: added.length,
      cumulativeArchetypes: cumulative,
      itemsOnSeenArchetypes: onSeen,
      seenSharePct: pct(onSeen, group.length),
      newArchetypeIds: added,
    };
  });

  const linkedTemplates = new Set(
    Object.keys(input.templateArchetypes).filter((id) => templateById.has(id)),
  );
  const linkedSkills = new Set(
    input.templates
      .filter((t) => linkedTemplates.has(t.id))
      .map((t) => t.skillId),
  );
  const facets = input.facetMappings ?? [];
  const facetIds = sorted(facets.map((m) => m.facetId));
  const linkedFacets = sorted(
    facets
      .filter((m) => linkedTemplates.has(m.templateId))
      .map((m) => m.facetId),
  );
  const skillIds =
    input.skillIds ?? sorted(input.templates.map((t) => t.skillId));
  const used = new Set(items.flatMap((i) => i.archetypeIds));

  const ledgerSources = input.ledgers.map(({ source, items: group }) => ({
    id: source.id,
    test: source.test,
    form: source.form,
    url: source.url,
    edition: source.edition,
    retrievedAt: source.retrievedAt,
    sha256: source.sha256,
    complete: source.complete,
    ...tally(group),
  }));
  const tests = sorted(input.ledgers.map((l) => l.source.test)).map((test) => {
    const group = input.ledgers.filter((l) => l.source.test === test);
    return {
      test,
      sources: group.length,
      completeSources: group.filter((l) => l.source.complete).length,
      ...tally(group.flatMap((l) => l.items)),
    };
  });

  return {
    schemaVersion: 1,
    scope: "bounded-released-sets" as const,
    // Released sets are fixed; nothing here estimates unpublished or future questions.
    predictsFutureQuestions: false,
    valid: errors.length === 0,
    errors,
    summary: { sources: input.ledgers.length, ...tally(items) },
    tests,
    sources: ledgerSources,
    responseFormatGaps,
    gaps,
    saturation,
    archetypeLinks: {
      archetypes: input.archetypes.length,
      usedByItems: used.size,
      templatesLinked: linkedTemplates.size,
      templates: input.templates.length,
      skillsLinked: skillIds.filter((id) => linkedSkills.has(id)).length,
      skills: skillIds.length,
      facetsLinked: linkedFacets.length,
      facets: facetIds.length,
      archetypesWithoutTemplates: input.archetypes
        .map((a) => a.id)
        .filter((id) => !linked(id).length)
        .sort(),
    },
    archetypes: archetypeRows,
    items: items.map((item) => ({ key: itemKey(item), ...item })),
  };
}
export type ReleasedItemReport = ReturnType<typeof buildReleasedItemReport>;
export type ReleasedItemSummary = Omit<
  ReleasedItemReport,
  "items" | "archetypes"
>;
/** The report without per-item and per-archetype rows. */
export function summarizeReleasedItems({
  items: _items,
  archetypes: _archetypes,
  ...summary
}: ReleasedItemReport): ReleasedItemSummary {
  return summary;
}

const cell = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ");
const counts = (r: {
  items: number;
  covered: number;
  partial: number;
  missing: number;
  coveredPct: number;
  partialPct: number;
  missingPct: number;
}) =>
  `${r.items} | ${r.covered} (${r.coveredPct}%) | ${r.partial} (${r.partialPct}%) | ${r.missing} (${r.missingPct}%)`;

/** Markdown summary; pass `items: true` for the full per-item table. */
export function renderReleasedItemReport(
  report: ReleasedItemSummary & Partial<Pick<ReleasedItemReport, "items">>,
  options: { items?: boolean; gapLimit?: number } = {},
): string {
  const gapRows = report.gaps.slice(0, options.gapLimit ?? report.gaps.length);
  return [
    "## Released-item coverage",
    "",
    "Each item of a bounded, published question set is labeled once. Coverage describes that fixed set, not future or unpublished questions.",
    "",
    `Ledger valid: ${report.valid}. Sources: ${report.summary.sources}. Items: ${report.summary.items}.`,
    ...report.errors.map((e) => `ERROR: ${e}`),
    "",
    "| Test | Sources (complete) | Items | Covered | Partial | Missing |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.tests.map(
      (t) =>
        `| ${cell(t.test)} | ${t.sources} (${t.completeSources}) | ${counts(t)} |`,
    ),
    "",
    "| Source | Form | Complete | Items | Covered | Partial | Missing |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...report.sources.map(
      (s) =>
        `| [${s.id}](${s.url}) | ${cell(s.form)} | ${s.complete ? "yes" : "sample"} | ${counts(s)} |`,
    ),
    "",
    "### Response formats",
    "",
    "Last two columns count related practice that no cited template can answer in this format, and uncovered items whose cited templates all use another protocol.",
    "",
    "| Format | AMP protocols | Items | Covered | Partial | Missing | No capable template | Other protocol only |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.responseFormatGaps.map(
      (f) =>
        `| ${f.responseFormat} | ${f.ampProtocols.join(", ") || "none"} | ${counts(f)} | ${f.formatLimited} | ${f.withoutNativeProtocol} |`,
    ),
    "",
    "### Archetype saturation",
    "",
    "Sources in ledger order. A source that adds no new archetypes and whose items fall on already-seen archetypes adds little new practice scope.",
    "",
    "| Source | Items | Archetypes | New | Cumulative | Items on seen archetypes |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.saturation.map(
      (s) =>
        `| ${s.sourceId} | ${s.items} | ${s.archetypes} | ${s.newArchetypes} | ${s.cumulativeArchetypes} | ${s.itemsOnSeenArchetypes} (${s.seenSharePct}%) |`,
    ),
    "",
    "### Ranked archetype gaps",
    "",
    "| Archetype | Domain | Missing | Partial | Items | Sources |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...gapRows.map(
      (g) =>
        `| ${g.id}: ${cell(g.summary)} | ${g.domain} | ${g.missing} | ${g.partial} | ${g.items} | ${g.sources} |`,
    ),
    "",
    `Archetype links: ${report.archetypeLinks.templatesLinked}/${report.archetypeLinks.templates} templates, ${report.archetypeLinks.skillsLinked}/${report.archetypeLinks.skills} skills and ${report.archetypeLinks.facetsLinked}/${report.archetypeLinks.facets} mapped facets reach an archetype. ${report.archetypeLinks.archetypesWithoutTemplates.length} of ${report.archetypeLinks.archetypes} archetypes have no linked template.`,
    "",
    ...(options.items && report.items
      ? [
          "### Items",
          "",
          "| Item | Format | Archetypes | Demand | Status | Templates | Limitations |",
          "| --- | --- | --- | --- | --- | --- | --- |",
          ...report.items.map(
            (i) =>
              `| ${cell(i.key)} | ${i.responseFormat} | ${i.archetypeIds.join(", ")} | ${cell(i.demand)} | ${i.status} | ${i.templateIds.join(", ") || "—"} | ${cell(i.limitations)} |`,
          ),
          "",
        ]
      : []),
  ].join("\n");
}

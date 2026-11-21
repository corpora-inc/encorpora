/** The comparison content's rules, as one check: `npm run versus:check`
 * runs it over the files, and tests/versus.test.ts fails on anything it
 * finds. Pure: it takes parsed JSON, so it runs anywhere.
 *
 * A page is checked on its own (`validateVersusPage`), so a writer can check
 * one file while others are being written. The catalog is derived from the
 * pages (`versusCatalogFrom`, `npm run versus:catalog`); the whole check
 * (`validateVersus`) also fails when `catalog.json` is not what the pages
 * give.
 *
 * Every problem names its file and the place in it, so a writer can go
 * straight there. */
import { researchPage } from "../research/report";
import { citations, withoutCitations } from "./citations";
import {
  versusCategoryIds,
  versusRowIds,
  type VersusCatalogEntry,
  type VersusPage,
} from "./types";

export type VersusProblem = {
  /** "catalog.json" or "pages/i-ready.json". */
  file: string;
  /** Where in the file: "reasons[2].research[0]". Empty for the file itself. */
  path: string;
  message: string;
};

export type VersusFiles = {
  catalog: unknown;
  /** Each page's parsed JSON by its file name ("i-ready.json"). */
  pages: readonly { file: string; data: unknown }[];
};

/** Counts are least and most; lengths are in characters. */
export const versusLimits = {
  /** The hub's line: one sentence. */
  line: 120,
  description: [110, 160],
  benefit: 32,
  theirs: [1, 3],
  credit: [2, 5],
  reasons: [3, 8],
  evidenceTheirs: [1, 4],
  evidenceOurs: [1, 3],
  /** A table cell, in words (citation markers are not words). */
  rowWords: 30,
  questions: [2, 5],
} as const;

/** How to bring `catalog.json` back in step with the pages. */
export const VERSUS_CATALOG_COMMAND = "npm run versus:catalog";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const researchIds = researchPage.components.map((component) => component.id);
const pageKeys = [
  "slug",
  "name",
  "maker",
  "category",
  "checked",
  "line",
  "benefit",
  "description",
  "verdict",
  "theirs",
  "credit",
  "reasons",
  "evidence",
  "rows",
  "fit",
  "questions",
  "sources",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const oneOf = (values: readonly string[]) => values.join(", ");
const wordCount = (text: string) =>
  withoutCitations(text).split(/\s+/).filter(Boolean).length;

/** A real calendar day, "2026-11-21". */
function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Everything wrong with one page's file (`name` is "i-ready.json"). It
 * reads nothing but the page: not the catalog, not another page. */
export function validateVersusPage(
  name: string,
  data: unknown,
): VersusProblem[] {
  const problems: VersusProblem[] = [];
  const file = `pages/${name}`;
  const problem = (path: string, message: string) =>
    problems.push({ file, path, message });
  const expected = name.replace(/\.json$/, "");
  if (!slugPattern.test(expected))
    problem("", `the file's name must be lower-case words joined by hyphens`);
  if (!isRecord(data)) {
    problem("", "must be an object");
    return problems;
  }
  for (const key of Object.keys(data))
    if (!pageKeys.includes(key)) problem(key, "is not a page field");

  /** Every prose string, for the citation check at the end. */
  const prose: { path: string; text: string }[] = [];
  const text = (
    value: unknown,
    path: string,
    { cited = true }: { cited?: boolean } = {},
  ) => {
    if (typeof value !== "string" || !value.trim()) {
      problem(path, "must be a string with words in it");
      return;
    }
    if (value !== value.trim()) problem(path, "starts or ends with a space");
    if (cited) prose.push({ path, text: value });
    else if (citations(value).length)
      problem(path, "must not carry a citation marker");
    return value;
  };
  const list = (
    value: unknown,
    path: string,
    [least, most]: readonly [number, number],
  ): unknown[] => {
    if (!Array.isArray(value)) {
      problem(path, "must be a list");
      return [];
    }
    if (value.length < least || value.length > most)
      problem(
        path,
        `has ${value.length}; ${
          most === Infinity
            ? `at least ${least}`
            : least === most
              ? `exactly ${least}`
              : `${least} to ${most}`
        }`,
      );
    return value;
  };
  const texts = (
    value: unknown,
    path: string,
    range: readonly [number, number],
  ) =>
    list(value, path, range).forEach((item, index) =>
      text(item, `${path}[${index}]`),
    );
  const record = (value: unknown, path: string, keys: readonly string[]) => {
    if (!isRecord(value)) {
      problem(path, `must be an object with ${oneOf(keys)}`);
      return;
    }
    for (const key of Object.keys(value))
      if (!keys.includes(key)) problem(`${path}.${key}`, "is not a field here");
    return value;
  };
  const atMost = (value: string | undefined, path: string, most: number) => {
    if (value !== undefined && value.length > most)
      problem(path, `is ${value.length} characters; at most ${most}`);
  };

  const slug = text(data.slug, "slug", { cited: false });
  if (slug !== undefined && slug !== expected)
    problem("slug", `"${slug}" must match the file's name, "${expected}"`);
  text(data.name, "name", { cited: false });
  if ("maker" in data) text(data.maker, "maker", { cited: false });
  const category = text(data.category, "category", { cited: false });
  if (
    category !== undefined &&
    !(versusCategoryIds as readonly string[]).includes(category)
  )
    problem(
      "category",
      `unknown category "${category}" (one of: ${oneOf(versusCategoryIds)})`,
    );
  const checked = text(data.checked, "checked", { cited: false });
  if (checked !== undefined && !isDay(checked))
    problem("checked", `"${checked}" must be a day like 2026-11-21`);
  atMost(text(data.line, "line", { cited: false }), "line", versusLimits.line);
  if ("benefit" in data)
    atMost(
      text(data.benefit, "benefit", { cited: false }),
      "benefit",
      versusLimits.benefit,
    );
  const description = text(data.description, "description", { cited: false });
  if (description !== undefined) {
    const [least, most] = versusLimits.description;
    if (description.length < least || description.length > most)
      problem(
        "description",
        `is ${description.length} characters; ${least} to ${most}`,
      );
  }
  text(data.verdict, "verdict");
  texts(data.theirs, "theirs", versusLimits.theirs);
  texts(data.credit, "credit", versusLimits.credit);

  list(data.reasons, "reasons", versusLimits.reasons).forEach((item, index) => {
    const at = `reasons[${index}]`;
    const reason = record(item, at, ["title", "body", "research"]);
    if (!reason) return;
    text(reason.title, `${at}.title`);
    text(reason.body, `${at}.body`);
    if (!("research" in reason)) return;
    const ids = list(reason.research, `${at}.research`, [1, Infinity]);
    ids.forEach((id, place) => {
      if (
        typeof id !== "string" ||
        !(researchIds as readonly string[]).includes(id)
      )
        problem(
          `${at}.research[${place}]`,
          `unknown research id ${JSON.stringify(id)} (one of: ${oneOf(researchIds)})`,
        );
      else if (ids.indexOf(id) !== place)
        problem(`${at}.research[${place}]`, `"${id}" is listed twice`);
    });
  });

  const evidence = record(data.evidence, "evidence", ["theirs", "ours"]);
  if (evidence) {
    texts(evidence.theirs, "evidence.theirs", versusLimits.evidenceTheirs);
    texts(evidence.ours, "evidence.ours", versusLimits.evidenceOurs);
  }

  if (!isRecord(data.rows))
    problem("rows", "must be an object of row id to text");
  else {
    const ids = Object.keys(data.rows);
    if (ids.length === 0) problem("rows", "has no rows; the table needs one");
    for (const id of ids) {
      if (!(versusRowIds as readonly string[]).includes(id))
        problem(
          `rows.${id}`,
          `unknown row id (one of: ${oneOf(versusRowIds)})`,
        );
      const cell = text(data.rows[id], `rows.${id}`);
      if (cell !== undefined && wordCount(cell) > versusLimits.rowWords)
        problem(
          `rows.${id}`,
          `is ${wordCount(cell)} words; at most ${versusLimits.rowWords}`,
        );
    }
  }

  const fit = record(data.fit, "fit", ["them", "amp"]);
  if (fit) {
    texts(fit.them, "fit.them", [1, Infinity]);
    texts(fit.amp, "fit.amp", [1, Infinity]);
  }

  list(data.questions, "questions", versusLimits.questions).forEach(
    (item, index) => {
      const at = `questions[${index}]`;
      const entry = record(item, at, ["question", "answer"]);
      if (!entry) return;
      text(entry.question, `${at}.question`, { cited: false });
      text(entry.answer, `${at}.answer`);
    },
  );

  const urls = new Map<string, number>();
  const sources = list(data.sources, "sources", [1, Infinity]);
  sources.forEach((item, index) => {
    const at = `sources[${index}]`;
    const source = record(item, at, ["title", "url"]);
    if (!source) return;
    text(source.title, `${at}.title`, { cited: false });
    const url = text(source.url, `${at}.url`, { cited: false });
    if (url === undefined) return;
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      parsed = undefined;
    }
    if (!parsed || parsed.protocol !== "https:")
      return problem(`${at}.url`, `"${url}" must be an https address`);
    // One address, however it is written.
    const same = parsed.href.replace(/\/$/, "").toLowerCase();
    const first = urls.get(same);
    if (first !== undefined)
      problem(`${at}.url`, `repeats sources[${first}] (source ${first + 1})`);
    else urls.set(same, index);
  });

  for (const { path, text: words } of prose)
    for (const number of citations(words))
      if (number < 1 || number > sources.length)
        problem(
          path,
          `cites [${number}], and the page has ${sources.length} source${sources.length === 1 ? "" : "s"}`,
        );
  return problems;
}

/** The hub's catalog, from the pages: each page's slug, name, category and
 * line, by the hub's category order and then by name. `catalog.json` is
 * exactly this (`npm run versus:catalog` writes it). */
export function versusCatalogFrom(
  pages: readonly Pick<VersusPage, "slug" | "name" | "category" | "line">[],
): VersusCatalogEntry[] {
  return pages
    .map(({ slug, name, category, line }) => ({ slug, name, category, line }))
    .sort(
      (a, b) =>
        versusCategoryIds.indexOf(a.category) -
          versusCategoryIds.indexOf(b.category) ||
        a.name.localeCompare(b.name, "en", {
          sensitivity: "base",
          numeric: true,
        }) ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
    );
}

/** Whether `catalog.json` is what the pages give, and if not, how it
 * differs and the command that rewrites it. Only pages whose own four
 * catalog fields are sound take part: a broken page is reported as itself. */
function catalogProblems(files: VersusFiles): VersusProblem[] {
  const sound = files.pages
    .map((page) => page.data)
    .filter(
      (data): data is VersusPage =>
        isRecord(data) &&
        ["slug", "name", "line"].every(
          (key) => typeof data[key] === "string",
        ) &&
        (versusCategoryIds as readonly unknown[]).includes(data.category),
    );
  const expected = versusCatalogFrom(sound);
  if (JSON.stringify(files.catalog) === JSON.stringify(expected)) return [];
  const listed = new Map<string, unknown>(
    Array.isArray(files.catalog)
      ? files.catalog
          .filter(isRecord)
          .map((entry) => [String(entry.slug), entry] as const)
      : [],
  );
  const wanted = new Map(expected.map((entry) => [entry.slug, entry]));
  const differences = [
    ...expected
      .filter((entry) => !listed.has(entry.slug))
      .map((entry) => `"${entry.slug}" is missing`),
    ...[...listed.keys()]
      .filter((slug) => !wanted.has(slug))
      .map((slug) => `"${slug}" has no page`),
    ...expected
      .filter(
        (entry) =>
          listed.has(entry.slug) &&
          JSON.stringify(listed.get(entry.slug)) !== JSON.stringify(entry),
      )
      .map((entry) => `"${entry.slug}" differs from its page`),
  ];
  return [
    {
      file: "catalog.json",
      path: "",
      message: `is out of step with pages/ (${
        differences.length
          ? differences.slice(0, 8).join("; ") +
            (differences.length > 8
              ? `; and ${differences.length - 8} more`
              : "")
          : "the order differs"
      }): run \`${VERSUS_CATALOG_COMMAND}\``,
    },
  ];
}

/** Everything wrong with the pages and the catalog. Empty when all is well. */
export function validateVersus(files: VersusFiles): VersusProblem[] {
  return [
    ...files.pages.flatMap((page) => validateVersusPage(page.file, page.data)),
    ...catalogProblems(files),
  ];
}

/** One problem as a line: "pages/i-ready.json: reasons[2].title: must be …". */
export const versusProblemLine = (problem: VersusProblem) =>
  `${problem.file}: ${problem.path ? `${problem.path}: ` : ""}${problem.message}`;

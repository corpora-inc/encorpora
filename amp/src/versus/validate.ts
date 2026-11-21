/** The comparison content's rules, as one check: `npm run versus:check`
 * runs it over the files, and tests/versus.test.ts fails on anything it
 * finds. Pure: it takes parsed JSON, so it runs anywhere.
 *
 * Every problem names its file and the place in it, so a writer can go
 * straight there. */
import { researchPage } from "../research/report";
import { citations } from "./citations";
import { versusCategoryIds, versusRowIds } from "./types";

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

export const versusLimits = {
  /** A catalog line: one sentence, about 110 characters. */
  line: 120,
  description: [110, 160],
  benefit: 32,
  theirs: [1, 3],
  credit: [2, 4],
  reasons: [3, 6],
  questions: [2, 5],
} as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const researchIds = researchPage.components.map((component) => component.id);
const pageKeys = [
  "slug",
  "name",
  "maker",
  "category",
  "checked",
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

/** A real calendar day, "2026-11-21". */
function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Everything wrong with the catalog and the pages. Empty when all is well. */
export function validateVersus(files: VersusFiles): VersusProblem[] {
  const problems: VersusProblem[] = [];
  const report = (file: string) => (path: string, message: string) =>
    problems.push({ file, path, message });

  // The catalog.
  const inCatalog = new Map<string, { name: unknown; category: unknown }>();
  {
    const problem = report("catalog.json");
    if (!Array.isArray(files.catalog))
      problem("", "must be a list of { slug, name, category, line }");
    else
      files.catalog.forEach((entry: unknown, index) => {
        const at = `[${index}]`;
        if (!isRecord(entry)) return problem(at, "must be an object");
        for (const key of Object.keys(entry))
          if (!["slug", "name", "category", "line"].includes(key))
            problem(`${at}.${key}`, "is not a catalog field");
        const text = (key: string) => {
          const value = entry[key];
          if (typeof value !== "string" || !value.trim()) {
            problem(`${at}.${key}`, "must be a string with words in it");
            return;
          }
          if (value !== value.trim())
            problem(`${at}.${key}`, "starts or ends with a space");
          return value;
        };
        const slug = text("slug");
        text("name");
        const category = text("category");
        const line = text("line");
        if (slug !== undefined) {
          if (!slugPattern.test(slug))
            problem(
              `${at}.slug`,
              `"${slug}" must be lower-case words joined by hyphens`,
            );
          if (inCatalog.has(slug))
            problem(`${at}.slug`, `"${slug}" is listed twice`);
          inCatalog.set(slug, { name: entry.name, category: entry.category });
        }
        if (
          category !== undefined &&
          !(versusCategoryIds as readonly string[]).includes(category)
        )
          problem(
            `${at}.category`,
            `unknown category "${category}" (one of: ${oneOf(versusCategoryIds)})`,
          );
        if (line !== undefined) {
          if (line.length > versusLimits.line)
            problem(
              `${at}.line`,
              `is ${line.length} characters; at most ${versusLimits.line}`,
            );
          if (citations(line).length)
            problem(
              `${at}.line`,
              "carries a citation marker; the hub has no sources",
            );
        }
      });
  }

  // The pages.
  const seen = new Set<string>();
  for (const { file: name, data } of files.pages) {
    const file = `pages/${name}`;
    const problem = report(file);
    const expected = name.replace(/\.json$/, "");
    seen.add(expected);
    if (!slugPattern.test(expected))
      problem("", `the file's name must be lower-case words joined by hyphens`);
    if (!isRecord(data)) {
      problem("", "must be an object");
      continue;
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
        if (!keys.includes(key))
          problem(`${path}.${key}`, "is not a field here");
      return value;
    };

    const slug = text(data.slug, "slug", { cited: false });
    if (slug !== undefined && slug !== expected)
      problem("slug", `"${slug}" must match the file's name, "${expected}"`);
    const pageName = text(data.name, "name", { cited: false });
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
    const listed = inCatalog.get(expected);
    if (!listed) problem("", `"${expected}" is missing from catalog.json`);
    else {
      if (pageName !== undefined && listed.name !== pageName)
        problem(
          "name",
          `"${pageName}" differs from the catalog's "${String(listed.name)}"`,
        );
      if (category !== undefined && listed.category !== category)
        problem(
          "category",
          `"${category}" differs from the catalog's "${String(listed.category)}"`,
        );
    }
    const checked = text(data.checked, "checked", { cited: false });
    if (checked !== undefined && !isDay(checked))
      problem("checked", `"${checked}" must be a day like 2026-11-21`);
    if ("benefit" in data) {
      const benefit = text(data.benefit, "benefit", { cited: false });
      if (benefit !== undefined && benefit.length > versusLimits.benefit)
        problem(
          "benefit",
          `is ${benefit.length} characters; at most ${versusLimits.benefit}`,
        );
    }
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

    list(data.reasons, "reasons", versusLimits.reasons).forEach(
      (item, index) => {
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
      },
    );

    const evidence = record(data.evidence, "evidence", ["theirs", "ours"]);
    if (evidence) {
      texts(evidence.theirs, "evidence.theirs", [1, Infinity]);
      texts(evidence.ours, "evidence.ours", [1, Infinity]);
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
        text(data.rows[id], `rows.${id}`);
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
  }

  {
    const problem = report("catalog.json");
    for (const slug of inCatalog.keys())
      if (!seen.has(slug))
        problem("", `lists "${slug}", and pages/${slug}.json does not exist`);
  }
  return problems;
}

/** One problem as a line: "pages/i-ready.json: reasons[2].title: must be …". */
export const versusProblemLine = (problem: VersusProblem) =>
  `${problem.file}: ${problem.path ? `${problem.path}: ` : ""}${problem.message}`;

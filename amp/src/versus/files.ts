/** The comparison content read from disk, for the build scripts, the
 * validator's command and the tests (Node only; the app loads the same
 * files through `pages.ts`). */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { VersusCatalogEntry, VersusPage } from "./types";
import {
  validateVersus,
  validateVersusPage,
  versusCatalogFrom,
  versusProblemLine,
  type VersusFiles,
  type VersusProblem,
} from "./validate";

const here = new URL("./", import.meta.url);

/** One file as JSON, or the problem that it isn't. */
function parse(
  file: string,
  directory: URL,
): { data: unknown; problem?: undefined } | { problem: VersusProblem } {
  try {
    return { data: JSON.parse(readFileSync(new URL(file, directory), "utf8")) };
  } catch (error) {
    return {
      problem: {
        file,
        path: "",
        message: `is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

/** Every page's file as parsed JSON, and each file that is not JSON at all. */
function readPages(directory: URL) {
  const problems: VersusProblem[] = [];
  const pages: { file: string; data: unknown }[] = [];
  for (const file of readdirSync(fileURLToPath(new URL("pages/", directory)))
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const read = parse(`pages/${file}`, directory);
    if (read.problem) problems.push(read.problem);
    else pages.push({ file, data: read.data });
  }
  return { pages, problems };
}

/** Everything wrong with the content on disk: every page, and whether
 * `catalog.json` is what the pages give. */
export function checkVersusFiles(directory: URL = here): VersusProblem[] {
  const { pages, problems } = readPages(directory);
  const catalog = parse("catalog.json", directory);
  if (catalog.problem)
    return [
      ...problems,
      catalog.problem,
      ...pages.flatMap((page) => validateVersusPage(page.file, page.data)),
    ];
  return [
    ...problems,
    ...validateVersus({ catalog: catalog.data, pages } satisfies VersusFiles),
  ];
}

/** Everything wrong with one page's file, by its slug: nothing about the
 * catalog or any other page, so a writer can check a file while others are
 * still being written. */
export function checkVersusPage(
  slug: string,
  directory: URL = here,
): VersusProblem[] {
  const file = `pages/${slug}.json`;
  if (!/^[a-z0-9-]+$/.test(slug) || !existsSync(new URL(file, directory)))
    return [{ file, path: "", message: "does not exist" }];
  const read = parse(file, directory);
  return read.problem
    ? [read.problem]
    : validateVersusPage(`${slug}.json`, read.data);
}

/** How many page files there are. */
export function countVersusPages(directory: URL = here) {
  return readPages(directory).pages.length;
}

/** Rewrite `catalog.json` from the pages (`npm run versus:catalog`). The
 * pages must be valid first; returns the catalog written. */
export function writeVersusCatalog(
  directory: URL = here,
): VersusCatalogEntry[] {
  const { pages, problems } = readPages(directory);
  const found = [
    ...problems,
    ...pages.flatMap((page) => validateVersusPage(page.file, page.data)),
  ];
  if (found.length)
    throw new Error(
      `Fix the pages first (npm run versus:check):\n${found.map(versusProblemLine).join("\n")}`,
    );
  const catalog = versusCatalogFrom(
    pages.map((page) => page.data as VersusPage),
  );
  writeFileSync(
    new URL("catalog.json", directory),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  return catalog;
}

/** The catalog and every page, checked: a build never publishes content the
 * validator rejects, or a catalog out of step with its pages. Pages come in
 * the catalog's order. */
export function readVersus(directory: URL = here): {
  catalog: VersusCatalogEntry[];
  pages: VersusPage[];
} {
  const problems = checkVersusFiles(directory);
  if (problems.length)
    throw new Error(
      `The comparison content has problems (npm run versus:check):\n${problems.map(versusProblemLine).join("\n")}`,
    );
  const catalog = (parse("catalog.json", directory) as { data: unknown })
    .data as VersusCatalogEntry[];
  const bySlug = new Map(
    readPages(directory).pages.map((page) => [
      (page.data as VersusPage).slug,
      page.data as VersusPage,
    ]),
  );
  return { catalog, pages: catalog.map((entry) => bySlug.get(entry.slug)!) };
}

/** The comparison content read from disk, for the build scripts, the
 * validator's command and the tests (Node only; the app loads the same
 * files through `pages.ts`). */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { VersusCatalogEntry, VersusPage } from "./types";
import {
  validateVersus,
  versusProblemLine,
  type VersusFiles,
  type VersusProblem,
} from "./validate";

const here = new URL("./", import.meta.url);

/** Every file as parsed JSON, and each file that is not JSON at all. */
export function readVersusFiles(directory: URL = here): {
  files: VersusFiles;
  unreadable: VersusProblem[];
} {
  const unreadable: VersusProblem[] = [];
  const parse = (file: string): unknown => {
    try {
      return JSON.parse(readFileSync(new URL(file, directory), "utf8"));
    } catch (error) {
      unreadable.push({
        file,
        path: "",
        message: `is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      return undefined;
    }
  };
  const catalog = parse("catalog.json");
  const pages = readdirSync(fileURLToPath(new URL("pages/", directory)))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => ({ file, data: parse(`pages/${file}`) }))
    .filter((page) => page.data !== undefined);
  return { files: { catalog, pages }, unreadable };
}

/** Everything wrong with the content on disk. */
export function checkVersusFiles(directory: URL = here): VersusProblem[] {
  const { files, unreadable } = readVersusFiles(directory);
  return [
    ...unreadable,
    // An unreadable catalog is already reported once.
    ...(files.catalog === undefined ? [] : validateVersus(files)),
  ];
}

/** The catalog and every page, checked: a build never publishes content the
 * validator rejects. Pages come in the catalog's order. */
export function readVersus(directory: URL = here): {
  catalog: VersusCatalogEntry[];
  pages: VersusPage[];
} {
  const problems = checkVersusFiles(directory);
  if (problems.length)
    throw new Error(
      `The comparison content has problems (npm run versus:check):\n${problems.map(versusProblemLine).join("\n")}`,
    );
  const { files } = readVersusFiles(directory);
  const catalog = files.catalog as VersusCatalogEntry[];
  const bySlug = new Map(
    files.pages.map((page) => [
      (page.data as VersusPage).slug,
      page.data as VersusPage,
    ]),
  );
  return { catalog, pages: catalog.map((entry) => bySlug.get(entry.slug)!) };
}

/**
 * Check the comparison content against its rules (src/versus/validate.ts):
 * the schema, slugs, categories, table rows, research ids, citations and
 * sources. Prints each problem with its file and place, and fails if there
 * is one.
 *
 *     npm run versus:check            every page, and that catalog.json is
 *                                     what the pages give
 *     npm run versus:check -- ixl     src/versus/pages/ixl.json alone:
 *                                     nothing about the catalog or any
 *                                     other page
 */
import {
  checkVersusFiles,
  checkVersusPage,
  countVersusPages,
} from "../src/versus/files";

const slugs = process.argv.slice(2).map((name) =>
  // A slug, or the file's own name or path.
  name.replace(/^.*\//, "").replace(/\.json$/, ""),
);
const problems = slugs.length
  ? slugs.flatMap((slug) => checkVersusPage(slug))
  : checkVersusFiles();
if (problems.length === 0) {
  const pages = countVersusPages();
  console.log(
    slugs.length
      ? `Valid: ${slugs.map((slug) => `src/versus/pages/${slug}.json`).join(", ")}.`
      : `Comparison content is valid: ${pages} page${pages === 1 ? "" : "s"}, and catalog.json matches them.`,
  );
} else {
  const byFile = new Map<string, string[]>();
  for (const problem of problems)
    byFile.set(problem.file, [
      ...(byFile.get(problem.file) ?? []),
      problem.path ? `${problem.path}: ${problem.message}` : problem.message,
    ]);
  for (const [file, lines] of [...byFile].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.error(`\nsrc/versus/${file}`);
    for (const line of lines) console.error(`  ${line}`);
  }
  console.error(
    `\n${problems.length} problem${problems.length === 1 ? "" : "s"} in ${byFile.size} file${byFile.size === 1 ? "" : "s"}.`,
  );
  process.exit(1);
}

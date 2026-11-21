/**
 * Check the comparison content (src/versus/catalog.json and pages/*.json)
 * against its rules (src/versus/validate.ts): the schema, slugs and the
 * catalog, categories, table rows, research ids, citations and sources.
 * Prints each problem with its file and place, and fails if there is one.
 *
 *     npm run versus:check
 */
import { checkVersusFiles, readVersusFiles } from "../src/versus/files";

const problems = checkVersusFiles();
const { files } = readVersusFiles();
if (problems.length === 0) {
  console.log(
    `Comparison content is valid: ${files.pages.length} page${files.pages.length === 1 ? "" : "s"} and the catalog.`,
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

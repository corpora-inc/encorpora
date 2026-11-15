/**
 * No "my" in product chrome (founder, Q-204): every string, template part
 * and JSX text in src/web that says "my …" fails, except words a person says
 * or posts as themselves, listed exactly below. Chrome says what a thing is,
 * never "My …". Part of `npm run lint:navigation`; its scanner is unit-tested
 * on a fixture (src/web/ui/__tests__/no-my-chrome.test.ts).
 *
 *   npx tsx scripts/check-no-my-chrome.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Words a person says or posts as themselves: `file: the exact text`. */
const USER_CONTENT = new Set([
  // The share card a learner posts in their own voice.
  "features/pathways/share-image.ts: My math",
  "features/pathways/share-image.ts: An estimate from my practice so far.",
  // The statement a teacher signs, in the first person.
  "features/school/pilots/Authorization.tsx: My school authorizes me to use AMP with this class, and I accept the",
]);

/** "my" followed by a word, anywhere, as a word of its own. */
const MY = /(^|[^\p{L}\p{N}_-])my\s+\S/iu;

/** The source files a reader can see words from. */
export function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" || entry.name === "dev"
        ? []
        : sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [path]
      : [];
  });
}

/** Every string, template part and JSX text in `text` that says "my …". */
export function myStrings(file: string, text = readFileSync(file, "utf8")) {
  // A cheap first pass: most files never say it at all.
  if (!/\bmy\s/i.test(text)) return [];
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const words =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
        ? node.text
        : ts.isJsxText(node)
          ? node.getText()
          : null;
    // Imports and module names are not words anyone reads.
    if (
      words !== null &&
      MY.test(words) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExternalModuleReference(node.parent)
    )
      found.push(words.trim().replace(/\s+/g, " "));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every offending text under `web`, as `file: text`. */
export function offenders(web: string) {
  return sources(web).flatMap((file) =>
    myStrings(file)
      .map((words) => `${relative(web, file)}: ${words}`)
      .filter((entry) => !USER_CONTENT.has(entry)),
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const web = fileURLToPath(new URL("../src/web", import.meta.url));
  const found = offenders(web);
  if (found.length) {
    console.error('Product chrome never says "my" (Q-204):');
    for (const line of found) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`no "my": ${sources(web).length} file(s) checked.`);
}

// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";

const web = fileURLToPath(new URL("../..", import.meta.url));

function sources(dir: string): string[] {
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

/** Words a person says or posts as themselves, never product chrome:
 * `file: the exact text`. */
const USER_CONTENT = new Set([
  // The share card a learner posts in their own voice.
  "features/pathways/share-image.ts: My math",
  "features/pathways/share-image.ts: An estimate from my practice so far.",
]);
/** The statement a teacher signs, in the first person: one exact
 * sentence, whatever follows it in the same text. */
const SIGNED =
  "features/school/pilots/Authorization.tsx: My school authorizes me to use AMP with this class, and I accept the";

/** Every string, template part and JSX text with "my" in it, anywhere:
 * chrome says what a thing is, never "My …" or "… my …" (founder, Q-204). */
function startsWithMy(file: string) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const text =
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
      text !== null &&
      /(^|[^\p{L}\p{N}_-])my\s+\S/iu.test(text) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExternalModuleReference(node.parent)
    )
      found.push(text.trim().replace(/\s+/g, " "));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("no product chrome in src/web says “my”", () => {
  const files = sources(web);
  expect(files.length).toBeGreaterThan(100);
  const offenders = files.flatMap((file) =>
    startsWithMy(file)
      .map((text) => `${relative(web, file)}: ${text}`)
      .filter((entry) => !USER_CONTENT.has(entry) && entry !== SIGNED),
  );
  expect(offenders).toEqual([]);
});

test("the check finds “My” in strings and JSX text, and only there", () => {
  const sample = join(web, "ui/__tests__/fixtures/my-chrome.tsx");
  expect(startsWithMy(sample)).toEqual([
    "My practice",
    "my levels",
    "Keep my settings",
    "for my child",
    "My class",
  ]);
});

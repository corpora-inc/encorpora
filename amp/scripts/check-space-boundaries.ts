/**
 * The space rule (docs/architecture/spaces.md, "One set of widgets"): shared
 * widgets are space-neutral. They receive data, labels and actions from the
 * space screen that composes them, so a family never reads "student" and a
 * class never reads "your children" because a widget guessed.
 *
 * Read from the TypeScript syntax tree (never line by line), a shared
 * module fails when it:
 *   - compares or switches on an org's kind or a space (`org.kind ===
 *     "family"`, `org["kind"]`, `switch (org.kind) { case "school": … }`,
 *     `space !== "me"`), however the expression is split across lines;
 *   - takes or passes a `family` flag, or reads the account's places
 *     (`familyClass`, `secondParentOf`, `staffOf`) or the shell's place
 *     heuristics (`teachingHere`, `isFamily`);
 *   - chooses its own words (`spaceWords(…)`) or space (`spaceOfPath(…)`);
 *   - imports, re-exports or dynamically imports, directly or through any
 *     module it imports, a composition layer: the space resolver and its
 *     hooks, the shell's navigation, onboarding's place logic or the
 *     second-parent API. `SpaceWords` may be imported as a type, so words
 *     arrive as props.
 * Each exception below is named with its reason; anything new fails.
 *
 *   npx tsx scripts/check-space-boundaries.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const ROOT = new URL("../src/web/", import.meta.url).pathname;

/** The shared modules (code audit §5): the ui kit, and each widget that
 * Family, Classroom, School and Me compose. */
export const SHARED = [
  /^ui\//,
  /^PracticeWorkspace\.tsx$/,
  /^features\/school\/classes\/ClassMap\.tsx$/,
  /^features\/school\/classes\/ProgressRecord\.tsx$/,
  /^features\/school\/classes\/GradeCurve\.tsx$/,
  /^features\/school\/classes\/grade-parts\.tsx$/,
  /^features\/school\/classes\/EvidenceSheet\.tsx$/,
  /^features\/school\/classes\/today\/Feed\.tsx$/,
  /^features\/school\/classes\/today\/WeekFacts\.tsx$/,
  /^features\/school\/classes\/today\/SignInCode\.tsx$/,
  /^features\/school\/join\/JoinClass\.tsx$/,
  /^features\/school\/join\/CodeTiles\.tsx$/,
  /^features\/pathways\/Graph\.tsx$/,
  /^features\/workbooks\/WorkbookList\.tsx$/,
  /^features\/continue\/AllowancePause\.tsx$/,
];

/** Composition layers a shared module never reaches, by path from src/web. */
export const FORBIDDEN = [
  /^features\/spaces\/(?!words\.ts$)/,
  /^features\/navigation\//,
  /^features\/onboarding\/guard\.ts$/,
  /^features\/second-parent\/api\.ts$/,
];
/** `features/spaces/words.ts`: its type only. */
const WORDS = "features/spaces/words.ts";

/** Named exceptions: importer → the composition module it may import, why. */
export const ALLOWED: Record<string, [string, string][]> = {
  "ui/ScreenTitle.tsx": [
    [
      "features/navigation/shell-frame.ts",
      "whether the open tab already names the screen: read from the address, no place, no space",
    ],
  ],
  "ui/PageFrame.tsx": [
    [
      "features/navigation/NavigationDrawer.tsx",
      "the frame of screens outside the app frame: a shell, which carries the drawer, not a widget",
    ],
  ],
};

const KINDS = new Set(["family", "school", "district", "network"]);
const PLACE_NAMES = new Set([
  "familyClass",
  "secondParentOf",
  "staffOf",
  "teachingHere",
  "isFamily",
  "familyOrg",
]);
const CHOOSERS = new Set(["spaceWords", "spaceOfPath", "resolveSpace"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const parse = (file: string, source: string) =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

/** `kind` read from anything: `a.kind`, `a?.kind`, `a["kind"]`, `kind`. */
function readsKind(node: ts.Node): string | null {
  const expr = ts.isParenthesizedExpression(node) ? node.expression : node;
  if (ts.isPropertyAccessExpression(expr) && expr.name.text === "kind")
    return expr.expression.getText();
  if (
    ts.isElementAccessExpression(expr) &&
    ts.isStringLiteralLike(expr.argumentExpression) &&
    expr.argumentExpression.text === "kind"
  )
    return expr.expression.getText();
  if (ts.isIdentifier(expr) && expr.text === "kind") return "";
  return null;
}
const readsSpace = (node: ts.Node) =>
  (ts.isIdentifier(node) && node.text === "space") ||
  (ts.isPropertyAccessExpression(node) && node.name.text === "space") ||
  (ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === "space");
/** A failure's kind (`error.kind === "network"`) is not an org's: only for
 * "network", the one word a failure's kind shares with an org's. */
const failure = (owner: string, value: string | null) =>
  value === "network" && /error|failure|problem/i.test(owner);
const literal = (node: ts.Node) =>
  ts.isStringLiteralLike(node) ? node.text : null;

/** Every branch on a space in one module's source. */
export function findings(
  file: string,
  source: string,
  /** A helper a widget reaches: only its decisions (comparisons, switches,
   * lookups, choosing words) are its widget's; data plumbing may name the
   * account's places. */
  helper = false,
): string[] {
  const found: string[] = [];
  const tree = parse(file, source);
  const report = (node: ts.Node, why: string) => {
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart());
    found.push(
      `${file}:${line + 1}: ${why}: ${node.getText().split("\n")[0]!.trim()}`,
    );
  };
  // Names bound to a kind or a space: `const k = org.kind`,
  // `const { kind: placeKind } = org`, `const { space } = props`.
  const aliases = new Set<string>();
  // Tables keyed by an org's kind or a space: `{ family: …, school: … }`.
  const keyedByKind = (node: ts.Node | undefined) =>
    !!node &&
    ts.isObjectLiteralExpression(
      ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
        ? node.expression
        : node,
    ) &&
    (
      (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
        ? node.expression
        : node) as ts.ObjectLiteralExpression
    ).properties.some(
      (property) =>
        !!property.name &&
        KINDS.has(property.name.getText().replace(/["']/g, "")),
    );
  const tables = new Set<string>();
  const collect = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      keyedByKind(node.initializer)
    )
      tables.add(node.name.text);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (readsKind(node.initializer) !== null || readsSpace(node.initializer))
    )
      aliases.add(node.name.text);
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      ["kind", "space"].includes(
        (node.propertyName && ts.isIdentifier(node.propertyName)
          ? node.propertyName.text
          : node.name.text) ?? "",
      )
    )
      aliases.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const discriminates = (side: ts.Node) =>
    readsKind(side) !== null ||
    readsSpace(side) ||
    (ts.isIdentifier(side) && aliases.has(side.text));
  const compares = (side: ts.Node, other: ts.Node) => {
    const value = literal(other);
    if (value === null || !discriminates(side)) return false;
    const owner = readsKind(side) ?? "";
    if (readsSpace(side)) return true;
    return KINDS.has(value) && !failure(owner, value);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind) &&
      (compares(node.left, node.right) || compares(node.right, node.left))
    )
      report(node, "branches on an org's kind or a space");
    if (ts.isSwitchStatement(node)) {
      const owner = readsKind(node.expression) ?? "";
      const cases = node.caseBlock.clauses
        .filter(ts.isCaseClause)
        .map((clause) => literal(clause.expression));
      if (
        (discriminates(node.expression) &&
          cases.some(
            (value) => value && KINDS.has(value) && !failure(owner, value),
          )) ||
        readsSpace(node.expression)
      )
        report(node.expression, "switches on an org's kind or a space");
    }
    // A table looked up by kind or space: `{ family: …, school: … }[org.kind]`.
    if (
      ts.isElementAccessExpression(node) &&
      discriminates(node.argumentExpression) &&
      (keyedByKind(
        ts.isParenthesizedExpression(node.expression)
          ? node.expression.expression
          : node.expression,
      ) ||
        (ts.isIdentifier(node.expression) && tables.has(node.expression.text)))
    )
      report(node, "looks up by an org's kind or a space");
    if (!helper && ts.isIdentifier(node) && PLACE_NAMES.has(node.text))
      report(node, "reads the account's places or guesses the place");
    if (
      !helper &&
      (ts.isParameter(node) ||
        ts.isPropertySignature(node) ||
        ts.isBindingElement(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === "family"
    )
      report(node, "takes a family flag");
    if (!helper && ts.isJsxAttribute(node) && node.name.getText() === "family")
      report(node, "passes a family flag");
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CHOOSERS.has(node.expression.text)
    )
      report(node, "chooses its own space or words");
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** What one module imports, re-exports or loads: specifier, and whether
 * only types come from it. */
function imports(file: string, source: string) {
  const out: { specifier: string; typeOnly: boolean; node: string }[] = [];
  const tree = parse(file, source);
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      let typeOnly = false;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        typeOnly =
          !!clause &&
          (clause.isTypeOnly ||
            (!clause.name &&
              !!clause.namedBindings &&
              ts.isNamedImports(clause.namedBindings) &&
              clause.namedBindings.elements.length > 0 &&
              clause.namedBindings.elements.every((item) => item.isTypeOnly)));
      } else typeOnly = node.isTypeOnly;
      out.push({
        specifier: node.moduleSpecifier.text,
        typeOnly,
        node: node.getText().replace(/\s+/g, " "),
      });
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      out.push({
        specifier: node.arguments[0].text,
        typeOnly: false,
        node: node.getText(),
      });
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return out;
}

/** A relative specifier as a module path from the root, or null. */
function resolveModule(root: string, from: string, specifier: string) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(join(root, from)), specifier).replace(
    /\.js$/,
    "",
  );
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ])
    if (existsSync(candidate) && statSync(candidate).isFile())
      return relative(root, candidate);
  return null;
}

type Reader = (path: string) => string;

/** Every composition module a shared module reaches through its imports. */
export function reaches(
  file: string,
  root = ROOT,
  read: Reader = (path) => readFileSync(join(root, path), "utf8"),
): string[] {
  const found: string[] = [];
  const seen = new Set<string>([file]);
  const queue: [string, string[]][] = [[file, [file]]];
  const allowed = (from: string, to: string) =>
    (ALLOWED[from] ?? []).some(([target]) => target === to);
  while (queue.length) {
    const [current, chain] = queue.shift()!;
    for (const entry of imports(current, read(current))) {
      const target = resolveModule(root, current, entry.specifier);
      if (!target) continue;
      // A type has no runtime: only the words rule looks at one.
      if (entry.typeOnly && target !== WORDS) continue;
      if (target === WORDS) {
        if (!entry.typeOnly)
          found.push(
            `${chain.join(" → ")}: takes words as a value (only the SpaceWords type): ${entry.node}`,
          );
        continue;
      }
      if (FORBIDDEN.some((pattern) => pattern.test(target))) {
        if (!allowed(current, target))
          found.push(
            `${[...chain, target].join(" → ")}: reaches a composition layer: ${entry.node}`,
          );
        continue;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      // Only the web client's own modules: the server's contracts and
      // policies decide on the server, where spaces don't exist.
      if (target.startsWith("..")) continue;
      // A decision moved into a helper is still the widget's: every client
      // module a shared one reaches is read for its decisions.
      for (const line of findings(target, read(target), true))
        found.push(`${[...chain, target].join(" → ")}: ${line}`);
      queue.push([target, [...chain, target]]);
    }
  }
  return found;
}

export function check(root = ROOT) {
  const all: string[] = [];
  let checked = 0;
  for (const path of files(root)) {
    const file = relative(root, path);
    if (!SHARED.some((pattern) => pattern.test(file))) continue;
    checked++;
    all.push(...findings(file, readFileSync(path, "utf8")));
    all.push(...reaches(file, root));
  }
  return { checked, found: [...new Set(all)] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { checked, found } = check();
  if (found.length) {
    console.error(
      "A shared widget takes its words, data and actions as props; the space " +
        "screen that composes it decides them (docs/architecture/spaces.md).",
    );
    for (const line of found) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`spaces: ${checked} shared module(s), no space branches.`);
}

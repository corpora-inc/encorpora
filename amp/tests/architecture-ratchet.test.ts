/**
 * Architecture ratchet (amp/AGENTS.md, "Frontend architecture"). An audit on
 * 2026-11-16 found redirect chains, query-string handoffs, effects that
 * navigate and errors swallowed in silence across src/web. This test counts
 * each anti-pattern with the TypeScript compiler API and holds every count to
 * tests/architecture-ratchet.baseline.json:
 *
 * - A count above its baseline fails: remove the new instance (the failure
 *   names the files that grew).
 * - A count below its baseline fails too, until the baseline is lowered, so
 *   the baseline only ever falls. Lower it with
 *     ARCHITECTURE_RATCHET=update npx tsx --test tests/architecture-ratchet.test.ts
 *   which refuses to write while any count is above its baseline.
 *
 * What counts, per source file under src/web (tests excluded):
 *
 * - redirects: calls to `redirect(…)` (router redirects).
 * - validateSearch: route options with `validateSearch`.
 * - searchHandoffs: a non-empty `search` handed to a navigation: a `search:`
 *   property of an object that also names `to`, or of an object passed
 *   straight to navigate/redirect/buildLocation, and every JSX `search={…}`.
 *   A search made only of a third party's return value (QUERY_EXCEPTIONS) is
 *   not a handoff.
 * - navigatingEffects: useEffect/useLayoutEffect callbacks that navigate:
 *   navigate() (or a name bound to useNavigate()), `x.navigate(…)`,
 *   `history.push|replace|back|forward|go|pushState|replaceState(…)`,
 *   `location.assign|replace(…)`, or an assignment to `location`/`location.href`.
 * - renderNavigate: `<Navigate …>` elements (navigation during render).
 * - silentCatches: a `.catch(fn)` callback or a `catch {}` block that neither
 *   throws, rejects nor logs. Logging is a console.* call, or a call to a
 *   function named log…/report…/capture… or …Failure/…Failed; the
 *   sanctioned helpers in lib/report-error.ts (`reportError`, `reported(…)`,
 *   `ifNotFound(…)`, `jsonOrNull`) and `useErrorToast().report` count as
 *   handling. Zod's `.catch(fallback)` on a schema is not a promise and never
 *   counts.
 * - sessionProps: JSX attributes `session={…}` (session drilled through props;
 *   read it with `useSession()` from lib/session.ts).
 * - sessionReads: `useQuery(sessionOptions)` or `useSuspenseQuery(…)` outside
 *   lib/session.ts (read it with `useSession()` / `useSessionOrNull()`).
 * - inlineQueryKeys: a `queryKey:` spelled as an array literal outside
 *   lib/keys.ts (build it with `qk`).
 * - nativeControls: raw `<select>` and `<input>` elements outside ui/.
 *
 * Page-local container widths are tests/page-layout.test.ts's job.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WEB = fileURLToPath(new URL("../src/web/", import.meta.url));
const BASELINE = fileURLToPath(
  new URL("./architecture-ratchet.baseline.json", import.meta.url),
);
const UPDATE =
  "ARCHITECTURE_RATCHET=update npx tsx --test tests/architecture-ratchet.test.ts";

/** Query keys a third party puts on its return URL, read once and resolved:
 * the one exception to "no query strings carry app state". */
const QUERY_EXCEPTIONS: Record<string, string> = {
  session_id:
    "Stripe Checkout's return value ({CHECKOUT_SESSION_ID}), read once and resolved",
};

export const CATEGORIES = [
  "redirects",
  "validateSearch",
  "searchHandoffs",
  "navigatingEffects",
  "renderNavigate",
  "silentCatches",
  "sessionProps",
  "sessionReads",
  "inlineQueryKeys",
  "nativeControls",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Finding = { category: Category; file: string; line: number };

const EFFECTS = new Set(["useEffect", "useLayoutEffect"]);
const NAVIGATING_CALLS = new Set(["navigate", "redirect", "buildLocation"]);
const HISTORY_METHODS = new Set([
  "push",
  "replace",
  "back",
  "forward",
  "go",
  "pushState",
  "replaceState",
]);
const LOGGER = /^(log|report|capture)|(Failure|Failed)$/;
/** lib/report-error.ts helpers that rethrow what they don't handle. */
const RETHROWS = new Set(["ifNotFound"]);
/** Where the session is read and keys are spelled: the only places. */
const SESSION_HOOKS = "lib/session.ts";
const KEY_FACTORY = "lib/keys.ts";

/** The name a call is made by: `f(…)` → f, `a.b.f(…)` → f. */
function calleeName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

/** `history`, `window.history`, `router.history` and the like. */
function endsWith(expression: ts.Expression, name: string) {
  return calleeName(expression) === name;
}

/** The identifier a member/call chain starts from: `z.string().catch` → z. */
function chainRoot(expression: ts.Expression): ts.Expression {
  let at = expression;
  for (;;) {
    if (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at))
      at = at.expression;
    else if (ts.isCallExpression(at)) at = at.expression;
    else if (ts.isParenthesizedExpression(at) || ts.isNonNullExpression(at))
      at = at.expression;
    else return at;
  }
}

function propertyName(property: ts.ObjectLiteralElementLike) {
  const name = property.name;
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/** Every string key any object literal inside `node` declares. */
function keysWithin(node: ts.Node) {
  const keys: string[] = [];
  const visit = (at: ts.Node) => {
    if (ts.isObjectLiteralExpression(at))
      for (const property of at.properties) {
        const name = propertyName(property);
        if (name) keys.push(name);
      }
    ts.forEachChild(at, visit);
  };
  visit(node);
  return keys;
}

const onlyExceptions = (keys: string[]) =>
  keys.length > 0 && keys.every((key) => key in QUERY_EXCEPTIONS);

function unwrap(expression: ts.Expression): ts.Expression {
  let at = expression;
  while (
    ts.isParenthesizedExpression(at) ||
    ts.isAsExpression(at) ||
    ts.isSatisfiesExpression(at) ||
    ts.isNonNullExpression(at)
  )
    at = at.expression;
  return at;
}

/** `{}`, `undefined` and `void 0` clear the query string; they carry nothing. */
function carriesNothing(value: ts.Expression) {
  const at = unwrap(value);
  return (
    (ts.isObjectLiteralExpression(at) && at.properties.length === 0) ||
    (ts.isIdentifier(at) && at.text === "undefined") ||
    ts.isVoidExpression(at)
  );
}

function carriesOnlyExceptions(value: ts.Expression) {
  const at = unwrap(value);
  return ts.isObjectLiteralExpression(at) && onlyExceptions(keysWithin(at));
}

/** Whether a catch handler's body throws, rejects or logs. */
function handles(body: ts.Node) {
  let handled = false;
  const visit = (at: ts.Node) => {
    if (handled) return;
    if (ts.isThrowStatement(at)) handled = true;
    else if (ts.isCallExpression(at)) {
      const name = calleeName(at.expression);
      if (
        (ts.isPropertyAccessExpression(at.expression) &&
          ts.isIdentifier(at.expression.expression) &&
          at.expression.expression.text === "console") ||
        (name !== undefined && (LOGGER.test(name) || RETHROWS.has(name))) ||
        (name === "reject" &&
          ts.isPropertyAccessExpression(at.expression) &&
          endsWith(at.expression.expression, "Promise"))
      )
        handled = true;
    }
    ts.forEachChild(at, visit);
  };
  visit(body);
  return handled;
}

/** `sessionOptions`, or an options object spread from it. */
function readsSession(argument: ts.Expression) {
  const at = unwrap(argument);
  if (ts.isIdentifier(at)) return at.text === "sessionOptions";
  return (
    ts.isObjectLiteralExpression(at) &&
    at.properties.some(
      (property) =>
        ts.isSpreadAssignment(property) &&
        ts.isIdentifier(property.expression) &&
        property.expression.text === "sessionOptions",
    )
  );
}

/** Every anti-pattern in one source file. */
export function scan(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: Finding[] = [];
  const add = (category: Category, node: ts.Node) =>
    findings.push({
      category,
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    });
  const inUi = file.startsWith("ui/");

  // Names bound to useNavigate(): `const go = useNavigate()`.
  const navigators = new Set(["navigate"]);
  const collect = (at: ts.Node) => {
    if (
      ts.isVariableDeclaration(at) &&
      ts.isIdentifier(at.name) &&
      at.initializer &&
      ts.isCallExpression(unwrap(at.initializer)) &&
      calleeName((unwrap(at.initializer) as ts.CallExpression).expression) ===
        "useNavigate"
    )
      navigators.add(at.name.text);
    ts.forEachChild(at, collect);
  };
  collect(sf);

  /** Whether code inside an effect navigates. */
  const navigates = (body: ts.Node) => {
    let found = false;
    const visit = (at: ts.Node) => {
      if (found) return;
      if (ts.isCallExpression(at)) {
        const callee = at.expression;
        if (ts.isIdentifier(callee) && navigators.has(callee.text))
          found = true;
        else if (ts.isPropertyAccessExpression(callee)) {
          const method = callee.name.text;
          const target = callee.expression;
          if (
            method === "navigate" ||
            (HISTORY_METHODS.has(method) && endsWith(target, "history")) ||
            ((method === "assign" || method === "replace") &&
              endsWith(target, "location"))
          )
            found = true;
        }
      } else if (
        ts.isBinaryExpression(at) &&
        at.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const left = unwrap(at.left);
        if (
          endsWith(left, "location") ||
          (ts.isPropertyAccessExpression(left) &&
            left.name.text === "href" &&
            endsWith(left.expression, "location"))
        )
          found = true;
      }
      ts.forEachChild(at, visit);
    };
    visit(body);
    return found;
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (ts.isIdentifier(node.expression) && name === "redirect")
        add("redirects", node);

      if (
        (name === "useQuery" || name === "useSuspenseQuery") &&
        file !== SESSION_HOOKS &&
        node.arguments[0] &&
        readsSession(node.arguments[0])
      )
        add("sessionReads", node);

      if (name && EFFECTS.has(name)) {
        const effect = node.arguments[0];
        if (
          effect &&
          (ts.isArrowFunction(effect) || ts.isFunctionExpression(effect)) &&
          navigates(effect.body)
        )
          add("navigatingEffects", node);
      }

      if (
        name === "catch" &&
        ts.isPropertyAccessExpression(node.expression) &&
        !(
          ts.isIdentifier(chainRoot(node.expression.expression)) &&
          (chainRoot(node.expression.expression) as ts.Identifier).text === "z"
        )
      ) {
        const handler = node.arguments[0];
        if (
          handler &&
          (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
          !handles(handler.body)
        )
          add("silentCatches", node.expression.name);
      }
    }

    if (ts.isCatchClause(node) && !handles(node.block))
      add("silentCatches", node);

    if (
      (ts.isPropertyAssignment(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      const name = propertyName(node);
      const object = node.parent;
      if (
        name === "queryKey" &&
        file !== KEY_FACTORY &&
        ts.isPropertyAssignment(node) &&
        ts.isArrayLiteralExpression(unwrap(node.initializer))
      )
        add("inlineQueryKeys", node);
      if (name === "validateSearch") {
        if (!onlyExceptions(keysWithin(node))) add("validateSearch", node);
      } else if (name === "search") {
        const value = ts.isPropertyAssignment(node)
          ? node.initializer
          : ts.isShorthandPropertyAssignment(node)
            ? node.name
            : undefined;
        const siblings = object.properties.map(propertyName);
        let outer: ts.Node = object.parent;
        while (
          ts.isParenthesizedExpression(outer) ||
          ts.isAsExpression(outer) ||
          ts.isSatisfiesExpression(outer)
        )
          outer = outer.parent;
        const handedToNavigation =
          siblings.includes("to") ||
          (ts.isCallExpression(outer) &&
            NAVIGATING_CALLS.has(calleeName(outer.expression) ?? ""));
        if (
          value &&
          handedToNavigation &&
          !carriesNothing(value) &&
          !carriesOnlyExceptions(value)
        )
          add("searchHandoffs", node);
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const value =
        node.initializer && ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : undefined;
      if (name === "session") add("sessionProps", node);
      if (
        name === "search" &&
        !(value && (carriesNothing(value) || carriesOnlyExceptions(value)))
      )
        add("searchHandoffs", node);
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (tag === "Navigate") add("renderNavigate", node);
      if (!inUi && (tag === "select" || tag === "input"))
        add("nativeControls", node);
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" || name === "node_modules"
        ? []
        : sourceFiles(path);
    return /\.tsx?$/.test(name) &&
      !/\.d\.ts$/.test(name) &&
      !/\.(test|spec)\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

export function scanWeb(): Finding[] {
  return sourceFiles(WEB).flatMap((path) =>
    scan(relative(WEB, path).split("\\").join("/"), readFileSync(path, "utf8")),
  );
}

type Baseline = {
  about: string;
  counts: Record<Category, number>;
  files: Record<Category, Record<string, number>>;
};

function tally(findings: Finding[]) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    Category,
    number
  >;
  const files = Object.fromEntries(CATEGORIES.map((c) => [c, {}])) as Record<
    Category,
    Record<string, number>
  >;
  for (const { category, file } of findings) {
    counts[category]++;
    files[category][file] = (files[category][file] ?? 0) + 1;
  }
  for (const category of CATEGORIES)
    files[category] = Object.fromEntries(
      Object.entries(files[category]).sort(([a], [b]) => a.localeCompare(b)),
    );
  return { counts, files };
}

/* ---------- the scanner reads what it should ---------- */

const only = (source: string, file = "features/x/Screen.tsx") =>
  scan(file, source).map((finding) => finding.category);

test("redirects and render-time navigation count", () => {
  assert.deepEqual(
    only(`
      const a = { beforeLoad: () => { throw redirect({ to: "/x" }); } };
      const b = () => <Navigate to="/y" />;
      // redirect( in a comment never counts
      const c = "redirect(";
    `),
    ["redirects", "renderNavigate"],
  );
});

test("query-string handoffs count; clearing and Stripe's return do not", () => {
  assert.deepEqual(
    only(`
      const route = { validateSearch: z.object({ from: z.string() }) };
      const stripe = { validateSearch: z.object({ session_id: z.string() }) };
      navigate({ to: "/a", search: { learner: id } });
      navigate({ search: (prev) => prev });
      throw redirect({ to: "/b", search: { return: here } as never });
      navigate({ to: "/c", search: {} });
      navigate({ to: "/d", search: { session_id: id } });
      const link = <Link to="/e" search={{ from: "x" }} />;
      const plain = <Link to="/f" search={{}} />;
      const notNavigation = { search: "text" };
      function f({ to, search }: Options) { return search; }
    `),
    [
      "validateSearch",
      "searchHandoffs",
      "searchHandoffs",
      "redirects",
      "searchHandoffs",
      "searchHandoffs",
    ],
  );
});

test("effects that navigate count once each", () => {
  assert.deepEqual(
    only(`
      function Screen() {
        const go = useNavigate();
        const router = useRouter();
        useEffect(() => { go({ to: "/a" }); }, []);
        useEffect(() => { void load().then(() => router.navigate({ to: "/b" })); }, []);
        useLayoutEffect(() => { window.history.replaceState(null, "", "/c"); });
        useEffect(() => { location.href = "/d"; window.location.assign("/e"); });
        React.useEffect(() => { window.location = next; });
        useEffect(() => { document.title = "AMP"; });
        const onClick = () => navigate({ to: "/f" });
      }
    `),
    [
      "navigatingEffects",
      "navigatingEffects",
      "navigatingEffects",
      "navigatingEffects",
      "navigatingEffects",
    ],
  );
});

test("catches that neither log nor rethrow are silent", () => {
  assert.deepEqual(
    only(`
      a.catch(() => null);
      b.catch(() => undefined);
      c.catch(() => {});
      d.catch(() => fallback);
      try { e(); } catch {}
      try { f(); } catch (error) { setStatus("failed"); }
      g.catch((error) => console.error("g failed", error));
      h.catch((error) => { throw new AppError(error); });
      i.catch((error) => reportError(error));
      j.catch((error) => navigationFailure(id, error));
      k.catch(() => Promise.reject(new Error("k")));
      l.catch(logged);
      try { m(); } catch (error) { console.warn("m failed", error); }
      n.catch(reported("load n", null));
      o.catch(ifNotFound(null));
      p.catch((error) => ifNotFound(null)(error));
      try { q(); } catch (error) { setError(reportError(error, "save q")); }
      try { r(); } catch (error) { errors.report(error, "save r"); }
      try { s(); } catch (error) { setError(messageFor(error)); }
      const schema = z.string().optional().catch(undefined);
      const other = z.enum(["a"]).catch(() => "a");
    `),
    [
      "silentCatches",
      "silentCatches",
      "silentCatches",
      "silentCatches",
      "silentCatches",
      "silentCatches",
      "silentCatches",
    ],
  );
});

test("sessions read outside lib/session.ts count", () => {
  const source = `
    const a = useQuery(sessionOptions).data;
    const { data } = useSuspenseQuery(sessionOptions);
    const c = useQuery({ ...sessionOptions, select: (s) => s?.accountId });
    const d = useSession();
    const e = useQuery(meOptions(session));
    const f = await queryClient.ensureQueryData(sessionOptions);
  `;
  assert.deepEqual(only(source), [
    "sessionReads",
    "sessionReads",
    "sessionReads",
  ]);
  assert.deepEqual(only(source, "lib/session.ts"), []);
});

test("query keys spelled outside lib/keys.ts count", () => {
  const source = `
    const a = queryOptions({ queryKey: ["account", id, "receipts"], queryFn });
    const b = queryOptions({ queryKey: [...billingKey(id), "offer"] as const, queryFn });
    void client.invalidateQueries({ queryKey: ["account", id] });
    const d = queryOptions({ queryKey: qk.receipts(id, null), queryFn });
    void client.invalidateQueries({ queryKey: qk.account(id) });
    const f = { queryKey };
  `;
  assert.deepEqual(only(source), [
    "inlineQueryKeys",
    "inlineQueryKeys",
    "inlineQueryKeys",
  ]);
  assert.deepEqual(only(source, "lib/keys.ts"), []);
});

test("session props and native controls outside ui/ count", () => {
  const source = `
    const a = <Panel session={session} />;
    const b = <select value={v} />;
    const c = <input type="text" />;
    const d = <Input value={v} />;
  `;
  assert.deepEqual(only(source), [
    "sessionProps",
    "nativeControls",
    "nativeControls",
  ]);
  assert.deepEqual(only(source, "ui/TextField.tsx"), ["sessionProps"]);
});

/* ---------- the ratchet ---------- */

test("architecture anti-patterns in src/web only fall", () => {
  const findings = scanWeb();
  const { counts, files } = tally(findings);
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  const problems: string[] = [];
  const lowered: string[] = [];
  for (const category of CATEGORIES) {
    const was = baseline.counts[category];
    const now = counts[category];
    assert.equal(typeof was, "number", `baseline lacks counts.${category}`);
    if (now > was) {
      const grown = Object.entries(files[category])
        .filter(([file, n]) => n > (baseline.files[category]?.[file] ?? 0))
        .map(([file]) => file);
      const where = findings
        .filter((f) => f.category === category && grown.includes(f.file))
        .map((f) => `    ${f.file}:${f.line}`);
      problems.push(
        `${category} rose from ${was} to ${now} (amp/AGENTS.md, "Frontend architecture"). Remove the new instance; it is in one of:\n${where.join("\n")}`,
      );
    } else if (now < was) lowered.push(`${category}: ${was} → ${now}`);
  }
  for (const category of Object.keys(baseline.counts))
    if (!CATEGORIES.includes(category as Category))
      problems.push(`baseline lists unknown category ${category}: delete it`);

  if (process.env.ARCHITECTURE_RATCHET === "update" && problems.length === 0) {
    writeFileSync(
      BASELINE,
      JSON.stringify({ about: baseline.about, counts, files }, null, 2) + "\n",
    );
    return;
  }
  if (lowered.length)
    problems.push(
      `Counts fell; lower the baseline so they stay down (${lowered.join(", ")}). From amp/, run:\n    ${UPDATE}\nand commit tests/architecture-ratchet.baseline.json.`,
    );
  assert.deepEqual(problems, []);
});

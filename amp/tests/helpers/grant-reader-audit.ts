import { createHash } from "node:crypto";
import ts from "typescript";

const ledger = /^(?:amp_(?:access_)?grants)$/i;
const unknown = "__audit_dynamic__";

/** PostgreSQL lexical tokens, including function bodies and dynamic SQL strings.
 * Comments cannot separate a relation from FROM; quoted identifiers and dollar
 * bodies retain their contents. This deliberately over-approximates SQL reads:
 * an unresolved relation is a review finding, never evidence of no access. */
function sqlTokens(sql: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < sql.length;) {
    if (/\s/.test(sql[i]!)) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      continue;
    }
    const dollar = /^\$(?:[a-z_][\w]*)?\$/i.exec(sql.slice(i))?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      tokens.push(
        ...sqlTokens(sql.slice(i + dollar.length, end < 0 ? undefined : end)),
      );
      i = end < 0 ? sql.length : end + dollar.length;
      continue;
    }
    const quote = sql[i];
    if (quote === '"' || quote === "'") {
      let value = "";
      i++;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            value += quote;
            i += 2;
          } else {
            i++;
            break;
          }
        } else if (sql[i] === "\\" && quote === "'") {
          value += sql[i + 1] ?? "";
          i += 2;
        } else value += sql[i++];
      }
      if (quote === '"') tokens.push(value.toLowerCase());
      else tokens.push(...sqlTokens(value));
      continue;
    }
    const word = /^[a-z_][\w$]*/i.exec(sql.slice(i))?.[0];
    if (word) {
      tokens.push(word.toLowerCase());
      i += word.length;
    } else tokens.push(sql[i++]!);
  }
  return tokens;
}

function readsSql(sql: string): boolean {
  if (!/amp_(?:access_)?grants|__audit_dynamic__|execute/i.test(sql))
    return false;
  if (
    !/amp_(?:access_)?grants|execute/i.test(sql) &&
    !/\bselect\b|^\s*table\b/i.test(sql)
  )
    return false;
  const tokens = sqlTokens(sql);
  // PL/pgSQL dynamic statements may assemble even the relation name. Trigger
  // EXECUTE FUNCTION/PROCEDURE is a definition, not a dynamic SQL execution.
  if (
    tokens.some(
      (t, i) =>
        t === "execute" &&
        !/^(?:function|procedure)$/.test(tokens[i + 1] ?? ""),
    )
  )
    return true;
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (word !== "from" && word !== "join" && word !== "table") continue;
    // TABLE as a query is a read; CREATE/ALTER/DROP TABLE are definitions.
    if (
      word === "table" &&
      /^(?:create|alter|drop|truncate|lock)$/.test(tokens[i - 1] ?? "")
    )
      continue;
    let j = i + 1;
    if (tokens[j] === "only") j++;
    if (tokens[j] === "(") j++;
    for (;;) {
      if (
        ledger.test(tokens[j] ?? "") ||
        (tokens[j]?.includes(unknown) ?? false)
      )
        return true;
      if (tokens[j + 1] !== ".") break;
      j += 2;
    }
  }
  // Comma relations, fragments, or unusual syntax must not hide a known ledger
  // within a SELECT. False positives are reviewed at the exact-query boundary.
  return tokens.includes("select") && tokens.some((t) => ledger.test(t));
}

/** Scan TS expressions rather than individual literals. Whitespace-preserving hashes and counts
 * are intentional: changing or reusing an approved query requires review too.
 * Unknown query construction and ORM FROM calls fail closed into the inventory.
 * This is a source guard, not a proof about arbitrary runtime-generated code. */
export function grantReads(
  path: string,
  source: string,
  onRead?: (hash: string, query: string) => void,
): string[] {
  const reads: string[] = [];
  const record = (text: string) => {
    const hash = createHash("sha256").update(text.trim()).digest("hex");
    reads.push(hash);
    onRead?.(hash, text);
  };
  if (path.endsWith(".sql")) {
    if (readsSql(source)) record(source);
    return reads;
  }
  const tree = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  // Multiple bindings with the same name are conservatively combined. We never
  // let a shadowing declaration establish that an unknown query is safe.
  const bindings = new Map<string, ts.Expression[]>();
  const grantNames = new Set(["grants", "amp_grants", "amp_access_grants"]);
  const collect = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const values = bindings.get(node.name.text) ?? [];
      values.push(node.initializer);
      bindings.set(node.name.text, values);
    }
    if (
      ts.isImportSpecifier(node) &&
      grantNames.has(node.propertyName?.text ?? node.name.text)
    )
      grantNames.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const unwrap = (node: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
      ? unwrap(node.expression)
      : node;
  const evaluate = (input: ts.Expression, seen = new Set<string>()): string => {
    const node = unwrap(input);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isTemplateExpression(node))
      return (
        node.head.text +
        node.templateSpans
          .map((s) => evaluate(s.expression, seen) + s.literal.text)
          .join("")
      );
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    )
      return evaluate(node.left, seen) + evaluate(node.right, seen);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      const values = bindings.get(node.text);
      if (values?.length === 1)
        return evaluate(values[0]!, new Set([...seen, node.text]));
    }
    if (ts.isConditionalExpression(node))
      return (
        evaluate(node.whenTrue, seen) + ";" + evaluate(node.whenFalse, seen)
      );
    if (ts.isTaggedTemplateExpression(node))
      return evaluate(node.template, seen);
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "join" &&
      ts.isArrayLiteralExpression(node.expression.expression)
    ) {
      const separator = node.arguments[0]
        ? evaluate(node.arguments[0], seen)
        : ",";
      return node.expression.expression.elements
        .map((e) => evaluate(e, seen))
        .join(separator);
    }
    return unknown;
  };
  const mentionsGrant = (node: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isIdentifier(node)) {
      if (grantNames.has(node.text)) return true;
      if (
        !seen.has(node.text) &&
        bindings
          .get(node.text)
          ?.some(
            (v) =>
              (ts.isIdentifier(v) ||
                ts.isPropertyAccessExpression(v) ||
                ts.isElementAccessExpression(v)) &&
              mentionsGrant(v, new Set([...seen, node.text])),
          )
      )
        return true;
    }
    if (
      ts.isStringLiteralLike(node) &&
      (grantNames.has(node.text) || ledger.test(node.text))
    )
      return true;
    let found = false;
    ts.forEachChild(node, (child) => {
      if (mentionsGrant(child, seen)) found = true;
    });
    return found;
  };
  const isText = (node: ts.Node) =>
    ts.isStringLiteralLike(node) ||
    ts.isTemplateExpression(node) ||
    (ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken);
  const visit = (node: ts.Node, inText = false) => {
    if (isText(node) && !inText) {
      const sql = evaluate(node as ts.Expression);
      if (readsSql(sql) || ledger.test(sql)) {
        // Preserve the reviewed fingerprints of complete existing templates.
        record(
          ts.isTemplateExpression(node)
            ? node.getText(tree).slice(1, -1)
            : ts.isStringLiteralLike(node)
              ? node.text
              : node.getText(tree),
        );
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) &&
            callee.argumentExpression &&
            ts.isStringLiteralLike(callee.argumentExpression)
          ? callee.argumentExpression.text
          : ts.isIdentifier(callee)
            ? callee.text
            : "";
      if (
        !ts.isIdentifier(callee) &&
        /^(?:query|execute|raw|unsafe)$/.test(name) &&
        node.arguments[0]
      ) {
        let arg = node.arguments[0];
        if (ts.isObjectLiteralExpression(arg)) {
          const text = arg.properties.find(
            (p) =>
              ts.isPropertyAssignment(p) &&
              p.name.getText(tree).replace(/["']/g, "") === "text",
          );
          if (text && ts.isPropertyAssignment(text)) arg = text.initializer;
        }
        const sql = evaluate(arg);
        // Direct literals are counted by their AST nodes. Referenced queries
        // count at each use, including duplicate uses of one declaration.
        if (!isText(arg) && (readsSql(sql) || sql === unknown))
          record(node.getText(tree));
      }
      const builtinFrom =
        ts.isPropertyAccessExpression(callee) &&
        /^(?:Array|Buffer|Uint\d+Array|Int\d+Array|Float\d+Array)$/.test(
          callee.expression.getText(tree),
        );
      if (
        (name === "from" &&
          !builtinFrom &&
          !ts.isIdentifier(callee) &&
          (mentionsGrant(node) ||
            /\.select\s*\(|^(?:db|database|tx)\b/.test(
              callee.getText(tree),
            ))) ||
        /^(?:findMany|findFirst)$/.test(name) ||
        (/^(?:.*[Jj]oin|select)$/.test(name) && mentionsGrant(node))
      )
        record(`orm:${node.getText(tree)}`);
    }
    ts.forEachChild(node, (child) =>
      visit(
        child,
        (inText || isText(node)) &&
          isText(child) &&
          (ts.isBinaryExpression(node) || ts.isParenthesizedExpression(node)),
      ),
    );
  };
  visit(tree);
  return reads;
}

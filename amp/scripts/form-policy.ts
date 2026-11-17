import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/**
 * One validation pattern for every form (ui/Form.tsx, ui/field-validation.ts):
 * the browser's own validation bubble never shows.
 *
 * - A screen never renders a raw `<form>`; it uses ui/Form, the one `<form>`,
 *   which is `noValidate`.
 * - Nothing calls `reportValidity()`, which draws the bubble from code.
 * - Native constraints (`required`, `pattern`, `minLength`, `maxLength`
 *   aside, and an email or URL type) sit only on ui/TextField, whose own line
 *   says what is wrong. Anywhere else a failed rule would stop a submit with
 *   nothing on screen to say why.
 */
const CONSTRAINTS = new Set(["required", "pattern", "minLength"]);
const CHECKED_TYPES = new Set(["email", "url"]);
const FIELD_OWNERS = new Set(["TextField"]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [path]
      : [];
  });
}

/** Each problem in one file's source, as "line: what". */
export function formProblems(
  source: string,
  { isFormOwner = false, tsx = true } = {},
): string[] {
  const file = ts.createSourceFile(
    tsx ? "screen.tsx" : "module.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const problems: string[] = [];
  const at = (node: ts.Node, what: string) =>
    problems.push(
      `${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${what}`,
    );
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file);
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const names = attributes.map((a) => a.name.getText(file));
      if (tag === "form") {
        if (!isFormOwner) at(node, "a raw <form>: use ui/Form");
        else if (!names.includes("noValidate"))
          at(node, "ui/Form's <form> must be noValidate");
      }
      if (!FIELD_OWNERS.has(tag))
        for (const attribute of attributes) {
          const name = attribute.name.getText(file);
          let value: ts.Node | undefined = attribute.initializer;
          if (value && ts.isJsxExpression(value)) value = value.expression;
          const text =
            value &&
            (ts.isStringLiteral(value) ||
              ts.isNoSubstitutionTemplateLiteral(value))
              ? value.text
              : undefined;
          if (CONSTRAINTS.has(name))
            at(node, `\`${name}\` on <${tag}>: put the rule on ui/TextField`);
          if (name === "type" && text && CHECKED_TYPES.has(text))
            at(node, `type="${text}" on <${tag}>: use ui/TextField`);
        }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "reportValidity"
    )
      at(
        node,
        "reportValidity() draws the browser's bubble: use checkValidity()",
      );
    ts.forEachChild(node, visit);
  }
  visit(file);
  return problems;
}

/** Every problem under `web` (src/web), as "path:line: what". */
export function formPolicyViolations(web: string): string[] {
  const owner = join(web, "ui", "Form.tsx");
  const violations = sources(web).flatMap((file) =>
    formProblems(readFileSync(file, "utf8"), {
      isFormOwner: file === owner,
      tsx: file.endsWith(".tsx"),
    }).map((problem) => `${relative(web, file)}:${problem}`),
  );
  // Comments and strings don't count: only the elements it renders.
  const source = ts.createSourceFile(
    "Form.tsx",
    readFileSync(owner, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let forms = 0;
  const count = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source) === "form"
    )
      forms++;
    ts.forEachChild(node, count);
  };
  count(source);
  if (forms !== 1) violations.push("ui/Form.tsx must own exactly one <form>");
  return violations;
}

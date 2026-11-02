import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

function screens(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" ? [] : screens(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}
export function rawCheckboxes(source: string): number[] {
  const file = ts.createSourceFile(
    "screen.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const positions: number[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file);
      if (/^[a-z]/.test(tag)) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          const name = attribute.name.getText(file);
          let value: ts.Node | undefined = attribute.initializer;
          if (value && ts.isJsxExpression(value)) value = value.expression;
          if (
            value &&
            (ts.isStringLiteral(value) ||
              ts.isNoSubstitutionTemplateLiteral(value)) &&
            value.text === "checkbox" &&
            (name === "role" || (tag === "input" && name === "type"))
          )
            positions.push(node.pos);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return positions;
}

/** One implementation owns native checkbox behavior; screens compose it. */
export function checkboxPolicyViolations(web: string): string[] {
  const files = screens(web);
  const violations = files
    .filter(
      (file) =>
        relative(web, file) !== "ui/Checkbox.tsx" &&
        rawCheckboxes(readFileSync(file, "utf8")).length,
    )
    .map((file) => relative(web, file));
  if (
    rawCheckboxes(readFileSync(join(web, "ui/Checkbox.tsx"), "utf8")).length !==
    1
  )
    violations.push("ui/Checkbox.tsx must own exactly one native checkbox");
  return violations;
}

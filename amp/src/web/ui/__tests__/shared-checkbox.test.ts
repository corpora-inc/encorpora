// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";

const web = fileURLToPath(new URL("../..", import.meta.url));
function screens(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" ? [] : screens(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}
function rawCheckboxes(source: string): number[] {
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
test("all screens use the single shared native checkbox implementation", () => {
  const files = screens(web);
  expect(files.length).toBeGreaterThan(50);
  const offenders = files
    .filter(
      (file) =>
        relative(web, file) !== "ui/Checkbox.tsx" &&
        rawCheckboxes(readFileSync(file, "utf8")).length,
    )
    .map((file) => relative(web, file));
  expect(offenders).toEqual([]);
  expect(
    rawCheckboxes(readFileSync(join(web, "ui/Checkbox.tsx"), "utf8")),
  ).toHaveLength(1);
});
test("the architecture guard rejects ad hoc native and custom checkbox spellings", () => {
  for (const source of [
    '<input type="checkbox" />',
    "<input type={'checkbox'} />",
    "<input type={`checkbox`} />",
    '<button role="checkbox" />',
    "<span role={'checkbox'} />",
  ])
    expect(rawCheckboxes(source), source).toHaveLength(1);
  expect(rawCheckboxes("<CheckboxControl checked={true} />")).toEqual([]);
  expect(rawCheckboxes('<input type="radio" />')).toEqual([]);
});

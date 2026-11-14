import { createHash } from "node:crypto";
import ts from "typescript";

/** Inspect SQL literals, including complete interpolated templates. Counts are
 * significant: copying an approved query into a second reader must fail too. */
export function grantReads(path: string, source: string): string[] {
  const reads: string[] = [];
  const record = (sql: string) => {
    if (/\b(?:FROM|JOIN)\s+["']?amp_(?:access_)?grants\b/i.test(sql))
      reads.push(
        createHash("sha256")
          .update(sql.replace(/\s+/g, " ").trim())
          .digest("hex"),
      );
  };
  if (path.endsWith(".sql")) {
    record(source);
    return reads;
  }
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) record(node.text);
    if (ts.isTemplateExpression(node)) record(node.getText(tree).slice(1, -1));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return reads;
}

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
function importsFrom(entries: string[]) {
  const visited = new Set<string>();
  const pending = entries.map((path) => resolve(root, path));
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readFileSync(path, "utf8");
    for (const imported of ts.preProcessFile(source, true, true)
      .importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      const base = resolve(dirname(path), imported.fileName).replace(
        /\.js$/,
        "",
      );
      const target = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
      ].find(
        (candidate) => /\.(ts|tsx)$/.test(candidate) && existsSync(candidate),
      );
      if (target) pending.push(target);
    }
  }
  return visited;
}

test("server, web and offline production import graphs exclude experimental frontier code", () => {
  const imports = importsFrom([
    "src/server/main.ts",
    "src/web/main.tsx",
    "src/offline/repository.ts",
  ]);
  assert.ok(imports.has(resolve(root, "src/server/mixed-practice.ts")));
  assert.ok(imports.has(resolve(root, "src/learning/frontier.ts")));
  for (const path of imports)
    assert.ok(
      !/experimental-(frontier|mixed-practice)\.ts$|item-calibration\.ts$/.test(
        path,
      ),
      path,
    );
  const experimental = importsFrom([
    "src/server/experimental-mixed-practice.ts",
  ]);
  assert.ok(
    experimental.has(resolve(root, "src/learning/experimental-frontier.ts")),
    "positive control: traverse experimental dependencies",
  );
  assert.ok(
    experimental.has(resolve(root, "src/learning/item-calibration.ts")),
  );
});

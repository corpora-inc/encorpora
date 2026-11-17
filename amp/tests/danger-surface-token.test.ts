import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// `--color-danger` is a surface (a failure's background, src/web/ui/tokens.css):
// as text it has no contrast in either theme ("The school year didn't load"
// at 1.35:1 in dark). A failure's words are `--color-danger-accent`, or
// `--color-on-danger` on that surface.
test("no failure text is drawn in the danger surface's color", () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".css"))
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, at) => {
            if (/(^|[^-])color:\s*var\(--color-danger\)/.test(line))
              found.push(`${path}:${at + 1}`);
          });
    }
  };
  walk(join(import.meta.dirname, "../src/web"));
  assert.deepEqual(found, []);
});

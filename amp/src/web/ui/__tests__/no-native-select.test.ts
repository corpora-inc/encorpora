// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
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

// Native selects render the platform's own picker: unstyled, unthemed and
// sized by the browser. Choices use ui/Listbox or ui/Segmented instead.
test("no screen in src/web renders a native <select>", () => {
  const files = screens(web);
  expect(files.length).toBeGreaterThan(50);
  const offenders = files
    .filter((file) => /<select[\s>/]/.test(readFileSync(file, "utf8")))
    .map((file) => relative(web, file));
  expect(offenders).toEqual([]);
});

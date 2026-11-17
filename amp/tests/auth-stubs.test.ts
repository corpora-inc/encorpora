import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

/** Browser checks that replace src/web/auth.ts with a fixture module (a
 * Vite `load` hook returning source) must export everything the real module
 * does: a missing export breaks every screen that imports it, and the check
 * then times out far from the cause. */
test("every auth.ts fixture stub exports what auth.ts exports", async () => {
  const real = await readFile(new URL("src/web/auth.ts", root), "utf8");
  const exported = [
    ...real.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm),
  ].map((match) => match[1]!);
  assert.ok(exported.includes("accessSession"), "auth.ts exports were read");
  const scripts = (await readdir(new URL("scripts/", root))).filter((name) =>
    name.endsWith(".ts"),
  );
  const stubs: string[] = [];
  for (const name of scripts) {
    const source = await readFile(new URL(`scripts/${name}`, root), "utf8");
    // A stub is source text that defines auth.ts's session notifier.
    if (!/["'`][^"'`]*export function notifyAccountSessionChanged/.test(source))
      continue;
    stubs.push(name);
    const missing = exported.filter(
      (name) =>
        !new RegExp(`export (?:async )?(?:function|const|let) ${name}\\b`).test(
          source,
        ),
    );
    assert.deepEqual(missing, [], `scripts/${name}'s auth stub lacks these`);
  }
  assert.ok(stubs.length > 0, "no auth stubs found");
});

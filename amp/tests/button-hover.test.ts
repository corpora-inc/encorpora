import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// A bare `button:hover` that sets a background repaints light surface buttons
// with the primary fill while their text stays dark. Whether it wins depends on
// stylesheet order, so no global hover rule may set a background at all.
test("global button hover never replaces a button's background", () => {
  const dir = new URL("../src/web/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".css"))) {
    const css = readFileSync(new URL(file, dir), "utf8");
    for (const [, body] of css.matchAll(/(?:^|\})\s*button:hover[^{,]*\{([^}]*)\}/g)) {
      assert.doesNotMatch(body, /background/, `${file}: global button:hover`);
    }
  }
});

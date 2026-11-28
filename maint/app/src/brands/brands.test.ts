import { test } from "node:test";
import assert from "node:assert/strict";
import { brand, brandCss } from "./index.ts";

test("the default brand changes nothing; a brand's tokens apply in both themes", () => {
  assert.equal(brandCss(brand(undefined)), "");
  const css = brandCss({ ...brand(undefined), light: { ink: "#000000" }, dark: { ink: "#ffffff" } });
  assert.match(css, /^:root\{--ink:#000000;\}/);
  assert.match(css, /:root\[data-theme='dark'\]\{--ink:#ffffff;\}/);
  assert.match(css, /prefers-color-scheme: dark\)\{:root:not\(\[data-theme='light'\]\)\{--ink:#ffffff;\}\}/);
});

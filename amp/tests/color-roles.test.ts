import test from "node:test";
import assert from "node:assert/strict";
import {
  contrast,
  resolveTheme,
  tokenBlocks,
  type Theme,
} from "../scripts/color-system.js";

const TEXT = 4.5,
  UI = 3;

/** Background roles, each with the states a component may put it in. */
const pairs: [role: string, states: string[]][] = [
  ["surface", ["", "-hover", "-active"]],
  ["surface-raised", ["", "-hover", "-active"]],
  ["surface-sunken", [""]],
  ["menu", ["", "-hover", "-active"]],
  ["primary", ["", "-hover", "-active"]],
  ["secondary", ["", "-hover", "-active"]],
  ["selected", ["", "-hover"]],
  ["success", [""]],
  ["danger", [""]],
  ["warning", [""]],
  ["info", [""]],
];
/** Neutral backgrounds that carry free text (muted, links, accents). */
const canvases = [
  "surface",
  "surface-hover",
  "surface-raised",
  "surface-raised-hover",
  "surface-sunken",
  "menu",
  "menu-hover",
];
/** Resting backgrounds that carry control borders and focus rings. */
const resting = ["surface", "surface-raised", "surface-sunken", "menu"];

function check(theme: Theme) {
  const { color } = resolveTheme(theme);
  const failures: string[] = [];
  const need = (fg: string, bg: string, min: number) => {
    const ratio = contrast(color(`--color-${fg}`), color(`--color-${bg}`));
    if (ratio < min)
      failures.push(`${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
  };
  for (const [role, states] of pairs)
    for (const state of states) need(`on-${role}`, role + state, TEXT);
  for (const bg of canvases) {
    need("muted-text", bg, TEXT);
    need("subtle-text", bg, TEXT);
    // Text buttons and links use the primary hue as text.
    need("primary", bg, TEXT);
    need("focus-ring", bg, UI);
  }
  for (const bg of resting) need("border-strong", bg, UI);
  need("primary", "secondary", TEXT);
  need("primary", "secondary-hover", TEXT);
  for (const tone of ["success", "danger", "warning", "info"]) {
    need(`${tone}-accent`, tone, UI);
    need(`${tone}-accent`, "surface", UI);
    need(`${tone}-accent`, "surface-raised", UI);
  }
  // A filled button is a UI component: its shape must read against the page.
  need("primary", "surface", UI);
  need("selected", "surface-sunken", UI);
  need("on-disabled", "disabled", UI);
  return failures;
}

for (const theme of ["light", "dark"] as const)
  test(`every color role pair and state layer is readable in ${theme}`, () =>
    assert.deepEqual(check(theme), []));

test("dark values are defined once: system and explicit dark blocks agree", () => {
  const { darkSystem, darkExplicit, light } = tokenBlocks();
  assert.deepEqual([...darkExplicit], [...darkSystem]);
  // Every role a theme sets, the other theme sets too.
  assert.deepEqual(
    [...darkSystem.keys()].sort(),
    [...light.keys()].filter((k) => k.startsWith("--color-")).sort(),
  );
});

test("every legacy alias resolves onto a role in both themes", () => {
  for (const theme of ["light", "dark"] as const) {
    const { color } = resolveTheme(theme);
    for (const alias of ["--bg", "--surface", "--ink", "--ink-2", "--ink-3"])
      assert.equal(color(alias).length, 4, `${theme} ${alias}`);
  }
});

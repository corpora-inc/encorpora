import test from "node:test";
import assert from "node:assert/strict";
import {
  contrast,
  resolveTheme,
  tokenBlocks,
  type Look,
  type Theme,
} from "../scripts/color-system.js";

const TEXT = 4.5,
  UI = 3;

/** Background roles, each with the states a component may put it in. */
const pairs: [role: string, states: string[]][] = [
  ["surface", ["", "-hover", "-active"]],
  ["surface-raised", ["", "-hover", "-active"]],
  ["surface-sunken", [""]],
  ["answer", [""]],
  ["menu", ["", "-hover", "-active"]],
  ["primary", ["", "-hover", "-active"]],
  ["secondary", ["", "-hover", "-active"]],
  ["selected", ["", "-hover"]],
  ["success", [""]],
  ["danger", [""]],
  ["warning", [""]],
  ["info", [""]],
  ["rail", ["", "-hover"]],
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(
    (hue) => [`avatar-${hue}`, [""]] as [string, string[]],
  ),
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
  "rail",
];
/** Resting backgrounds that carry control borders and focus rings. */
const resting = [
  "surface",
  "surface-raised",
  "surface-sunken",
  "menu",
  "answer",
];

function check(theme: Theme, look: Look) {
  const { color } = resolveTheme(theme, undefined, look);
  const failures: string[] = [];
  const need = (fg: string, bg: string, min: number) => {
    const ratio = contrast(color(`--color-${fg}`), color(`--color-${bg}`));
    if (ratio < min)
      failures.push(
        `${theme} ${look}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`,
      );
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
  // An answer field's border reads against the field and the page around it.
  need("answer-border", "answer", UI);
  need("answer-border", "surface", UI);
  need("primary", "secondary", TEXT);
  need("primary", "secondary-hover", TEXT);
  for (const tone of ["success", "danger", "warning", "info"]) {
    need(`${tone}-accent`, tone, UI);
    need(`${tone}-accent`, "surface", UI);
    need(`${tone}-accent`, "surface-raised", UI);
  }
  // Provider sign-in buttons share one neutral style: the label on the fill,
  // and a shape (fill or border) that reads against the sign-in card.
  need("on-provider", "provider", TEXT);
  if (contrast(color("--color-provider"), color("--color-surface-raised")) < UI)
    need("provider-border", "surface-raised", UI);
  // A filled button is a UI component: its shape must read against the page.
  need("primary", "surface", UI);
  need("selected", "surface-sunken", UI);
  need("on-disabled", "disabled", UI);
  // Status accents also label things ("Correct", error text) on neutral surfaces.
  for (const tone of ["success", "danger", "warning", "info"])
    for (const bg of ["surface", "surface-raised", tone])
      need(`${tone}-accent`, bg, TEXT);
  // Figures: labels read as text, marks and lines as UI, on paper and fills.
  need("figure-ink", "figure-paper", TEXT);
  for (const fill of ["accent-fill", "warm-fill", "gold-fill", "empty"])
    need("figure-ink", `figure-${fill}`, TEXT);
  for (const mark of ["accent", "warm", "gold", "axis"])
    need(`figure-${mark}`, "figure-paper", UI);
  need("figure-accent", "figure-accent-fill", UI);
  need("figure-warm", "figure-warm-fill", UI);
  // A meter's fill reads on the page and on a card.
  need("meter", "surface", UI);
  need("meter", "surface-raised", UI);
  // A grade curve's letters are marks on every neutral surface.
  for (const letter of ["a", "b", "c", "d", "f"])
    for (const bg of ["surface", "surface-raised", "surface-sunken"])
      need(`grade-${letter}`, bg, UI);
  // Strand colors are marks (dots, bars) on every neutral surface.
  for (const strand of [
    "number",
    "operations",
    "fractions",
    "decimals",
    "ratio",
    "algebra",
    "functions",
    "geometry",
    "measurement",
    "data",
    "probability",
    "modeling",
  ])
    for (const bg of ["surface", "surface-raised", "surface-sunken"])
      need(`strand-${strand}`, bg, UI);
  if (look === "bold") {
    // The points chip: its number is text on the chip, and the chip (a
    // shape, with its edge) reads on every surface practice draws it over.
    need("on-points", "points", TEXT);
    for (const bg of ["surface", "surface-raised", "success"])
      if (contrast(color("--color-points"), color(`--color-${bg}`)) < UI)
        need("points-edge", bg, 1.5);
    // Confetti is decoration, but no piece may vanish into the page.
    for (const hue of [1, 2, 3, 4, 5, 6])
      for (const bg of ["surface", "success"])
        need(`celebrate-${hue}`, bg, 1.5);
  }
  return failures;
}

for (const theme of ["light", "dark"] as const)
  for (const look of ["calm", "bold"] as const)
    test(`every color role pair and state layer is readable in ${theme}, ${look}`, () =>
      assert.deepEqual(check(theme, look), []));

test("Colorful is defined once per theme: both dark forms agree, every key in both themes", () => {
  const { boldLight, boldDarkSystem, boldDarkExplicit, light } = tokenBlocks();
  assert.deepEqual([...boldDarkExplicit], [...boldDarkSystem]);
  assert.deepEqual([...boldDarkSystem.keys()], [...boldLight.keys()]);
  // Colorful only swaps roles that exist, or adds its own (points, confetti).
  for (const key of boldLight.keys())
    assert.ok(
      light.has(key) ||
        /^--color-(points|on-points|points-edge|celebrate-\d)$/.test(key),
      `${key} is not a role Calm has`,
    );
  // A miss stays kind and calm in either look; a problem's figures and the
  // math they draw keep their own colors.
  for (const key of boldLight.keys())
    assert.ok(
      !/^--color-(danger|on-danger|warning|on-warning|figure-|strand-)/.test(
        key,
      ),
      `Colorful must not restyle ${key}`,
    );
});

test("dark values are defined once: system and explicit dark blocks agree", () => {
  const { darkSystem, darkExplicit, light } = tokenBlocks();
  assert.deepEqual([...darkExplicit], [...darkSystem]);
  // Every role a theme sets, the other theme sets too.
  assert.deepEqual(
    [...darkSystem.keys()].sort(),
    [...light.keys()].filter((k) => k.startsWith("--color-")).sort(),
  );
});

test("every stylesheet uses role names; no legacy aliases remain", () => {
  for (const theme of ["light", "dark"] as const) {
    const { names } = resolveTheme(theme);
    for (const legacy of ["--bg", "--surface", "--ink", "--ink-2", "--line"])
      assert.ok(!names.includes(legacy), `${theme} still defines ${legacy}`);
  }
});

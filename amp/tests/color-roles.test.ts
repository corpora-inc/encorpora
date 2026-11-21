import test from "node:test";
import assert from "node:assert/strict";
import {
  contrast,
  resolveTheme,
  type Rgba,
  tokenBlocks,
  type Colorful,
  type Theme,
} from "../scripts/color-system.js";

/** sRGB (0–255) to OKLab, for how far apart two marks look. */
function oklab([r, g, b]: Rgba) {
  const lin = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(
    0.4122214708 * lin[0]! + 0.5363325363 * lin[1]! + 0.0514459929 * lin[2]!,
  );
  const m = Math.cbrt(
    0.2119034982 * lin[0]! + 0.6806995451 * lin[1]! + 0.1073969566 * lin[2]!,
  );
  const s = Math.cbrt(
    0.0883024619 * lin[0]! + 0.2817188376 * lin[1]! + 0.6299787005 * lin[2]!,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

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

function check(theme: Theme, colorful?: Colorful) {
  const look = colorful
    ? `colorful ${colorful.hue}°${colorful.boost ? " boosted" : ""}${colorful.named ? " named" : ""}${colorful.wide ? " wide" : ""}`
    : "calm";
  const { color } = resolveTheme(theme, undefined, colorful);
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
  if (colorful) {
    // Practice's own pairs: the points chip, the keys, a right answer's
    // green check in its white disc, a miss's amber mark, the button's
    // edge against the page.
    need("on-points", "points", TEXT);
    need("on-key", "key", TEXT);
    need("key-edge", "surface", 1.3);
    need("correct", "mark-disc", UI);
    need("mark-disc", "success", 1.1);
    need("danger-accent", "danger", UI);
    need("on-danger", "danger", TEXT);
    need("primary", "success", UI);
    need("on-success", "success", TEXT);
    need("muted-text", "success", TEXT);
    // Confetti is decoration, but no piece may vanish into the page.
    for (const hue of [1, 2, 3, 4, 5, 6])
      need(`celebrate-${hue}`, "surface", 1.5);
    // A figure's three marks stay apart from each other at every hue
    // (named marks are Calm's own, tested above).
    const marks = ["accent", "warm", "gold"].map((mark) =>
      oklab(color(`--color-figure-${mark}`)),
    );
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      const distance = Math.hypot(
        marks[i]![0] - marks[j]![0],
        marks[i]![1] - marks[j]![1],
        marks[i]![2] - marks[j]![2],
      );
      if (distance < 0.1 && !colorful.named)
        failures.push(
          `${look}: figure marks ${i} and ${j} too close (ΔE ${distance.toFixed(3)})`,
        );
    }
  }
  return failures;
}

for (const theme of ["light", "dark"] as const)
  test(`every color role pair and state layer is readable in Calm ${theme}`, () =>
    assert.deepEqual(check(theme), []));

/** Colorful's hue samples: the whole circle, every 5°. */
const hues = Array.from({ length: 72 }, (_, i) => i * 5);
test("Colorful: every pair is readable at every hue, at rest and on a streak", () => {
  // As an sRGB laptop shows it (clipped) and as a wide-gamut phone does.
  const failures = hues.flatMap((hue) =>
    [false, true].flatMap((wide) => [
      ...check("light", { hue, wide }),
      ...check("light", { hue, boost: 1, wide }),
      ...check("light", { hue, named: true, wide }),
    ]),
  );
  assert.deepEqual(failures, []);
});

test("Colorful is one scheme: the system's dark setting changes nothing", () => {
  for (const hue of [0, 120, 240]) {
    const light = resolveTheme("light", undefined, { hue });
    const dark = resolveTheme("dark", undefined, { hue });
    for (const name of light.names.filter((n) => n.startsWith("--color-")))
      assert.deepEqual(light.color(name), dark.color(name), name);
  }
});

/** Roles whose colors carry meaning, left as Calm's in Colorful: the math
 * areas, grade letters, practice heat and dose, coin and bill metal, the
 * avatars that tell people apart, provider brands, and print. */
const FIXED =
  /^--color-(strand-|grade-|heat-|dose-|coin-|bill-|avatar-|on-avatar-|provider|on-provider|brand-|print-)/;

test("Colorful turns every other role with the hue: nothing of Calm's is left", () => {
  const { light, bold } = tokenBlocks();
  const missing = [...light.keys()].filter(
    (key) => key.startsWith("--color-") && !FIXED.test(key) && !bold.has(key),
  );
  assert.deepEqual(missing, []);
  for (const key of bold.keys())
    assert.ok(!FIXED.test(key), `Colorful must leave ${key} as Calm's`);
  // Every turning role really turns: two hues give two colors.
  const at = (hue: number) => resolveTheme("light", undefined, { hue });
  const [a, b] = [at(30), at(210)];
  const constant = new Set([
    "--color-on-primary",
    "--color-on-selected",
    "--color-success-accent",
    "--color-not-yet-tint",
    "--color-on-danger",
    "--color-danger-accent",
    "--color-warning",
    "--color-on-warning",
    "--color-warning-accent",
    "--color-info",
    "--color-on-info",
    "--color-info-accent",
    "--color-mark-disc",
    "--color-correct",
    "--color-points",
    "--color-on-points",
    "--color-points-edge",
  ]);
  for (const key of bold.keys()) {
    if (!key.startsWith("--color-")) continue;
    const same = JSON.stringify(a.color(key)) === JSON.stringify(b.color(key));
    assert.equal(
      same,
      constant.has(key),
      `${key} ${same ? "does not turn" : "turns"}`,
    );
  }
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

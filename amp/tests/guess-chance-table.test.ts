import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { templates } from "../src/math/engine";
import {
  builtGuessChances,
  guessChance,
  guessChanceOf,
  guessChanceTable,
} from "../src/math/guess-chance";

test("the table holds each answered family's computed chance, and no typed family", () => {
  const typed = templates.find((t) => !t.requiredResponseCapability)!;
  const answered = templates
    .filter((t) => t.requiredResponseCapability)
    .slice(0, 6);
  const table = guessChanceTable([typed, ...answered]);
  assert.deepEqual(
    table,
    Object.fromEntries(answered.map((t) => [t.id, guessChance(t)])),
  );
  assert.equal(guessChanceOf(typed.id), 0);
});

test("without a build there is no table, so families are computed on demand", () => {
  assert.equal(builtGuessChances, 0);
});

test("a built server answers from the table without generating a problem", async () => {
  const family = templates.find((t) => t.requiredResponseCapability)!;
  // A value no generator produces shows the answer came from the table.
  const define = { [family.id]: 0.123 };
  const outfile = join(
    await mkdtemp(join(tmpdir(), "guess-table-")),
    "guess.mjs",
  );
  await build({
    entryPoints: [new URL("../src/math/guess-chance.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "error",
    define: { __AMP_GUESS_CHANCES__: JSON.stringify(define) },
  });
  const compiled = await import(outfile);
  assert.equal(compiled.builtGuessChances, 1);
  assert.equal(compiled.guessChanceOf(family.id), 0.123);
});

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { generateProblem, templates } from "../src/math/engine";
import {
  builtGuessChances,
  guessChance,
  guessChanceOf,
  guessChanceTable,
  problemGuessChance,
} from "../src/math/guess-chance";

test("the table holds each family's computed chance, including typed and mixed families", () => {
  const table = guessChanceTable(templates);
  assert.deepEqual(
    Object.keys(table).sort(),
    templates.map((t) => t.id).sort(),
  );
  for (const family of templates) {
    assert.equal(table[family.id], guessChance(family), family.id);
    assert.equal(guessChanceOf(family.id), table[family.id], family.id);
    for (let i = 0; i < 6; i++)
      assert.ok(
        table[family.id]! >=
          problemGuessChance(generateProblem(family.id, `table:${i}`)),
        `${family.id} table:${i}: table understates guessing chance`,
      );
  }
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

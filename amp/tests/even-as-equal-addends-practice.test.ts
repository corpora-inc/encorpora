import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateEvenAsEqualAddends } from "../src/math/even-as-equal-addends-practice";
import { generatedProblemSchema } from "../src/math/contracts";

const parts = (label: string) =>
  label
    .replaceAll("$", "")
    .replaceAll(" ", "")
    .split("=")[1]!
    .split("+")
    .map(Number);

test("every even count has one equation with equal addends", () => {
  let heavy = 0;
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const problem = generateEvenAsEqualAddends("even-as-equal-addends", `even-${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "choice");
    if (problem.public.response.kind !== "choice") continue;
    const n = Number(problem.public.prompt.match(/\d+/)![0]);
    assert.equal(n % 2, 0);
    assert.ok(n >= 2 && n <= 20);
    seen.add(n);
    if (n >= 6) heavy++;
    const options = problem.public.response.options;
    assert.equal(options.length, 4);
    const equal = options.filter((option) => {
      const addends = parts(option.label);
      return addends.length === 2 && addends[0] === addends[1] && addends[0]! * 2 === n;
    });
    assert.equal(equal.length, 1);
    assert.equal(problem.answer, equal[0]!.id);
    for (const option of options) {
      const addends = parts(option.label);
      assert.equal(
        addends.reduce((sum, part) => sum + part, 0),
        n,
      );
      if (option.id !== problem.answer)
        assert.ok(problem.choiceFeedback?.[option.id]);
    }
    if (n >= 6)
      assert.ok(
        options.some((option) => {
          const addends = parts(option.label);
          return addends.length === n / 2 && addends.every((part) => part === 2);
        }),
      );
    assert.ok(!problem.hint.includes(`${n / 2} + ${n / 2}`));
  }
  assert.ok(heavy / 200 >= 0.6, `heavy ${heavy}`);
  assert.ok(seen.has(2) && seen.has(8) && seen.has(20));
});

test("the even-addend oracle agrees with the generator", () => {
  const oracle = fileURLToPath(
    new URL("../scripts/even_as_equal_addends_math_oracle.py", import.meta.url),
  );
  const ran = spawnSync("python3", [oracle], { encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr);
  const check = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys; from even_as_equal_addends_math_oracle import review_problem, self_test; self_test(); [review_problem(json.loads(line)) for line in sys.stdin]",
    ],
    {
      cwd: fileURLToPath(new URL("../scripts/", import.meta.url)),
      encoding: "utf8",
      input: Array.from({ length: 30 }, (_, i) =>
        JSON.stringify(generateEvenAsEqualAddends("even-as-equal-addends", `oracle-${i}`)),
      ).join("\n"),
    },
  );
  assert.equal(check.status, 0, check.stderr);
});

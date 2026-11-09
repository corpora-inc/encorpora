import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateCountOutObjects } from "../src/math/count-out-objects-practice";
import { generatedProblemSchema } from "../src/math/contracts";

test("figure-choice frames show n, one less, one more, and loose ones", () => {
  const seen = new Map<number, number>();
  for (let i = 0; i < 800; i++) {
    const problem = generateCountOutObjects("count-out-objects", `out-${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "figure-choice");
    if (problem.public.response.kind !== "figure-choice") continue;
    const n = Number(problem.public.prompt.match(/\d+/)![0]);
    seen.set(n, (seen.get(n) ?? 0) + 1);
    const options = problem.public.response.options;
    assert.equal(options.length, 4);
    const counts = options.map((option) => {
      const count = Number(option.label.match(/shows (\d+) counter/)![1]);
      const frame = option.scene.elements.find((element) => element.type === "tenFrame");
      assert.ok(frame && frame.type === "tenFrame");
      if (frame?.type !== "tenFrame") return count;
      const drawn = frame.groups.reduce((sum, group) => sum + group.count, 0);
      assert.equal(drawn, count);
      assert.equal(frame.frames * 10 >= count, true);
      return count;
    });
    assert.equal(new Set(counts).size, 4);
    assert.ok(counts.includes(n));
    assert.ok(counts.includes(n - 1));
    if (n + 1 <= 20) assert.ok(counts.includes(n + 1));
    if (n >= 11) assert.ok(counts.includes(n - 10));
    const correct = options.find((option) => option.id === problem.answer)!;
    assert.match(correct.label, new RegExp(`shows ${n} counter`));
    assert.equal(correct.label.includes("loose"), false);
    if (n + 1 <= 20) {
      const tooMany = options.find((option) =>
        option.label.includes(`shows ${n + 1} counter`),
      )!;
      assert.match(problem.choiceFeedback?.[tooMany.id] ?? "", /one too many/);
    }
    assert.ok(!problem.hint.includes(problem.answer));
  }
  for (let n = 1; n <= 20; n++)
    assert.ok((seen.get(n) ?? 0) / 800 >= 0.03, `${n} appears ${seen.get(n)}`);
});

test("the count-out oracle agrees with the generator", () => {
  const oracle = fileURLToPath(
    new URL("../scripts/count_out_objects_math_oracle.py", import.meta.url),
  );
  const ran = spawnSync("python3", [oracle], { encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr);
  const check = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys; from count_out_objects_math_oracle import review_problem, self_test; self_test(); [review_problem(json.loads(line)) for line in sys.stdin]",
    ],
    {
      cwd: fileURLToPath(new URL("../scripts/", import.meta.url)),
      encoding: "utf8",
      input: Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(generateCountOutObjects("count-out-objects", `oracle-${i}`)),
      ).join("\n"),
    },
  );
  assert.equal(check.status, 0, check.stderr);
});

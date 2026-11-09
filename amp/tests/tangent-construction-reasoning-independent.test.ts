import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const ids = ["tangent-construct-steps", "tangent-construct-justify"];

test("the independent oracle recomputes every tangent-construction item from its figure", () => {
  const cases = ids.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
import tangent_construction_reasoning_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    expected = central['FAMILY_ORACLE_FOR'][template].review_problem(problem)
    assert expected == problem['answer'], (template, public['seed'], expected, problem['answer'])
    assert central['solve'](public) == problem['answer'], (template, public['seed'])
    by.setdefault((template, problem['variant']['id']), problem)
rejected = 0
def reject(problem, change):
    global rejected
    problem = copy.deepcopy(problem)
    change(problem)
    try:
        got = central['FAMILY_ORACLE_FOR'][problem['public']['templateId']].review_problem(problem)
    except (ValueError, KeyError, TypeError, StopIteration, IndexError):
        rejected += 1
        return
    assert got != problem['answer'], 'Corrupt case accepted: ' + problem['public']['seed']
    rejected += 1
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
def move_p(p):
    for e in p['public']['figure']['scene']['elements']:
        if e.get('id') in ('pp', 'np'):
            e['at'] = [e['at'][0] + 0.5, e['at'][1] + 0.25]
def duplicate_option(p):
    opts = p['public']['response']['options']
    opts[1]['label'] = opts[0]['label']
moved = 0
for (template, variant), problem in sorted(by.items()):
    reject(problem, other_option)
    reject(problem, duplicate_option)
    # Moving P breaks a figure that drew something from P: T, A or Cara's line.
    texts = {e.get('text') for e in problem['public']['figure']['scene']['elements']}
    if 'T' in texts or 'A' in texts or variant == 'find-flaw-cara':
        reject(problem, move_p)
        moved += 1
print({'cases': len(cases), 'variants': len(by), 'moved': moved, 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 512/);
  const m = /'variants': (\d+), 'moved': (\d+), 'rejected': (\d+)/.exec(
    result.stdout,
  )!;
  assert.equal(Number(m[3]), 2 * Number(m[1]) + Number(m[2]));
  assert.ok(Number(m[2]) >= 8, "Most variants draw something from P");
});

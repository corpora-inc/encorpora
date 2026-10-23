import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateSlopeTriangleStatementsProblem } from "../src/math/slope-triangle-statements.js";

test("slope-triangle claims agree with independent public coordinate geometry", () => {
  const cases = Array.from({ length: 256 }, (_, i) =>
    generateSlopeTriangleStatementsProblem(`independent-${i}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import sys,json,importlib.util,collections,copy,re
sys.path.insert(0,'scripts')
import slope_triangle_math_oracle as oracle
spec=importlib.util.spec_from_file_location('central','scripts/independent-math-review.py')
central=importlib.util.module_from_spec(spec);spec.loader.exec_module(central)
print(oracle.self_test())
counts=collections.Counter();truths=collections.defaultdict(set)
for problem in json.load(sys.stdin):
    public=problem['public']
    assert public['templateId'] in central.SUPPORTED
    assert oracle.review_problem(problem)==central.solve(public)
    if not counts:
        for pattern in [r'([A-Z]{2}=)(\\d+)',r'([A-Z]{2}\\^2=)(\\d+)',r'(signed rise/run [$]?-?\\d+/\\d+=)(-?\\d+)']:
            bad=copy.deepcopy(problem)
            for index,step in enumerate(bad['explanation']):
                if re.search(pattern,step):
                    bad['explanation'][index]=re.sub(pattern,lambda m:m[1]+str(int(m[2])+1),step,count=1)
                    break
            assert bad!=problem, 'Mutation must change arithmetic'
            try: oracle.review_problem(bad)
            except ValueError: pass
            else: raise AssertionError('Accepted false explanation arithmetic')
    points,triangles=oracle.public_geometry(public)
    counts['congruent' if oracle.congruent(points,*triangles) else 'noncongruent']+=1
    counts['positive' if oracle.slope(points[triangles[0][0]],points[triangles[0][2]])>0 else 'negative']+=1
    for option in public['response']['options']:
        kind,truth=oracle.evaluate_claim(option['label'],points,triangles)
        truths[kind].add(truth)
        if option["label"].startswith("The slopes of "):
            counts["relational_equal" if truth else "relational_unequal"]+=1
        elif kind=="slope":
            counts["numeric_slope"]+=1
    bad=copy.deepcopy(problem)
    bad['explanation'][0]=bad['explanation'][0].replace('True:', 'WRONG:').replace('False:','WRONG:')
    try: oracle.review_problem(bad)
    except ValueError: pass
    else: raise AssertionError('Accepted explanation truth corruption')
assert all(counts[key]>0 for key in ['congruent','noncongruent','positive','negative','relational_equal','relational_unequal','numeric_slope'])
assert len(truths)==6 and all(value=={True,False} for value in truths.values())
print(dict(counts))
`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /noncongruent/);
});

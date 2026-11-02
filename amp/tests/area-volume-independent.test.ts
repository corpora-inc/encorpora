import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("area and volume authored wording passes independent content and corruption review", () => {
  const checked = spawnSync("python3", ["-c", String.raw`
import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
runpy.run_path('scripts/independent-math-review.py')
import area_volume_math_oracle as r
data = r.content()
report = r.review_area_volume_content(data)
mutants = r.review_content_mutations(data)
lessons = {lesson['id']: lesson for lesson in data['lessons']}
for template, old, new in [
    ('triangle-area-base-height', '13 centimeters', '12 centimeters'),
    ('triangle-area-base-height', '12 centimeters', '12 meters'),
    ('unit-fraction-cube-packing', r'\tfrac{1}{2}', r'\tfrac{2}{3}'),
    ('unit-fraction-cube-packing', 'in cubic feet.', 'in square feet.'),
    ('composite-area', 'top is 6', 'top is 11'),
    ('composite-area', 'at the top right', 'at the bottom left'),
    ('composite-face-prism-volume', 'in cubic centimeters', 'in square centimeters'),
    ('composite-face-prism-surface-area', 'right side is 2', 'right side is 7'),
]:
    prompt = lessons[template]['workedExample']['prompt']
    assert old in prompt, (template, old)
    try:
        r.solve_worked(template, prompt.replace(old, new))
    except ValueError:
        continue
    raise AssertionError(f'Corrupted worked prompt accepted: {template}: {old} -> {new}')
bad = copy.deepcopy(data)
bad['lessons'][0]['workedExample']['prompt'] = 'Missing dimensions.'
try:
    r.review_area_volume_content(bad)
except ValueError as error:
    assert 'Worked example triangle-area-base-height:' in str(error), str(error)
    assert "prompt='Missing dimensions.'" in str(error), str(error)
else:
    raise AssertionError('Malformed worked example accepted')
print(json.dumps({'content': report, 'mutants': mutants}))
`], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(checked.status, 0, checked.stderr || String(checked.error));
  const result = JSON.parse(checked.stdout.trim().split("\n").at(-1)!);
  assert.equal(result.content.lessons, 10);
  assert.equal(result.content.worksheets, 80);
  assert.equal(result.content.figureLinks, 7);
  assert.ok(result.content.checkedEqualities > 0);
  assert.ok(result.mutants >= 23);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { distinctWorksheet } from "../src/content/distinct-worksheet";
import { linearFunctionLessons } from "../src/content/linear-function-lessons";
import { publicationHtml } from "../src/content/publications";

const lesson = linearFunctionLessons.find(
  (item) => item.id === "linear-models",
)!;
const templateId = "linear-initial-value-meaning";

function exercises(html: string) {
  return [
    ...html.matchAll(/<section class="exercise">([\s\S]*?)<\/section>/g),
  ].map((match) => match[1]!);
}

test("the shared model workbook and solutions print twelve distinct initial-value cases", () => {
  const edition = "3"; // Ordinary sequential seeds repeat one problem in this edition.
  const expected = distinctWorksheet(templateId, lesson.id, edition);
  const start = lesson.templateIds.indexOf(templateId) * 12;
  assert(start >= 0);
  const workbook = exercises(publicationHtml(lesson, "workbook", edition));
  const solutions = exercises(publicationHtml(lesson, "solutions", edition));
  assert.equal(workbook.length, lesson.templateIds.length * 12);
  assert.equal(solutions.length, workbook.length);
  const printed = workbook.slice(start, start + 12);
  const solved = solutions.slice(start, start + 12);
  const headings = printed.map((section) =>
    section.match(/<h2>([\s\S]*?)<\/h2>/)![1]!.replace(/^\d+\.\s*/, ""),
  );
  assert.equal(new Set(headings).size, 12);
  expected.forEach((problem, index) => {
    assert.match(printed[index]!, /What does the number/);
    assert.match(solved[index]!, /What does the number/);
    assert.equal(problem.public.response.kind, "choice");
    if (problem.public.response.kind !== "choice") return;
    for (const option of problem.public.response.options)
      assert(printed[index]!.includes(option.label));
    const answer = problem.public.response.options.find(
      (option) => option.id === problem.answer,
    )!.label;
    assert(solved[index]!.includes(`<strong>Answer: ${answer}</strong>`));
  });
});

test(
  "the independent content reviewer checks every sheet and rejects mutations",
  {
    timeout: 120_000,
  },
  () => {
    const output = execFileSync(
      "python3",
      [
        "-c",
        `import importlib.util, sys
sys.path.insert(0, 'scripts')
spec = importlib.util.spec_from_file_location('central_math_review', 'scripts/independent-math-review.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
import copy
from linear_function_math_oracle import content, review_linear_function_content
data = content()
first = next(sheet for sheet in data['worksheets'] if sheet['templateId'] == 'linear-initial-value-meaning')
data['worksheets'].remove(first)
data['worksheets'].insert(0, first)
summary = review_linear_function_content(data)
assert summary['worksheets'] == 96, summary
missing = copy.deepcopy(data)
missing['worksheets'] = [sheet for sheet in missing['worksheets'] if sheet['templateId'] != 'linear-initial-value-meaning']
wrong = copy.deepcopy(data)
wrong['worksheets'][0]['problems'][0]['answer'] = 'wrong-choice'
for mutant in (missing, wrong):
    try:
        review_linear_function_content(mutant)
    except (ValueError, AssertionError):
        pass
    else:
        raise AssertionError('Content mutant accepted')
print(summary['worksheets'])`,
      ],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
        timeout: 115_000,
      },
    );
    assert.equal(output.trim(), "96");
  },
);

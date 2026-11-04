import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { layoutScene } from "../src/math/scene";
import type { Element } from "../src/math/scene/spec";
import type { GeneratedProblem } from "../src/math/contracts";

const ids = [
  "multiply-two-digit",
  "quotient-remainder-one-digit",
  "factor-pairs-select",
  "multiples-select",
  "facts-to-twelve",
  "growing-shape-pattern",
] as const;

const factorsOf = (n: number) => {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++)
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  return out.sort((a, b) => a - b);
};

const nums = (text: string) =>
  [...text.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, "")));
const bareThousands = /(?<![\d,])\d{4,}(?!\d)/;
const learnerText = (problem: GeneratedProblem) => {
  const chunks = [problem.public.prompt, problem.hint, ...problem.explanation];
  if (problem.choiceFeedback)
    chunks.push(...Object.values(problem.choiceFeedback));
  const response = problem.public.response;
  if (response.kind === "choice" || response.kind === "multi-select")
    chunks.push(...response.options.map((option) => option.label));
  if (response.kind === "multi-part-choice") {
    for (const blank of response.blanks)
      chunks.push(...blank.options.map((option) => option.label));
    for (const part of response.sentence ?? [])
      if ("text" in part) chunks.push(part.text);
  }
  return chunks.join("\n");
};

test("grade-4 operation types are registered once", () => {
  for (const id of ids) {
    assert.equal(templates.filter((t) => t.id === id).length, 1);
    assert.ok(templateArchetypes[id]?.length, id);
    assert.ok(
      actualFacetMappings.some((m) => m.templateId === id),
      id,
    );
    const problem = generateProblem(id, "lesson");
    assert.ok(
      problemLesson(id, problem.public.seed, problem.public.prompt).method
        .length >= 2,
    );
  }
});

test("two hundred seeds match an independent calculation", () => {
  const seen = Object.fromEntries(
    ids.map((id) => [id, new Set<string>()]),
  ) as Record<(typeof ids)[number], Set<string>>;
  for (const id of ids)
    for (let seed = 0; seed < 200; seed++) {
      const problem = generateProblem(id, `g4:${seed}`);
      assert.deepEqual(problem, generateProblem(id, `g4:${seed}`));
      assert.ok(gradeAnswer(problem, problem.answer), id);
      const prompt = problem.public.prompt;
      assert.equal(bareThousands.test(learnerText(problem)), false, id);
      seen[id].add(problem.variant?.id ?? "");
      if (id === "multiply-two-digit") {
        const [a, b] = nums(prompt);
        assert.equal(Number(problem.answer), a! * b!);
        assert.ok(a! <= 999 && b! <= 999);
        assert.equal(/area model|rows of/.test(prompt), false);
      } else if (id === "facts-to-twelve") {
        const [a, b] = nums(prompt);
        if (
          prompt.includes("×") ||
          prompt.includes(" in each ") ||
          prompt.includes(" a week for ") ||
          prompt.includes(" on each ")
        ) {
          assert.ok(a === 11 || a === 12 || b === 11 || b === 12);
          assert.equal(Number(problem.answer), a! * b!);
        } else {
          assert.ok(b === 11 || b === 12);
          assert.equal(a! % b!, 0);
          assert.equal(Number(problem.answer), a! / b!);
        }
      } else if (id === "growing-shape-pattern") {
        const start = Number(prompt.match(/starts with (\d+)/)![1]);
        const add = Number(prompt.match(/adds (\d+)/)![1]);
        const step = Number(prompt.match(/step (\d+)\?/)![1]);
        assert.ok(step >= 5);
        assert.equal(Number(problem.answer), start! + (step! - 1) * add!);
        const figure = problem.public.figure;
        assert.equal(figure?.kind, "scene");
        if (figure?.kind !== "scene") continue;
        assert.ok((figure.scene.width ?? 360) <= 720);
        assert.ok((figure.scene.maxHeight ?? 320) <= 720);
        assert.equal(
          figure.scene.elements.some((element) => element.type === "lineTable"),
          false,
        );
        for (const shown of [1, 2, 3]) {
          const rows: Element[] = figure.scene.elements.filter(
            (element) =>
              element.type === "array" &&
              Boolean(element.id?.startsWith(`s${shown}r`)),
          );
          assert.equal(rows.length, shown);
          let count = 0;
          for (const row of rows) {
            if (row.type !== "array") continue;
            assert.equal(row.rows, 1);
            assert.ok(row.columns <= 20);
            const index = Number(row.id?.slice(`s${shown}r`.length));
            assert.equal(row.columns, index === 0 ? start : add);
            count += row.columns;
          }
          assert.equal(count, start! + (shown - 1) * add!);
        }
        assert.equal(
          figure.scene.elements.some(
            (element) =>
              element.type === "array" && /^s[4-9]/.test(element.id ?? ""),
          ),
          false,
        );
        const layout = layoutScene(figure.scene);
        assert.deepEqual(layout.dropped, []);
        const tiles = layout.items.filter((item) => item.k === "rect");
        const labels = layout.items.filter((item) => item.k === "text");
        assert.equal(
          tiles.length,
          start! + (start! + add!) + (start! + 2 * add!),
        );
        assert.equal(labels.length, 3);
        for (const label of labels)
          for (const tile of tiles)
            assert.equal(
              label.box.x0 < tile.x + tile.w &&
                tile.x < label.box.x1 &&
                label.box.y0 < tile.y + tile.h &&
                tile.y < label.box.y1,
              false,
              label.plain,
            );
      } else if (id === "quotient-remainder-one-digit") {
        const [dividend, divisor] = nums(prompt);
        assert.ok(
          dividend! >= 100 &&
            dividend! <= 9999 &&
            divisor! >= 2 &&
            divisor! <= 9,
        );
        const q = Math.floor(dividend! / divisor!);
        const rem = dividend! - q * divisor!;
        assert.ok(rem > 0 && rem < divisor!);
        const response = problem.public.response;
        assert.equal(response.kind, "multi-part-choice");
        if (response.kind !== "multi-part-choice") continue;
        const key = JSON.parse(problem.answer) as Record<string, string>;
        const label = (blankId: string) =>
          response.blanks
            .find((b) => b.id === blankId)!
            .options.find((o) => o.id === key[blankId])!
            .label.replace(/,/g, "");
        assert.equal(Number(label("q")), q);
        if (prompt.includes("fraction"))
          assert.equal(Number(label("num")), rem);
        else assert.equal(Number(label("r")), rem);
        assert.equal(q * divisor! + rem, dividend);
      } else if (id === "factor-pairs-select") {
        const n = nums(prompt)[0]!;
        assert.ok(n >= 2 && n <= 144);
        const response = problem.public.response;
        assert.equal(response.kind, "multi-select");
        if (response.kind !== "multi-select") continue;
        const keyed = new Set(JSON.parse(problem.answer) as string[]);
        const selected = response.options
          .filter((o) => keyed.has(o.id))
          .map((o) => Number(o.label))
          .sort((a, b) => a - b);
        assert.deepEqual(selected, factorsOf(n));
        assert.ok(response.options.some((o) => !keyed.has(o.id)));
        assert.equal(
          new Set(response.options.map((o) => o.label)).size,
          response.options.length,
        );
      } else {
        const d = nums(prompt)[0]!;
        const response = problem.public.response;
        assert.equal(response.kind, "multi-select");
        if (response.kind !== "multi-select") continue;
        const keyed = new Set(JSON.parse(problem.answer) as string[]);
        assert.equal(
          new Set(response.options.map((o) => o.label)).size,
          response.options.length,
        );
        for (const option of response.options) {
          const value = Number(option.label);
          const multiple = value % d === 0;
          assert.equal(keyed.has(option.id), multiple, `${value} of ${d}`);
          if (!multiple)
            assert.ok(
              response.options.some(
                (other) =>
                  Math.abs(Number(other.label) - value) === 1 &&
                  keyed.has(other.id),
              ),
            );
        }
      }
    }
  assert.ok(seen["multiply-two-digit"].has("2x2"));
  assert.ok(seen["multiply-two-digit"].has("3x2"));
  assert.ok(seen["multiply-two-digit"].has("square"));
  assert.ok(seen["facts-to-twelve"].has("multiply"));
  assert.ok(seen["facts-to-twelve"].has("divide"));
  assert.ok(seen["factor-pairs-select"].has("to-100"));
  assert.ok(seen["factor-pairs-select"].has("to-144"));
  assert.ok([...seen["quotient-remainder-one-digit"]].length >= 1);
});

test("facts through 12 use a different prompt on every book seed", () => {
  const prompts = Array.from(
    { length: 12 },
    (_, i) => generateProblem("facts-to-twelve", `book-${i}`).public.prompt,
  );
  assert.equal(new Set(prompts).size, prompts.length, prompts.join("\n"));
  const teams = prompts.filter((prompt) =>
    prompt.includes("players form equal teams"),
  );
  assert.ok(teams.length <= 1);
});

const BARE_PRODUCT =
  /^(?:What is \d[\d,]* × \d[\d,]*\?|Find the product of \d[\d,]* and \d[\d,]*\.|Multiply \d[\d,]* by \d[\d,]*\.)$/;

/** Group count, then the number in each group. Both ends are inclusive. */
const PRODUCT_STORIES: {
  pattern: RegExp;
  groups: [number, number];
  each: [number, number];
}[] = [
  {
    pattern: /^The stadium has (\d[\d,]*) rows with (\d[\d,]*) seats /,
    groups: [20, 99],
    each: [10, 40],
  },
  {
    pattern: /^The theater has (\d[\d,]*) rows with (\d[\d,]*) seats /,
    groups: [10, 40],
    each: [12, 30],
  },
  {
    pattern: /^The orchard has (\d[\d,]*) rows with (\d[\d,]*) trees /,
    groups: [10, 60],
    each: [10, 40],
  },
  {
    pattern: /^The school sends (\d[\d,]*) buses with (\d[\d,]*) riders /,
    groups: [10, 30],
    each: [30, 60],
  },
  {
    pattern: /^The food drive packs (\d[\d,]*) boxes with (\d[\d,]*) cans /,
    groups: [10, 99],
    each: [12, 24],
  },
  {
    pattern: /^The farm plants (\d[\d,]*) rows with (\d[\d,]*) plants /,
    groups: [20, 99],
    each: [20, 80],
  },
  {
    pattern: /^The farm plants (\d[\d,]*) rows with (\d[\d,]*) corn plants /,
    groups: [100, 240],
    each: [24, 60],
  },
  {
    pattern: /^The book has (\d[\d,]*) pages with (\d[\d,]*) lines /,
    groups: [20, 96],
    each: [16, 32],
  },
  {
    pattern: /^The novel has (\d[\d,]*) pages with (\d[\d,]*) lines /,
    groups: [100, 240],
    each: [22, 36],
  },
  {
    pattern: /^A page of the book has (\d[\d,]*) lines with (\d[\d,]*) words /,
    groups: [12, 32],
    each: [8, 12],
  },
  {
    pattern: /^The factory packs (\d[\d,]*) cases with (\d[\d,]*) bottles /,
    groups: [100, 480],
    each: [12, 24],
  },
  {
    pattern: /^The class bakes (\d[\d,]*) trays with (\d[\d,]*) cookies /,
    groups: [12, 18],
    each: [12, 24],
  },
  {
    pattern: /^The class plants (\d[\d,]*) rows with (\d[\d,]*) seedlings /,
    groups: [12, 16],
    each: [8, 12],
  },
  {
    pattern: /^[A-Z][a-z]+ fills (\d[\d,]*) pages with (\d[\d,]*) stamps /,
    groups: [12, 20],
    each: [12, 16],
  },
  {
    pattern: /^The school orders (\d[\d,]*) boxes with (\d[\d,]*) crayons /,
    groups: [12, 40],
    each: [12, 24],
  },
  {
    pattern: /^The school orders (\d[\d,]*) cartons with (\d[\d,]*) notebooks /,
    groups: [12, 24],
    each: [10, 20],
  },
  {
    pattern:
      /^The school gym sets out (\d[\d,]*) bins with (\d[\d,]*) tennis balls /,
    groups: [12, 16],
    each: [12, 18],
  },
  {
    pattern: /^The shop sets out (\d[\d,]*) packs with (\d[\d,]*) cards /,
    groups: [12, 24],
    each: [10, 12],
  },
  {
    pattern: /^The farm packs (\d[\d,]*) cartons with (\d[\d,]*) eggs /,
    groups: [12, 48],
    each: [12, 12],
  },
];

test("two-digit stories are used only when both factors fit", () => {
  let bare = 0;
  let stories = 0;
  for (let i = 0; i < 400; i++) {
    const prompt = generateProblem("multiply-two-digit", `fit-${i}`).public
      .prompt;
    if (BARE_PRODUCT.test(prompt)) {
      bare++;
      continue;
    }
    const story = PRODUCT_STORIES.find((item) => item.pattern.test(prompt));
    assert.ok(story, prompt);
    const match = story!.pattern.exec(prompt)!;
    const groups = Number(match[1]!.replace(/,/g, ""));
    const each = Number(match[2]!.replace(/,/g, ""));
    assert.ok(groups >= story!.groups[0] && groups <= story!.groups[1], prompt);
    assert.ok(each >= story!.each[0] && each <= story!.each[1], prompt);
    stories++;
  }
  assert.ok(bare > stories, `${bare} bare, ${stories} stories`);
  assert.ok(stories >= 15, `${stories} stories`);
});

test("twelve growing-shape seeds use eight or more contexts", () => {
  const titles = Array.from({ length: 12 }, (_, i) => {
    const figure = generateProblem("growing-shape-pattern", `book-${i}`).public
      .figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") return "";
    return figure.scene.title ?? "";
  });
  assert.ok(new Set(titles).size >= 8, titles.join("\n"));
  const frames = new Set(
    Array.from({ length: 12 }, (_, i) => {
      const prompt = generateProblem("growing-shape-pattern", `book-${i}`)
        .public.prompt;
      if (prompt.includes("Each next step adds")) return "each-next";
      if (prompt.includes("Each new step adds")) return "each-new";
      if (prompt.includes("and each next step adds")) return "and-each-next";
      if (prompt.includes("After step 1, each step adds")) return "after-step";
      return prompt;
    }),
  );
  assert.equal(frames.size, 4, [...frames].join("\n"));
  const byTitle = new Map<string, Set<string>>();
  for (let i = 0; i < 80; i++) {
    const problem = generateProblem("growing-shape-pattern", `name-${i}`);
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    const title = figure.scene.title ?? "";
    const name = problem.public.prompt.split(" ")[0] ?? "";
    if (!byTitle.has(title)) byTitle.set(title, new Set());
    byTitle.get(title)!.add(name);
  }
  assert.ok([...byTitle.values()].some((names) => names.size >= 2));
});

test("one-digit quotients use a container that can hold that many", () => {
  const bad =
    /coolers that hold|players into teams|bin holds exactly|shelves that hold|cups of|inches of ribbon|magazines into bundles/;
  for (let i = 0; i < 40; i++) {
    const prompt = generateProblem("quotient-remainder-one-digit", `book-${i}`)
      .public.prompt;
    assert.equal(bad.test(prompt), false, prompt);
  }
});

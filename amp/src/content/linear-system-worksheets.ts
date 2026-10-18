import { createHash } from "node:crypto";
import { linearSystemPrintCase } from "../math/linear-system-practice";
import type { GeneratedProblem } from "../math/contracts";

type Candidate = ReturnType<typeof linearSystemPrintCase>;

/** A worksheet's required edge cases must not favor conspicuous answer choices.
 * Each feature contributes 4 × (correct choice has feature) − matching choices.
 * Zero is the chance baseline. Integer twelfths make coordinate comparisons exact.
 */
function choiceFeatures(candidate: Candidate): number[] {
  const { response } = candidate.problem.public;
  if (response.kind !== "choice")
    throw new Error("Expected ordered-pair choices");
  const points = response.options.map(({ label }) => {
    const coordinates = label.slice(1, -1).split(", ");
    return coordinates.map((coordinate) => {
      const [n, d = "1"] = coordinate.replaceAll("−", "-").split("/");
      return { value: (Number(n) * 12) / Number(d), fraction: d !== "1" };
    });
  });
  const answer = response.options.findIndex(
    (option) => option.id === candidate.problem.answer,
  );
  const feature = (matches: boolean[]) =>
    4 * Number(matches[answer]) - matches.filter(Boolean).length;
  const x = points.map((p) => p[0]!.value),
    y = points.map((p) => p[1]!.value);
  const zeroCount = points.map((p) => p.filter((v) => v.value === 0).length);
  // Letter positions are independently shuffled by the generator. Do not impose
  // equal letter counts: those would reveal the last answer from earlier ones.
  const result: number[] = [];
  for (const matches of [
    points.map((_, i) => x[i] === 0 && y[i] === 0),
    x.map((v) => v === 0),
    y.map((v) => v === 0),
    zeroCount.map((count) => count > 0),
  ])
    result.push(feature(matches));
  for (const values of [
    x,
    y,
    points.map((_, i) => Math.abs(x[i]!) + Math.abs(y[i]!)),
    points.map((p) => p.filter((v) => v.fraction).length),
    zeroCount,
    points.map((p) => p.filter((v) => v.value < 0).length),
  ]) {
    for (const extreme of [Math.min(...values), Math.max(...values)])
      result.push(feature(values.map((value) => value === extreme)));
  }
  return result;
}

function balanceChoices(
  selected: Candidate[],
  pool: Candidate[],
  requirements: string[][],
): void {
  const mask = (c: Candidate) =>
    requirements.reduce(
      (bits, tags, i) =>
        bits | (tags.every((tag) => c.tags.includes(tag)) ? 1 << i : 0),
      0,
    );
  const data = new Map(
    pool.map((c) => [c, { mask: mask(c), features: choiceFeatures(c) }]),
  );
  const all = (1 << requirements.length) - 1;
  const sum = selected.reduce(
    (total, c) => total.map((v, i) => v + data.get(c)!.features[i]!),
    new Array<number>(data.get(selected[0]!)!.features.length).fill(0),
  );
  const loss = (values: number[]) =>
    values.reduce((total, value) => total + value * value, 0);
  let score = loss(sum);
  // Bounded local improvements preserve every instructional quota and the exact
  // origin balance. All candidates remain unmodified ordinary generator output.
  for (let pass = 0; pass < 12; pass++) {
    let replacement:
      { index: number; candidate: Candidate; totals: number[] } | undefined;
    let best = score;
    for (let index = 0; index < selected.length; index++) {
      const old = selected[index]!,
        oldData = data.get(old)!;
      const others = selected.filter((_, i) => i !== index);
      const used = new Set(others.map((c) => c.systemKey));
      const covered = others.reduce((bits, c) => bits | data.get(c)!.mask, 0);
      for (const candidate of pool) {
        const current = data.get(candidate)!;
        if (
          used.has(candidate.systemKey) ||
          (covered | current.mask) !== all ||
          ["origin", "origin-option"].some(
            (tag) => candidate.tags.includes(tag) !== old.tags.includes(tag),
          )
        )
          continue;
        const totals = sum.map(
          (v, i) => v - oldData.features[i]! + current.features[i]!,
        );
        const next = loss(totals);
        if (next < best) {
          best = next;
          replacement = { index, candidate, totals };
        }
      }
    }
    if (!replacement) break;
    selected[replacement.index] = replacement.candidate;
    sum.splice(0, sum.length, ...replacement.totals);
    score = best;
  }
}

/** An origin exercise must not make the origin option a reliable answer cue. */
function pairSelection(
  templateId: string,
  lessonId: string,
  edition: string,
  requirements: string[][],
): GeneratedProblem[] {
  const pool: Candidate[] = [];
  for (const targetSize of [1024, 2048, 4096]) {
    while (pool.length < targetSize)
      pool.push(
        linearSystemPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${pool.length}`,
        ),
      );
    const selected: Candidate[] = [],
      systems = new Set<string>();
    let remaining = [...requirements];
    const take = (eligible: (c: Candidate) => boolean): boolean => {
      let candidate: Candidate | undefined,
        best = -1;
      for (const c of pool) {
        if (systems.has(c.systemKey) || !eligible(c)) continue;
        const score = remaining.filter((required) =>
          required.every((tag) => c.tags.includes(tag)),
        ).length;
        if (score > best) {
          best = score;
          candidate = c;
        }
      }
      if (!candidate) return false;
      selected.push(candidate);
      systems.add(candidate.systemKey);
      remaining = remaining.filter(
        (required) => !required.every((tag) => candidate!.tags.includes(tag)),
      );
      return true;
    };
    if (!take((c) => c.tags.includes("origin"))) continue;
    // Exactly four questions display the origin: once as the answer and three
    // times as a distractor. Overlapping coverage frees these slots without
    // dropping quadrants, non-origin axes, fractional coordinates, or scaling.
    let originsBalanced = true;
    for (let i = 0; i < 3; i++)
      if (
        !take(
          (c) => c.tags.includes("origin-option") && !c.tags.includes("origin"),
        )
      )
        originsBalanced = false;
    if (!originsBalanced) continue;
    while (selected.length < 12 && remaining.length) {
      if (
        !take(
          (c) =>
            !c.tags.includes("origin-option") &&
            remaining.some((required) =>
              required.every((tag) => c.tags.includes(tag)),
            ),
        )
      )
        break;
    }
    if (remaining.length) continue;
    while (selected.length < 12)
      if (!take((c) => !c.tags.includes("origin-option"))) break;
    if (selected.length === 12) {
      balanceChoices(selected, pool, requirements);
      return selected.map((c) => c.problem);
    }
  }
  throw new Error(
    "Cannot fill a representative, origin-balanced system worksheet",
  );
}

/** Select from ordinary generation, then order independently of outcome and selection quota. */
export function linearSystemWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const requirements =
    templateId === "linear-system-pair"
      ? [
          ["quadrant:1"],
          ["quadrant:2"],
          ["quadrant:3"],
          ["quadrant:4"],
          ["x-axis"],
          ["y-axis"],
          ["origin"],
          ["fractional-coordinates:0"],
          ["fractional-coordinates:1"],
          ["fractional-coordinates:2"],
          ["axis-aligned"],
          ["scale-both"],
        ]
      : [
          ["unique", "axis-aligned"],
          ["unique", "scale-both"],
          ["unique", "fractional-coordinates:1"],
          ["unique", "fractional-coordinates:2"],
          ["none", "negative-proportionality", "vertical"],
          ["none", "negative-proportionality", "horizontal"],
          ["none", "negative-proportionality", "oblique"],
          ["none", "positive-proportionality", "oblique"],
          ["infinite", "duplicate-equations"],
          [
            "infinite",
            "differently-written",
            "negative-proportionality",
            "oblique",
          ],
          ["infinite", "vertical"],
          ["infinite", "horizontal"],
        ];
  const pool: Candidate[] = [],
    selected: GeneratedProblem[] =
      templateId === "linear-system-pair"
        ? pairSelection(templateId, lessonId, edition, requirements)
        : [];
  const systems = new Set<string>();
  let counter = 0;
  for (const required of templateId === "linear-system-pair"
    ? []
    : requirements) {
    let candidate: ReturnType<typeof linearSystemPrintCase> | undefined;
    while (!candidate) {
      candidate = pool.find(
        (c) =>
          !systems.has(c.systemKey) &&
          required.every((tag) => c.tags.includes(tag)),
      );
      if (candidate) break;
      if (counter >= 4096)
        throw new Error(
          `Cannot fill representative linear-system worksheet: ${templateId}`,
        );
      pool.push(
        linearSystemPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${counter++}`,
        ),
      );
    }
    systems.add(candidate.systemKey);
    selected.push(candidate.problem);
  }
  return selected
    .map((problem) => ({
      problem,
      order: createHash("sha256")
        .update(
          JSON.stringify([
            "linear-system-sheet-order",
            templateId,
            lessonId,
            edition,
            problem.public.seed,
          ]),
        )
        .digest("hex"),
    }))
    .sort(
      (a, b) =>
        a.order.localeCompare(b.order) ||
        a.problem.public.id.localeCompare(b.problem.public.id),
    )
    .map(({ problem }) => problem);
}

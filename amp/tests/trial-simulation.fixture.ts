import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import { estimateFrontier } from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { generateProblem, templates } from "../src/math/engine";
import { guessChanceOf } from "../src/math/guess-chance";
import { skills } from "../src/curriculum/catalog";
import type { Outcome } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
const october = Date.parse("2026-10-19T12:00:00Z");

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - tail : tail;
}
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 0x100000000;
}

export type ServedItem = {
  templateId: string;
  skillId: string;
  strand: string;
  reason: string;
  prompt: string;
  correct: boolean;
};

/** One free trial as the app runs it: one problem per request, the last 12
 * answers as recent history, persisted skill evidence and the full-history
 * frontier, `count` answers about forty seconds apart. */
export function simulateTrial(options: {
  level: number;
  start: number;
  key: string;
  count?: number;
}): ServedItem[] {
  const attempts: Outcome[] = [];
  const served: ServedItem[] = [];
  for (let i = 0; i < (options.count ?? 100); i++) {
    const at = october + i * 40000;
    const frontier = estimateFrontier({
      start: options.start,
      observations: attempts,
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
      now: at,
    });
    const [choice] = planMixedPractice({
      templates,
      skills,
      attempts: attempts.slice(-12),
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 1,
      seed: `${options.key}:${i}`,
      now: at,
      learnerKey: options.key,
    });
    const template = choice!.template;
    const problem = generateProblem(template.id, `${options.key}:${i}`).public;
    const guess =
      problem.response.kind === "choice"
        ? 1 / problem.response.options.length
        : 0.03;
    const difficulty = gradeOf(template.id) - 0.4 + (hash(template.id) - 0.5);
    const knows = normalCdf((options.level - difficulty) / 0.8);
    const correct =
      hash(`${options.key}:${template.id}:${i}`) <
      guess + (1 - guess - 0.03) * knows;
    attempts.push({
      id: `${options.key}:${i}`,
      problemId: `${options.key}:p${i}`,
      requestId: `${options.key}:r${i}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "",
      correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt: new Date(at).toISOString(),
    });
    served.push({
      templateId: template.id,
      skillId: template.skillId,
      strand: choice!.strand,
      reason: choice!.reason,
      prompt: problem.prompt,
      correct,
    });
  }
  return served;
}

/** The attempts behind a simulated run, as the repository would return
 * them, and the time of its last answer. */
export function runAttempts(key: string, served: readonly ServedItem[]) {
  const attempts: Outcome[] = served.map((item, i) => ({
    id: `${key}:${i}`,
    problemId: `${key}:p${i}`,
    requestId: `${key}:r${i}`,
    skillId: item.skillId,
    templateId: item.templateId,
    response: "",
    correct: item.correct,
    assisted: false,
    explanation: [],
    answer: "",
    createdAt: new Date(october + i * 40000).toISOString(),
  }));
  return { attempts, last: october + (served.length - 1) * 40000 };
}

/** Learners whose age puts them in grades 6–8, from a grade and a half
 * below to two grades above that level. */
export function trialLearners(seeds = 8) {
  const learners: { level: number; start: number; key: string }[] = [];
  for (const start of [6, 7, 8])
    for (const offset of [-1.5, -0.5, 0.5, 2])
      for (let seed = 1; seed <= seeds; seed++)
        learners.push({
          start,
          level: start + offset,
          key: `trial:${start}:${offset}:${seed}`,
        });
  return learners;
}

const support = new Set(["revisit", "prerequisite"]);
/** Variety statistics over many simulated trials. */
export function varietyStats(runs: readonly ServedItem[][]) {
  let pairs = 0,
    backToBack = 0,
    sameSkillBackToBack = 0,
    windows5 = 0,
    repeat5 = 0,
    windows10 = 0,
    over2in10 = 0,
    over2in10Unexcused = 0,
    items = 0,
    powers = 0,
    windows7 = 0,
    triple7 = 0,
    skillTriple7 = 0;
  const strands20: number[] = [];
  const strands100: number[] = [];
  for (const run of runs) {
    items += run.length;
    powers += run.filter((item) => item.templateId === "integer-power").length;
    for (let i = 1; i < run.length; i++) {
      pairs++;
      if (run[i]!.templateId === run[i - 1]!.templateId) backToBack++;
      if (run[i]!.skillId === run[i - 1]!.skillId) sameSkillBackToBack++;
    }
    for (let i = 0; i + 5 <= run.length; i++) {
      windows5++;
      const ids = run.slice(i, i + 5).map((item) => item.templateId);
      if (new Set(ids).size < ids.length) repeat5++;
    }
    for (let i = 0; i + 10 <= run.length; i++) {
      windows10++;
      const window = run.slice(i, i + 10);
      const counts = new Map<string, ServedItem[]>();
      for (const item of window)
        counts.set(item.templateId, [
          ...(counts.get(item.templateId) ?? []),
          item,
        ]);
      const crowded = [...counts.values()].filter((list) => list.length > 2);
      if (crowded.length) over2in10++;
      // Remediation excuses a third appearance only when the repeat was
      // served as support for a miss (a revisit or a prerequisite).
      if (
        crowded.some(
          (list) => list.filter((item) => !support.has(item.reason)).length > 2,
        )
      )
        over2in10Unexcused++;
    }
    for (let i = 0; i + 7 <= run.length; i++) {
      windows7++;
      const window = run.slice(i, i + 7);
      const most = (key: (item: ServedItem) => string) =>
        Math.max(
          ...[...new Set(window.map(key))].map(
            (k) => window.filter((item) => key(item) === k).length,
          ),
        );
      if (most((item) => item.templateId) >= 3) triple7++;
      if (most((item) => item.skillId) >= 3) skillTriple7++;
    }
    strands20.push(new Set(run.slice(0, 20).map((item) => item.strand)).size);
    strands100.push(new Set(run.map((item) => item.strand)).size);
  }
  const mean = (values: number[]) =>
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  const pct = (a: number, b: number) => Math.round((a / b) * 10000) / 100;
  return {
    learners: runs.length,
    items,
    backToBackTemplatePct: pct(backToBack, pairs),
    backToBackSkillPct: pct(sameSkillBackToBack, pairs),
    window5WithRepeatPct: pct(repeat5, windows5),
    window10Over2Pct: pct(over2in10, windows10),
    window10Over2UnexcusedPct: pct(over2in10Unexcused, windows10),
    window7TemplateTriplePct: pct(triple7, windows7),
    window7SkillTriplePct: pct(skillTriple7, windows7),
    integerPowerPerItemPct: pct(powers, items),
    learnersSeeingIntegerPowerPct: pct(
      runs.filter((run) => run.some((i) => i.templateId === "integer-power"))
        .length,
      runs.length,
    ),
    strandsInFirst20: mean(strands20),
    minStrandsInFirst20: Math.min(...strands20),
    strandsIn100: mean(strands100),
  };
}

/** The exponent of a served `integer-power` prompt ("What is $3^{4}$?"). */
export function powerExponent(prompt: string): number | null {
  const match = /\^\{?(\d+)\}?/.exec(prompt);
  return match ? Number(match[1]) : null;
}

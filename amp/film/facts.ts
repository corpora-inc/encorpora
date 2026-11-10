/**
 * Everything an author needs about one problem type: what the lesson says and
 * every variant a learner can meet.
 *   npx tsx film/facts.ts <template-id> [--pick]
 */
import { randomInt } from "node:crypto";
import { templates } from "../src/math/engine";
import { generateProblemFor } from "../src/math/engine";
import { figureCapabilities } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import { skills } from "../src/curriculum/catalog";
import { layoutScene } from "../src/math/scene";
import { templateOf } from "./cast";

const pick = process.argv.includes("--pick");
const filmId = pick ? templates[randomInt(templates.length)]!.id : process.argv[2];
if (!filmId) throw new Error("Usage: npx tsx film/facts.ts <template-id> | --pick");
const { template: id } = templateOf(filmId);
const t = templates.find((x) => x.id === id);
if (!t) throw new Error(`No template ${id}`);
const skill = skills.find((s) => s.id === t.skillId);
const l = problemLesson(id, "film");
const out: Record<string, unknown> = {
  id,
  title: l.title,
  grade: skill?.gradeBand,
  strand: skill?.strand,
  goal: l.goal,
  intuition: l.intuition,
  principle: l.principle,
  terms: l.terms,
  method: l.method,
  watch: l.watch,
  workedExample: { seed: "film", prompt: l.example.prompt, choices: l.example.choices, steps: l.example.steps, answer: l.example.answer },
};
const fig: any = l.example.figure;
if (fig) {
  out.figure = fig.kind === "scene"
    ? { use: '{"figure":{"example":true}}', kind: "scene", parts: layoutScene(fig.scene, { reveal: true }).items.map((d) => d.id).filter(Boolean) }
    : { use: '{"figure":{"example":true}}', kind: fig.kind, note: "Shown as drawn; it has no named parts to animate." };
} else out.figure = "The example has no figure. Build one if a picture helps; many lessons need one.";
// every distinct wording a learner can see, with its worked solution
const seen = new Map<string, unknown>();
for (let i = 0; i < 300 && seen.size < 12; i++) {
  const p = generateProblemFor(id, `film-${i}`, figureCapabilities as any);
  const key = p.public.prompt.replace(/-?\d+(\.\d+)?/g, "#");
  if (seen.has(key)) continue;
  const r: any = p.public.response;
  // Choice problems store an option id; give the author the words the learner sees.
  const options = r.options?.map((o: any) => o.label);
  const answer = r.options ? (r.options.find((o: any) => o.id === p.answer)?.label ?? p.answer) : p.answer;
  seen.set(key, { seed: `film-${i}`, prompt: p.public.prompt, ...(options ? { choices: options } : {}), answer, steps: p.explanation });
}
out.variants = [...seen.values()];
console.log(JSON.stringify(out, null, 2));

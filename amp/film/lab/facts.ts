/** Code-built inputs for the model lab. All generated output belongs outside Git. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { skills } from "../../src/curriculum/catalog";
import type { Skill } from "../../src/curriculum/types";
import { problemLesson, type ProblemLessonView } from "../../src/content/problem-lessons";
import { generateProblemFor, templates } from "../../src/math/engine";
import { figureCapabilities, responseCapabilities, type GeneratedProblem, type SemanticFigure } from "../../src/math/contracts";
import { answerText, parseSelection } from "../../src/math/selection-response";
import { layoutScene } from "../../src/math/scene";
import { MIN_PLAYER_SCALE, sceneOf } from "./player-compat";

type OfficialStandard = {
  code: string; aliases: string[]; text: string; parts: { label: string; text: string }[];
  source: string; [key: string]: unknown;
};

function standardIndex(rows: OfficialStandard[]) {
  const index = new Map<string, OfficialStandard>();
  for (const row of rows) for (const key of [row.code, ...row.aliases]) index.set(key, row);
  return index;
}

function aligned(skill: Skill, index: Map<string, OfficialStandard>) {
  const matched = new Map<string, OfficialStandard>(), unresolved: string[] = [];
  for (const alignment of skill.alignments) {
    const key = alignment.standardId;
    const row = index.get(key) ?? index.get(key.replace(/\.?[a-z]$/, ""));
    if (row) matched.set(row.code, row); else unresolved.push(key);
  }
  return { standards: [...matched.values()], unresolved_alignments: unresolved };
}

function figureInfo(figure: SemanticFigure | undefined) {
  if (!figure) return { kind: "none", components: [] as string[], named_parts: [] as string[], legacy_player_compatible: true };
  const scene = sceneOf(figure);
  if (!scene) return { kind: figure.kind, components: [figure.kind], named_parts: [] as string[], legacy_player_compatible: true };
  const layout = layoutScene(scene, { reveal: true });
  return { kind: figure.kind, components: [...new Set(scene.elements.map(e => e.type))].sort(),
           scene_scale: layout.scale, legacy_player_compatible: layout.scale >= MIN_PLAYER_SCALE,
           named_parts: layout.items.map(item => item.id).filter((id): id is string => !!id) };
}

function lessonText(lesson: ProblemLessonView) {
  return { title: lesson.title, goal: lesson.goal, intuition: lesson.intuition,
    principle: lesson.principle, terms: lesson.terms, method: lesson.method, watch: lesson.watch,
    glossary: lesson.glossary, example: lesson.example };
}

function lessonSignature(lesson: ProblemLessonView) {
  // Givens change with the seed. Preserve a representative example for every
  // distinct authored explanation, and map every problem back to it.
  return createHash("sha256").update(JSON.stringify({ title: lesson.title, goal: lesson.goal,
    intuition: lesson.intuition, principle: lesson.principle, terms: lesson.terms,
    method: lesson.method, watch: lesson.watch })).digest("hex").slice(0, 16);
}

function decoys(problem: GeneratedProblem) {
  const r = problem.public.response;
  if (r.kind === "choice") return r.options.filter(o => o.id !== problem.answer).map(o => ({
    id: o.id, text: o.label, feedback: problem.choiceFeedback?.[o.id] ?? null,
  }));
  if (r.kind === "multi-select") {
    const correct = new Set(parseSelection(problem.answer) ?? []);
    return r.options.filter(o => !correct.has(o.id)).map(o => ({ id: o.id, text: o.label,
      feedback: problem.choiceFeedback?.[o.id] ?? null }));
  }
  // Other response protocols retain every option and the complete answer in
  // the problem below; do not guess which individual fields are decoys.
  return [];
}

export function buildFacts(id: string, seed: string, standards: OfficialStandard[]) {
  const template = templates.find(t => t.id === id);
  if (!template) throw new Error(`Unknown type ${id}`);
  const skill = skills.find(s => s.id === template.skillId);
  if (!skill) throw new Error(`Missing skill ${template.skillId}`);
  const index = standardIndex(standards);
  const link = (s: Skill) => ({ id: s.id, title: s.title, grade: s.gradeBand,
    description: s.description, alignments: s.alignments, ...aligned(s, index) });
  const lesson = problemLesson(id, "film");
  const contextual = new Map<string, { key: string; example_for_seed: string; lesson: ReturnType<typeof lessonText> }>();
  const problems = Array.from({ length: 10 }, (_, i) => {
    const problemSeed = `${seed}:${id}:${i}`;
    const p = generateProblemFor(id, problemSeed, figureCapabilities, template.version, responseCapabilities);
    // This is the same call shape as the app's instance-lesson endpoint. A
    // clause-specific written lesson must not be mistaken for the library default.
    const activeLesson = problemLesson(id, p.public.seed, p.public.prompt, p.public.response, p);
    const key = lessonSignature(activeLesson);
    if (!contextual.has(key)) contextual.set(key, { key, example_for_seed: p.public.seed, lesson: lessonText(activeLesson) });
    return { seed: p.public.seed, template_version: p.public.templateVersion, prompt: p.public.prompt,
      response: p.public.response, answer: answerText(p.public.response, p.answer), answer_raw: p.answer,
      explanation: p.explanation, hint: p.hint, hint_cue: p.hintCue,
      figure: p.public.figure ?? null, walkthrough: p.walkthrough ?? null,
      variant: p.variant ?? null, grading: { point: p.pointGrading, work: p.workGrading, entry_policy: p.entryPolicy },
      generated_decoys: decoys(p), choice_feedback: p.choiceFeedback ?? {}, written_lesson_key: key };
  });
  const prereqs = skill.prerequisites.map(id => skills.find(s => s.id === id)).filter((s): s is Skill => !!s);
  const successors = skills.filter(s => s.prerequisites.includes(skill.id));
  return {
    schema_version: 1, type: id, template, skill: link(skill), ...aligned(skill, index),
    prerequisites: prereqs.map(link), successors: successors.map(link),
    connections: (skill.connections ?? []).map(c => ({ ...c, target: skills.find(s => s.id===c.skillId) ? link(skills.find(s => s.id===c.skillId)!) : null })),
    sample: { seed, count: 10, method: "Ten deterministic seeds using every current figure and response capability; not a complete enumeration of variants.",
              figure_capabilities: figureCapabilities, response_capabilities: responseCapabilities },
    problems,
    written_lesson: { seed: "film", context: "Library/default lesson used by the film kit", ...lessonText(lesson) },
    contextual_written_lessons: [...contextual.values()],
    misconception_sources: { observed_learner_wrong_answers: null,
      note: "No learner-attempt observations were supplied. Generated decoys and authored warnings are not observed error frequencies. Infer other misconceptions explicitly.",
      authored_warning: lesson.watch, generated_decoy_seeds: problems.filter(p => p.generated_decoys.length).map(p => p.seed) },
    kit_figure: { ...figureInfo(lesson.example.figure),
      use: lesson.example.figure ? 'figure: {example: true}; the figure uses the screenplay seed (default film)' : "Build a picture from the implemented AUTHORING.md primitives.",
      capabilities: "Geo points, segments, polygons, labels, axes/plots, bars, grids, counters, number lines, base-ten blocks, tables/mosaics, vectors, waves, and the app's example figures; consult AUTHORING.md and schema.ts for exact actions." },
  };
}

function inventory(standards: OfficialStandard[]) {
  const index = standardIndex(standards);
  const rows = templates.map((template, order) => {
    const skill = skills.find(s => s.id === template.skillId);
    try {
      if (!skill) throw new Error("Missing skill");
      const lesson = problemLesson(template.id, "film");
      return { ...template, order, grade: skill.gradeBand, skill_title: skill.title,
        prerequisite_ids: skill.prerequisites, standards: aligned(skill, index).standards.map(s => s.code),
        figure: figureInfo(lesson.example.figure), lesson_title: lesson.title, eligible_error: null };
    } catch (error) {
      return { ...template, order, grade: skill?.gradeBand, standards: [],
        eligible_error: error instanceof Error ? error.message : String(error) };
    }
  });
  return { schema_version: 1, skills, templates: rows,
    standards_sha256: createHash("sha256").update(JSON.stringify(standards)).digest("hex") };
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  standards: { type: "string" }, out: { type: "string" }, types: { type: "string" }, seed: { type: "string" },
} });
if (!values.standards || !values.out) throw new Error("Required: --standards <private-json> --out <private-path>");
const worktree = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const destination = resolve(values.out);
if (destination===worktree || destination.startsWith(worktree+sep)) throw new Error("Generated facts belong outside the public worktree");
const standards: OfficialStandard[] = JSON.parse(readFileSync(values.standards, "utf8"));
if (positionals[0] === "inventory") {
  writeFileSync(values.out, JSON.stringify(inventory(standards), null, 2));
  console.log(JSON.stringify({ output: values.out, types: templates.length, skills: skills.length }));
} else if (positionals[0] === "packs") {
  if (!values.types || !values.seed) throw new Error("Packs require --types <json-array> and --seed");
  const ids: string[] = JSON.parse(readFileSync(values.types, "utf8"));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate fact-pack types");
  mkdirSync(values.out, { recursive: true });
  for (const id of ids) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Unsafe type ID");
    writeFileSync(join(values.out, `${id}.json`), JSON.stringify(buildFacts(id, values.seed, standards), null, 2));
  }
  console.log(JSON.stringify({ output: values.out, facts_packs: ids.length, problems_per_pack: 10 }));
} else throw new Error("Use inventory or packs");

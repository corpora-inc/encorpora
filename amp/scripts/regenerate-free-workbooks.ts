/**
 * Public, anonymous grade/course workbook editions from AMP's real composer.
 * Run from amp/: npx tsx scripts/regenerate-free-workbooks.ts --out <directory>
 *   --date 2026-11-15 --minutes 45 --seed public-daily-v1 [--grades K,1,2,...,precalculus]
 *   [--source-commit <git-sha>] [--plan-only]
 * All inputs are public. No account, database or network is used.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
// jsdom is a development-only parser; the DOM below uses the standard Document API.
// @ts-expect-error The existing jsdom dev dependency does not ship declarations.
import { JSDOM } from "jsdom";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { skills } from "../src/curriculum/catalog";
import type { GradeBand } from "../src/curriculum/types";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import { gradeNumber, type Frontier } from "../src/learning/frontier";
import {
  profileStrands,
  uniformLevels,
} from "../src/learning/practice-profiles";
import {
  composeWorkbook,
  workbookCode,
  workbookMinutes,
  workbookProblems,
  printable,
  WORKBOOK_MINUTES,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { workbookHtml, type PaperSize } from "../src/workbook/render";
import { printWorkbookPdf } from "../src/workbook/pdf";
import { checkWorkbookLayout, layoutFailures } from "./workbook-layout";

const allGrades: GradeBand[] = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
];
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    date: { type: "string" },
    minutes: { type: "string", default: "45" },
    seed: { type: "string", default: "public-daily-v1" },
    grades: { type: "string" },
    "source-commit": { type: "string" },
    "plan-only": { type: "boolean" },
  },
});
assert(values.out, "--out is required");
assert(
  values.date && /^\d{4}-\d{2}-\d{2}$/.test(values.date),
  "--date YYYY-MM-DD is required",
);
const date = values.date;
const requestedMinutes = Number(values.minutes) as WorkbookMinutes;
assert(
  WORKBOOK_MINUTES.includes(requestedMinutes),
  "--minutes must be 30, 45, or 60",
);
assert(
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date,
  "Invalid edition date",
);
const selected = (values.grades?.split(",") ?? allGrades) as GradeBand[];
assert(
  selected.length && selected.every((g) => allGrades.includes(g)),
  "Unknown grade/course",
);
assert(new Set(selected).size === selected.length, "Grades must be unique");
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const seed = values.seed!;
let sourceCommit = values["source-commit"] ?? "";
if (!sourceCommit)
  try {
    sourceCommit = execFileSync("git", ["-C", process.cwd(), "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {}
assert(
  /^[a-f0-9]{40}$/.test(sourceCommit),
  "Pass --source-commit with the exact source Git SHA",
);
const skillById = new Map(skills.map((s) => [s.id, s]));
// Skills can span several grades. These template families use later mathematics
// than the skill's earliest grade: percentages, minute precision, circle-based
// surface area, and inequalities with variables on both sides. Public samples
// use the narrower grade appropriate to every variant in each family.
const publicGradeOverrides: Readonly<Record<string,GradeBand>> = {
  "categorical-summary":"6",
  "clock-minute-match":"3",
  "cylinder-prism-surface-area":"8",
  "grouped-linear-inequality":"8",
};
const publicGrade = (template: typeof templates[number]): GradeBand | undefined => {
  // The variable-angle choice can have a valid counterexample at a special x.
  // Keep it out of public editions until its generator is fixed (issue #2361).
  if(template.id === "angle-claim-reasoning") return undefined;
  return publicGradeOverrides[template.id] ?? skillById.get(template.skillId)?.gradeBand;
};
const title = (grade: GradeBand) =>
  grade === "K"
    ? "Kindergarten"
    : /^\d+$/.test(grade)
      ? `Grade ${grade}`
      : ({
          "algebra-1": "Algebra 1",
          geometry: "Geometry",
          "algebra-2": "Algebra 2",
          precalculus: "Precalculus",
        } as Record<string,string>)[grade]!;
const slug = (grade: GradeBand) =>
  grade === "K"
    ? "kindergarten"
    : /^\d+$/.test(grade)
      ? `grade-${grade}`
      : grade;
const sha256 = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
const normalize = (v: string) => v.replace(/\s+/g, " ").trim();
function visibleText(el: Element) {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(".katex-mathml,annotation").forEach((n) => n.remove());
  return normalize(copy.textContent ?? "");
}

function compose(grade: GradeBand) {
  const level = gradeNumber[grade];
  const levels = uniformLevels(level);
  const estimate = { level, sd: 0.5, answered: 0, independent: 0 };
  const frontier: Frontier = {
    expected: level,
    overall: estimate,
    strands: Object.fromEntries(
      profileStrands.map((s) => [s, { ...estimate }]),
    ),
  };
  const pool = templates.filter(
    (t) => publicGrade(t) === grade && printable(t),
  );
  let spec: WorkbookSpec | undefined;
  let editionSeed = "";
  for (let variation = 0; variation < 32; variation++) {
    editionSeed = `public:${seed}:${grade}${variation ? `:${variation}` : ""}`;
    const candidate = composeWorkbook({
      templates: pool,
      skills,
      lessons,
      frontier,
      evidence: [],
      date,
      minutes: requestedMinutes,
      learnerKey: editionSeed,
      now: Date.parse(`${date}T12:00:00Z`),
    });
    if (workbookMinutes(candidate) >= requestedMinutes - 2.5) {
      spec = candidate;
      break;
    }
  }
  assert(spec, `${grade}: no stable seed met the requested duration`);
  const items = spec.sections.flatMap((s) => s.items);
  assert(items.length >= 6, `${grade}: too few problems`);
  assert(
    items.every((i) => {const template=templates.find(t=>t.id===i.templateId);return template && publicGrade(template)===grade;}),
    `${grade}: problem outside its published grade/course`,
  );
  const minutes = workbookMinutes(spec);
  assert(
    minutes >= requestedMinutes - 2.5 && minutes <= requestedMinutes,
    `${grade}: estimate ${minutes} is outside the requested duration tolerance`,
  );
  const topics = [
    ...new Set(items.map((i) => skillById.get(i.skillId)!.title)),
  ];
  const areas = [...new Set(items.map((i) => i.strand))];
  assert(
    areas.length >= 3,
    `${grade}: mixed practice needs at least three areas`,
  );
  return {
    grade,
    editionSeed,
    slug: slug(grade),
    title: title(grade),
    level,
    requestedMinutes,
    profile: {
      levels,
      evidence: "none; anonymous uniform grade/course starting profile",
    },
    minutes,
    topics,
    areas,
    problems: items.length,
    code: workbookCode(spec),
    spec,
  };
}
const plans = selected.map(compose);
writeFileSync(
  join(out, "edition-plan.json"),
  JSON.stringify(
    { date, requestedMinutes, seed, sourceCommit, plans },
    null,
    2,
  ) + "\n",
);
for (const p of plans)
  console.log(
    `${p.grade}: ${p.problems} problems, ${p.minutes} min, ${p.areas.length} areas: ${p.topics.join("; ")}`,
  );
if (values["plan-only"]) process.exit(0);

/** The public PDF has no account-only marking page or nonfunctional learner URL.
 * It retains the exact generated problem/answer content and the blank name line. */
function publicDocument(
  spec: WorkbookSpec,
  grade: GradeBand,
  paper: PaperSize,
) {
  const document = new JSDOM(
    workbookHtml(spec, {
      lessons,
      skillTitle: (id) => skillById.get(id)?.title ?? id,
      paper,
    }),
  ).window.document;
  document.querySelector('[data-flow="results"]')!.remove();
  document.querySelector(".wb-name-text")!.textContent = `${title(grade)} math`;
  document.title = `AMP · ${title(grade)} mixed practice · ${date}`;
  const intro = document.querySelector(".wb-parent")!;
  intro.querySelector(".wb-parent-label")!.textContent = "Check your work";
  intro.lastElementChild!.textContent =
    "Check each answer with the steps below. Mark any problem you want to practice again.";
  const wb = document.querySelector(".wb") as HTMLElement;
  wb.dataset.foot = `AMP · ${title(grade)} mixed practice · ${date} · ${workbookCode(spec)}`;
  wb.dataset.footKey = `Answer key · AMP · ${title(grade)} · ${date} · ${workbookCode(spec)}`;
  const expected = {
    prompts: [
      ...document.querySelectorAll('[data-flow="student"] .wb-item'),
    ].map((el) => ({
      number: Number(el.querySelector(".wb-num")!.textContent),
      text: visibleText(
        el.querySelector(".exercise-prompt") ?? el.querySelector("p") ?? el,
      ),
    })),
    keys: [...document.querySelectorAll('[data-flow="key"] .wb-key-item')].map(
      (el) => ({
        number: Number(el.querySelector(".wb-key-num")!.textContent),
        answer: visibleText(el.querySelector(".wb-key-answer-text")!),
        steps: [...el.querySelectorAll(".wb-key-steps li")].map(visibleText),
      }),
    ),
  };
  const count = spec.sections.reduce((n, s) => n + s.items.length, 0);
  assert.deepEqual(
    expected.prompts.map((x) => x.number),
    Array.from({ length: count }, (_, i) => i + 1),
  );
  assert.deepEqual(
    expected.keys.map((x) => x.number),
    expected.prompts.map((x) => x.number),
  );
  assert(
    expected.keys.every((k) => k.answer && k.steps.length),
    "Every answer has worked reasoning",
  );
  assert(
    document.querySelector(".wb-name-line"),
    "Blank name line is retained",
  );
  assert(
    visibleText(document.body).includes(`About ${requestedMinutes} min`),
    "Cover duration must match requested edition",
  );
  return { html: document.documentElement.outerHTML, expected };
}
async function correspondence(
  page: Page,
  expected: ReturnType<typeof publicDocument>["expected"],
) {
  const actual = await page.evaluate(() => {
    const text = (el: Element) => {
      const c = el.cloneNode(true) as Element;
      c.querySelectorAll(".katex-mathml,annotation").forEach((n) => n.remove());
      return (c.textContent ?? "").replace(/\s+/g, " ").trim();
    };
    const prompt = [
      ...document.querySelectorAll(".wb-page--student .wb-item"),
    ].map((el) => ({
      number: Number(el.querySelector(".wb-num")!.textContent),
      text: text(
        el.querySelector(".exercise-prompt") ?? el.querySelector("p") ?? el,
      ),
    }));
    const key = [...document.querySelectorAll(".wb-page .wb-key-item")].map(
      (el) => ({
        number: Number(el.querySelector(".wb-key-num")!.textContent),
        answer: text(el.querySelector(".wb-key-answer-text")!),
        steps: [...el.querySelectorAll(".wb-key-steps li")].map(text),
      }),
    );
    return {
      prompts: prompt,
      keys: key,
      blankName: !!document.querySelector(".wb-page .wb-name-line"),
      results: document.querySelectorAll(".wb-page .wb-results").length,
      rawMath: document.querySelectorAll(".wb-page .katex-error").length,
    };
  });
  assert.deepEqual(
    actual.prompts,
    expected.prompts,
    "Problem numbering/order/prompt changed during pagination",
  );
  assert.deepEqual(
    actual.keys,
    expected.keys,
    "Answer numbering/order/text/reasoning changed during pagination",
  );
  assert(
    actual.blankName && actual.results === 0 && actual.rawMath === 0,
    "Public copy/name/math check failed",
  );
  return {
    passed: true,
    numberedProblems: actual.prompts.length,
    numberedAnswers: actual.keys.length,
    orderedPromptAndKeyTextMatch: true,
    allKeysHaveWorkedSteps: true,
    blankNameLine: true,
    accountOnlyResultsPage: false,
    mathErrors: 0,
  };
}

const browser = await secureChromium(rawChromium).launch({ headless: true });
const manifestPath = join(out, "manifest.json");
const prior = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : null;
if (prior)
  assert(
    prior.date === date &&
      prior.requestedMinutes === requestedMinutes &&
      prior.seed === seed &&
      prior.sourceCommit === sourceCommit,
    "Use a separate output directory for a different edition or source commit",
  );
const manifest: {
  date: string;
  requestedMinutes: number;
  seed: string;
  sourceCommit: string;
  generatedAt: string;
  editions: any[];
} = {
  date,
  requestedMinutes,
  seed,
  sourceCommit,
  generatedAt: new Date().toISOString(),
  editions: (prior?.editions ?? []).filter(
    (e: any) => !selected.includes(e.grade),
  ),
};
try {
  for (const p of plans) {
    const dir = join(out, p.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "spec.json"),
      JSON.stringify(p.spec, null, 2) + "\n",
    );
    const model = workbookProblems(p.spec);
    const answerRecord = model.map((problem, i) => ({
      number: i + 1,
      templateId: problem.public.templateId,
      prompt: problem.public.prompt,
      response: problem.public.response,
      answer: problem.answer,
      explanation: problem.explanation,
    }));
    writeFileSync(
      join(dir, "answer-map.json"),
      JSON.stringify(answerRecord, null, 2) + "\n",
    );
    const files = [];
    for (const paper of ["letter", "a4"] as const) {
      const { html, expected } = publicDocument(p.spec, p.grade, paper);
      const page = await browser.newPage({
        viewport: { width: 1100, height: 1500 },
        deviceScaleFactor: 1,
      });
      const pdf = await printWorkbookPdf(page, html);
      const layout = await checkWorkbookLayout(page);
      const failures = layoutFailures(layout, pdf);
      assert.deepEqual(
        failures,
        [],
        `${p.grade} ${paper}: ${failures.join("; ")}`,
      );
      const matches = await correspondence(page, expected);
      const name = `amp-${p.slug}-${date}-${paper}.pdf`;
      writeFileSync(join(dir, name), pdf);
      if (paper === "letter")
        await page
          .locator(".wb-page")
          .first()
          .screenshot({ path: join(dir, "cover.png") });
      const validation = {
        layout,
        failures,
        correspondence: matches,
        sourceSpecSha256: sha256(JSON.stringify(p.spec)),
        answerMapSha256: sha256(JSON.stringify(answerRecord)),
      };
      writeFileSync(
        join(dir, `${paper}-validation.json`),
        JSON.stringify(validation, null, 2) + "\n",
      );
      files.push({
        paper,
        file: `${p.slug}/${name}`,
        bytes: pdf.length,
        sha256: sha256(pdf),
        pages: layout.pages,
        studentPages: layout.studentPages,
        answerKeyPages: layout.pages - layout.studentPages,
        validation: `${p.slug}/${paper}-validation.json`,
        passed: true,
      });
      console.log(
        `PASS ${p.grade} ${paper}: ${layout.pages} pages; ${matches.numberedProblems} matching answers`,
      );
      await page.close();
    }
    const { spec, ...meta } = p;
    manifest.editions.push({
      ...meta,
      date,
      seed: p.editionSeed,
      spec: `${p.slug}/spec.json`,
      answerMap: `${p.slug}/answer-map.json`,
      cover: `${p.slug}/cover.png`,
      files,
      provenance: {
        generator: "src/workbook/compose.ts",
        renderer: "src/workbook/render.tsx",
        layoutCheck: "scripts/workbook-layout.ts",
        gradeMapping:
          "src/curriculum/catalog.ts → gradeBand; src/learning/frontier.ts → gradeNumber",
        anonymous: true,
        sourceCommit,
      },
      validation: {
        allLayoutsPassed: true,
        allKeyCorrespondencePassed: true,
        everyProblemMappedToNamedGrade: true,
      },
    });
    manifest.editions.sort(
      (a, b) => allGrades.indexOf(a.grade) - allGrades.indexOf(b.grade),
    );
    writeFileSync(
      join(out, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
} finally {
  await browser.close();
}
console.log(`Wrote ${manifest.editions.length * 2} PDFs to ${out}`);

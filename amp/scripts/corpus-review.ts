/**
 * Learner-eye review of the problem corpus.
 *
 *   tsx scripts/corpus-review.ts sample [--seeds 3]
 *     Renders every problem type as the learner sees it (prompt + figure) to
 *     artifacts/corpus-review/cards/*.png and writes cases.jsonl.
 *   tsx scripts/corpus-review.ts judge --provider ollama|anthropic|codex [--model m] [--only id,id]
 *     Asks a vision model to review each card against the rubric below and
 *     writes judgments-<provider>.jsonl (resumable: finished cases are skipped).
 *   tsx scripts/corpus-review.ts report [--provider p]
 *     Writes report-<provider>.md, worst problem types first.
 *
 * Providers: ollama uses AMP_OLLAMA_URL (default the DGX Spark over Tailscale);
 * anthropic uses ANTHROPIC_API_KEY; codex uses the local `codex exec` CLI.
 */
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { templates, generateProblem } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { Figure } from "../src/web/Figure";

const root = new URL("../artifacts/corpus-review/", import.meta.url).pathname;
const args = process.argv.slice(2);
const flag = (name: string, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};

type Case = {
  key: string;
  templateId: string;
  title: string;
  grade: string;
  seed: string;
  prompt: string;
  answer: string;
  hint: string;
  explanation: string[];
  hasFigure: boolean;
  image: string;
};

const RUBRIC = `You review one problem from a K–12 math practice app. The image shows exactly what the learner sees: the question and any diagram. The answer and worked steps are given below.

Judge it as a demanding math editor. The standard: direct, concise, complete, unambiguous, grammatical, and a diagram that shows the relevant quantities and relationships. No filler.

Reply with JSON only:
{"clarity": 1-5, "figure": 1-5 or null if no figure, "ambiguous": "how a careful learner could misread what is asked" or null,
 "issues": ["each concrete problem: wording, grammar, singular/plural, unit, label that does not match the picture, picture that omits a quantity, answer-format unclear, explanation error"],
 "verdict": "ok" or "fix", "rewrite": "a better question wording, or null if ok"}`;

async function sample() {
  const seeds = Number(flag("seeds", "3"));
  await mkdir(`${root}cards`, { recursive: true });
  const css = (
    await Promise.all(
      ["style.css", "practice.css", "theme.css"].map((f) =>
        readFile(new URL(`../src/web/${f}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  const byId = new Map(skills.map((s) => [s.id, s]));
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 420, height: 600 },
    deviceScaleFactor: 2,
  });
  const cases: Case[] = [];
  for (const template of templates)
    for (let n = 0; n < seeds; n++) {
      const seed = `review-${n}`;
      const p = generateProblem(template.id, seed);
      const figure = p.public.figure
        ? renderToStaticMarkup(
            React.createElement(Figure, { figure: p.public.figure }),
          )
        : "";
      const choices =
        p.public.response.kind === "choice"
          ? `<ol class="choices">${p.public.response.options.map((o) => `<li>${o.label}</li>`).join("")}</ol>`
          : `<p class="response">Answer box: ${p.public.response.label}</p>`;
      await page.setContent(
        `<!doctype html><html><head><style>${css}
        body{margin:0;padding:20px;background:var(--surface)}
        .card .question{font-size:22px;font-weight:600;text-align:center;margin:0 0 16px}
        .card .figure{display:block;width:100%;max-height:260px}
        .choices,.response{font-size:16px;color:var(--ink-2)}</style></head>
        <body><div class="card"><h2 class="question">${p.public.prompt}</h2>${figure}${choices}</div></body></html>`,
      );
      const image = `${root}cards/${template.id}--${n}.png`;
      await page.locator(".card").screenshot({ path: image });
      const answer =
        p.public.response.kind === "choice"
          ? (p.public.response.options.find((o) => o.id === p.answer)?.label ??
            p.answer)
          : p.answer;
      cases.push({
        key: `${template.id}--${n}`,
        templateId: template.id,
        title: template.title,
        grade: byId.get(template.skillId)?.gradeBand ?? "",
        seed,
        prompt: p.public.prompt,
        answer,
        hint: p.hint,
        explanation: p.explanation,
        hasFigure: !!p.public.figure,
        image,
      });
    }
  await browser.close();
  await writeFile(
    `${root}cases.jsonl`,
    cases.map((c) => JSON.stringify(c)).join("\n") + "\n",
  );
  console.log(
    `Rendered ${cases.length} cards for ${templates.length} problem types to ${root}`,
  );
}

function details(c: Case) {
  return `Problem type: ${c.title} (grade ${c.grade})\nQuestion text: ${c.prompt}\nCorrect answer: ${c.answer}\nHint: ${c.hint}\nWorked steps:\n${c.explanation.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

function parseJudgment(text: string) {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) throw new Error(`No JSON in reply: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function askOllama(c: Case, model: string) {
  const base = process.env.AMP_OLLAMA_URL ?? "http://100.99.83.64:11434";
  const image = (await readFile(c.image)).toString("base64");
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: RUBRIC },
        { role: "user", content: details(c), images: [image] },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  return parseJudgment((await response.json()).message.content);
}

async function askAnthropic(c: Case, model: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    throw new Error("Set ANTHROPIC_API_KEY to use the anthropic provider");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: RUBRIC,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: (await readFile(c.image)).toString("base64"),
              },
            },
            { type: "text", text: details(c) },
          ],
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const body = await response.json();
  return parseJudgment(
    body.content.map((b: { text?: string }) => b.text ?? "").join(""),
  );
}

async function askCodex(c: Case) {
  // The prompt goes on stdin; -i takes every following argument as an image.
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "codex",
      ["exec", "--skip-git-repo-check", "-s", "read-only", "-i", c.image],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 240000);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`codex exited ${code}: ${stderr.slice(-400)}`));
    });
    child.stdin.end(`${RUBRIC}\n\n${details(c)}`);
  });
  return parseJudgment(output);
}

async function judge() {
  const provider = flag("provider", "ollama");
  const model = flag(
    "model",
    provider === "anthropic"
      ? "claude-sonnet-5-5"
      : provider === "ollama"
        ? "llama4:scout"
        : "",
  );
  const only = new Set(flag("only").split(",").filter(Boolean));
  const out = `${root}judgments-${provider}.jsonl`;
  const done = new Set(
    existsSync(out)
      ? (await readFile(out, "utf8"))
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l).key)
      : [],
  );
  const cases: Case[] = (await readFile(`${root}cases.jsonl`, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const todo = cases.filter(
    (c) => !done.has(c.key) && (!only.size || only.has(c.templateId)),
  );
  const concurrency = Number(
    flag("concurrency", provider === "ollama" ? "2" : "6"),
  );
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < todo.length) {
        const c = todo[next++]!;
        try {
          const judgment =
            provider === "anthropic"
              ? await askAnthropic(c, model)
              : provider === "codex"
                ? await askCodex(c)
                : await askOllama(c, model);
          await appendFile(
            out,
            JSON.stringify({
              key: c.key,
              templateId: c.templateId,
              model,
              ...judgment,
            }) + "\n",
          );
          console.log(
            `${c.key}: ${judgment.verdict} (clarity ${judgment.clarity})`,
          );
        } catch (error) {
          console.error(`${c.key}: review failed`, error);
        }
      }
    }),
  );
}

async function report() {
  const provider = flag("provider", "ollama");
  const cases = new Map<string, Case>(
    (await readFile(`${root}cases.jsonl`, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .map((c: Case) => [c.key, c]),
  );
  const judgments = (
    await readFile(`${root}judgments-${provider}.jsonl`, "utf8")
  )
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const byTemplate = new Map<string, typeof judgments>();
  for (const j of judgments)
    byTemplate.set(j.templateId, [...(byTemplate.get(j.templateId) ?? []), j]);
  const score = (js: typeof judgments) =>
    Math.min(
      ...js.map((j) => Math.min(Number(j.clarity) || 5, Number(j.figure) || 5)),
    );
  const rows = [...byTemplate].sort((a, b) => score(a[1]) - score(b[1]));
  const lines = [
    `# Corpus review (${provider})`,
    "",
    `${judgments.length} cases, ${rows.length} problem types. Worst first.`,
    "",
  ];
  for (const [templateId, js] of rows) {
    const flagged = js.filter((j) => j.verdict === "fix");
    if (!flagged.length) continue;
    lines.push(`## ${templateId} — min score ${score(js)}`);
    for (const j of flagged) {
      const c = cases.get(j.key)!;
      lines.push(`- **${c.prompt}**`);
      if (j.ambiguous) lines.push(`  - Ambiguity: ${j.ambiguous}`);
      for (const issue of j.issues ?? []) lines.push(`  - ${issue}`);
      if (j.rewrite) lines.push(`  - Rewrite: ${j.rewrite}`);
    }
    lines.push("");
  }
  await writeFile(`${root}report-${provider}.md`, lines.join("\n"));
  console.log(`Wrote ${root}report-${provider}.md`);
}

const command = args[0];
if (command === "sample") await sample();
else if (command === "judge") await judge();
else if (command === "report") await report();
else throw new Error("Usage: corpus-review.ts sample|judge|report");

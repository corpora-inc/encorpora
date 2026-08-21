/**
 * Survivability probe — QA only, never shipped, never imported by the game.
 *
 * Drives a real `Game` on the fake audio clock and reports the numbers the
 * founder's report is about: how many seconds a given kind of player survives,
 * how long they wait for the first question, and what the answering window is.
 *
 * Run: node --experimental-strip-types src/dev/measure.ts
 */

import { installFakeAudio } from "./fakeAudio.ts";

const audio = installFakeAudio();
const { Game } = await import("../game/core.ts");
import type { Host } from "../contract.ts";
import { answerPlan } from "../game/answer.ts";
import { strikeWindows } from "../game/judge.ts";

type Skill = "none" | "moderate" | "expert";

/** Probability a player of this skill lands a given note, and their jitter. */
const SKILL: Record<Skill, { p: number; jitterMs: number }> = {
  none: { p: 0, jitterMs: 0 },
  moderate: { p: 0.7, jitterMs: 55 },
  expert: { p: 1, jitterMs: 8 },
};

function makeHost(log: { asked: number[]; reports: unknown[] }): Host {
  let n = 0;
  return {
    next(opts) {
      n += 1;
      log.asked.push(opts?.difficulty ?? 0);
      return {
        id: `q${n}`,
        prompt: `${n} + 3`,
        answer: "4",
        distractors: ["3", "6"],
        domain: "add-sub",
        difficulty: (opts?.difficulty ?? 1) / 10,
      };
    },
    report(r) {
      log.reports.push(r);
    },
    haptic() {},
    prefersReducedMotion() {
      return true;
    },
  };
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Probe = {
  skill: Skill;
  /** seconds of clock before the heart first ran out, or Infinity */
  breakdownAt: number;
  breakdowns: number;
  firstQuestionAt: number;
  questionGaps: number[];
  /** answer window in seconds for each gate, in order */
  answerWindows: number[];
  /** timing window at each gate, in ms */
  answerMissMs: number[];
  difficultyAtGate: number[];
  /** (item difficulty, delivered read seconds) for every gate */
  itemVsWindow: [number, number][];
  finalDifficulty: number;
  notesMissed: number;
  notesHit: number;
  chartSignature: string[];
};

export async function probe(
  skill: Skill,
  seconds: number,
  answer: "right" | "wrong" | "never" = "right",
  seed = 7,
): Promise<Probe> {
  const log = { asked: [] as number[], reports: [] as unknown[] };
  const game = new Game(makeHost(log));
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();
  const pump = (game as unknown as { pump(): void }).pump.bind(game);
  const rnd = mulberry(seed);
  const cfg = SKILL[skill];

  let breakdownAt = Infinity;
  let breakdowns = 0;
  let prevDebt = game.heartDebt;
  let firstQuestionAt = Infinity;
  const gateSeen = new Set<number>();
  const questionAt: number[] = [];
  const answerWindows: number[] = [];
  const answerMissMs: number[] = [];
  const difficultyAtGate: number[] = [];
  const itemVsWindow: [number, number][] = [];
  const chartSignature: string[] = [];
  let sigBars = 0;

  const steps = Math.round(seconds / 0.02);
  for (let i = 0; i < steps; i++) {
    ctx.currentTime += 0.02;
    pump();
    const now = ctx.currentTime;

    if (!prevDebt && game.heartDebt) {
      breakdowns++;
      if (breakdownAt === Infinity) breakdownAt = now;
    }
    prevDebt = game.heartDebt;

    for (const g of game.gates) {
      if (!g.active || gateSeen.has(g.id)) continue;
      // a gate is only measurable once its choice tiles exist
      const tile = game.notes.find((n) => n.active && n.isChoice && n.gateId === g.id);
      if (!tile) continue;
      gateSeen.add(g.id);
      questionAt.push(g.revealAt);
      if (firstQuestionAt === Infinity) firstQuestionAt = g.revealAt;
      answerWindows.push(tile.time - g.revealAt);
      itemVsWindow.push([g.q?.difficulty ?? 0, tile.time - g.revealAt]);
      answerMissMs.push(strikeWindows(tile.strikeSec).miss * 1000);
      difficultyAtGate.push(game.difficulty);
    }

    // sample the chart shape once per bar for a variety signature
    for (const bg of game.barGrid) {
      if (bg.t > now - 0.02 && bg.t <= now && sigBars < 4000) {
        sigBars++;
        chartSignature.push(`${bg.cells}/${bg.playEvery}`);
      }
    }

    const due = now - 0.012;
    for (const note of game.notes) {
      if (!note.active || note.state !== 0) continue;
      if (Math.abs(note.time - due) > 0.015) continue;
      if (note.isChoice) {
        if (answer === "never" || skill === "none") continue;
        if (note.correct !== (answer === "right")) continue;
        game.hit(note.lane, note.time + 0.012);
        continue;
      }
      if (rnd() >= cfg.p) continue;
      const jitter = ((rnd() * 2 - 1) * cfg.jitterMs) / 1000;
      game.hit(note.lane, note.time + jitter + 0.012);
    }

    game.update(0.02);
  }

  const gaps: number[] = [];
  for (let i = 1; i < questionAt.length; i++) gaps.push(questionAt[i]! - questionAt[i - 1]!);

  const out: Probe = {
    skill,
    breakdownAt,
    breakdowns,
    firstQuestionAt,
    questionGaps: gaps,
    answerWindows,
    answerMissMs,
    difficultyAtGate,
    itemVsWindow,
    finalDifficulty: game.difficulty,
    notesMissed: game.notesMissed,
    notesHit: game.notesHit,
    chartSignature,
  };
  game.destroy();
  return out;
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "never");

if (import.meta.filename === process.argv[1]) {
  for (const skill of ["none", "moderate", "expert"] as Skill[]) {
    const r = await probe(skill, 240, "right");
    console.log(
      `${skill.padEnd(9)} breakdown@${fmt(r.breakdownAt).padStart(7)}s  breakdowns=${String(r.breakdowns).padStart(3)}  ` +
        `q1@${fmt(r.firstQuestionAt).padStart(6)}s  gap~${fmt(r.questionGaps.length ? r.questionGaps.reduce((a, b) => a + b, 0) / r.questionGaps.length : NaN)}s  ` +
        `lv=${r.finalDifficulty.toFixed(2)}  hit=${r.notesHit} miss=${r.notesMissed}`,
    );
    console.log(
      `          answer window s: ${r.answerWindows.slice(0, 10).map((x) => x.toFixed(2)).join(" ")}`,
    );
    console.log(
      `          answer miss  ms: ${r.answerMissMs.slice(0, 10).map((x) => x.toFixed(1)).join(" ")}`,
    );
    console.log(
      `          lv at gate     : ${r.difficultyAtGate.slice(0, 10).map((x) => x.toFixed(2)).join(" ")}`,
    );
    const uniq = new Set(r.chartSignature);
    console.log(`          bars=${r.chartSignature.length} distinct cell shapes=${uniq.size} ${[...uniq].join(",")}`);
  }

  // windows across the difficulty range for an ordinary dense note
  console.log("\nanswer window by ITEM difficulty (pure; must never decrease):");
  for (const d of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const plan = answerPlan({ difficulty: d });
    console.log(
      `  item ${d.toFixed(2)}: read ${plan.readSec.toFixed(2)}s  strike +/-${(plan.strikeSec * 1000).toFixed(0)}ms`,
    );
  }
}

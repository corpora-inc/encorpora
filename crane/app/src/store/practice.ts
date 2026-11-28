import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage } from "../lib/storage.ts";
import {
  absorbExam, answer as foldAnswer, answerExam, buildExam, createRng, grade, newPractice, nextPick, scoreExam,
  startExam, submitExam, toggleFlag, type ExamBlueprint, type ExamResult, type ExamSession, type PickReason,
  type PracticeState,
} from "../practice/engine.ts";
import type { Engine, ExamBlueprintRow } from "../engine/types.ts";
import { bankFor } from "../practice/bank.ts";

export interface Current {
  /** The focus this pick was drawn for: null = everything, else a topic id. */
  focus: string | null;
  itemId: string;
  reason: PickReason;
  /** Set once answered: the chosen original choice index and the grade. */
  chosen: number | null;
  correct: boolean | null;
}

export interface ExamRecord {
  examId: string;
  session: ExamSession;
  result: ExamResult | null;
}

interface PracticeStore {
  state: PracticeState;
  current: Current | null;
  exams: Record<string, ExamRecord>;
  /** Most recent finished exam results, newest first. */
  history: { examId: string; at: number; percent: number; passed: boolean }[];
  next(engine: Engine, now: number, focus: string | null): void;
  choose(engine: Engine, choice: number, now: number): void;
  /** An item answered inline (an Instructor question block): it counts like any practice answer. */
  answerItem(engine: Engine, itemId: string, choice: number, now: number): boolean | null;
  startExam(engine: Engine, bp: ExamBlueprintRow, now: number): void;
  answerExam(examId: string, itemId: string, choice: number | null, now: number): void;
  flagExam(examId: string, itemId: string, now: number): void;
  submitExam(engine: Engine, examId: string, now: number): void;
  discardExam(examId: string): void;
  reset(): void;
}

export const toBlueprint = (bp: ExamBlueprintRow): ExamBlueprint => ({
  id: bp.id,
  minutes: bp.minutes,
  passPercent: bp.passPercent,
  domains: bp.domains.map((d) => ({ id: d.id, skillIds: d.skillIds, count: d.count })),
});

export const usePractice = create<PracticeStore>()(
  persist(
    (set, get) => ({
      state: newPractice(),
      current: null,
      exams: {},
      history: [],
      next(engine, now, focus) {
        const { state } = get();
        const pick = nextPick(bankFor(engine), state, {
          now,
          rng: createRng(`pick:${state.step}:${now}`),
          ...(focus ? { focus: { topicIds: [focus] } } : {}),
        });
        set({ current: pick ? { focus, itemId: pick.item.id, reason: pick.reason, chosen: null, correct: null } : null });
      },
      choose(engine, choice, now) {
        const { current, state } = get();
        if (!current || current.chosen !== null) return;
        const ix = bankFor(engine);
        const item = ix.itemById.get(current.itemId);
        if (!item) return;
        const correct = grade(item, choice).correct;
        set({
          state: foldAnswer(ix, state, { item, reason: current.reason }, correct, now),
          current: { ...current, chosen: choice, correct },
        });
      },
      answerItem(engine, itemId, choice, now) {
        const ix = bankFor(engine);
        const item = ix.itemById.get(itemId);
        if (!item) return null;
        const correct = grade(item, choice).correct;
        set({ state: foldAnswer(ix, get().state, { item, reason: "frontier" }, correct, now) });
        return correct;
      },
      startExam(engine, bp, now) {
        const items = bankFor(engine).bank.items;
        const seen = get().state.seen;
        const form = buildExam(toBlueprint(bp), items, `${now}`, (it) => -(seen[it.id] ?? 0));
        set({ exams: { ...get().exams, [bp.id]: { examId: bp.id, session: startExam(form, now), result: null } } });
      },
      answerExam(examId, itemId, choice, now) {
        const rec = get().exams[examId];
        if (!rec || rec.result) return;
        set({ exams: { ...get().exams, [examId]: { ...rec, session: answerExam(rec.session, itemId, choice, now) } } });
      },
      flagExam(examId, itemId, now) {
        const rec = get().exams[examId];
        if (!rec || rec.result) return;
        set({ exams: { ...get().exams, [examId]: { ...rec, session: toggleFlag(rec.session, itemId, now) } } });
      },
      submitExam(engine, examId, now) {
        const rec = get().exams[examId];
        if (!rec || rec.result) return;
        const ix = bankFor(engine);
        const session = submitExam(rec.session, now);
        const result = scoreExam(session, ix.bank.items, now);
        set({
          exams: { ...get().exams, [examId]: { ...rec, session, result } },
          state: absorbExam(ix, get().state, result.items, now),
          history: [{ examId, at: now, percent: result.percent, passed: result.passed }, ...get().history].slice(0, 20),
        });
      },
      discardExam(examId) {
        const exams = { ...get().exams };
        delete exams[examId];
        set({ exams });
      },
      reset: () => set({ state: newPractice(), current: null, exams: {}, history: [] }),
    }),
    { name: "crane.practice", storage: jsonStorage, version: 1 },
  ),
);

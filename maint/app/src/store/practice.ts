import { create } from "zustand";
import { reportError } from "@appkit/toast.ts";
// harvest/practice has no dependencies: imported by path, as crane does.
import { answer, grade, type IndexedBank, type Pick, type PracticeState } from "../../../../harvest/practice/src/index.ts";
import { pickNext, rebuild, toBank } from "../learn/state.ts";
import { EngineError } from "../engine/client.ts";
import { practiceCall, type PracticeAttempt, type PracticeItems, type PracticeQuestion } from "../learn/provisional.ts";
export { reportOf } from "../learn/state.ts";

/**
 * Practice per pack. Every answer is recorded through the engine
 * (`practice.record`: in the device records, audited, synced to the hub).
 * Mastery and spaced review are derived here by harvest/practice, rebuilt
 * from `practice.history` on load: the records are the only copy that counts.
 */
export interface PackPractice {
  items: PracticeItems;
  ix: IndexedBank;
  byId: Record<string, PracticeQuestion>;
  state: PracticeState;
  pick: Pick | null;
  /** The choice made on the current pick (null until answered). */
  chosen: number | null;
  shownAt: number;
}

interface PracticeStore {
  /** null: not loaded; false: this engine offers no practice for the pack. */
  packs: Record<string, PackPractice | false | null>;
  busy: boolean;
  load(packId: string): Promise<void>;
  choose(packId: string, index: number): Promise<void>;
  next(packId: string): void;
}

export const usePractice = create<PracticeStore>()((set, get) => {
  const put = (id: string, v: PackPractice | false) => set({ packs: { ...get().packs, [id]: v } });
  return {
    packs: {},
    busy: false,
    async load(packId) {
      try {
        const [items, history] = await Promise.all([practiceCall<PracticeItems>("practice.items", { pack_id: packId }), practiceCall<PracticeAttempt[]>("practice.history", { pack_id: packId })]);
        if (items.questions.length === 0) return put(packId, false);
        const ix = toBank(items);
        const state = rebuild(ix, history);
        const now = Date.now();
        put(packId, { items, ix, byId: Object.fromEntries(items.questions.map((q) => [q.q_id, q])), state, pick: pickNext(ix, state, now), chosen: null, shownAt: now });
      } catch (e) {
        // An engine without practice for this pack: Learn simply shows no practice.
        if (e instanceof EngineError && (e.code === "unknown_method" || e.code === "bad_params")) return put(packId, false);
        put(packId, false);
        reportError("practice.load", e, "Practice could not be read from the manual pack.");
      }
    },
    async choose(packId, index) {
      const p = get().packs[packId];
      if (!p || !p.pick || p.chosen !== null || get().busy) return;
      const now = Date.now();
      const { correct } = grade(p.pick.item, index);
      set({ busy: true });
      try {
        await practiceCall("practice.record", { pack_id: packId, q_id: p.pick.item.id, chosen: index, correct, ms: now - p.shownAt, at: now });
        put(packId, { ...p, state: answer(p.ix, p.state, p.pick, correct, now), chosen: index });
      } catch (e) {
        reportError("practice.record", e, "The answer was not recorded. Try again.");
      } finally {
        set({ busy: false });
      }
    },
    next(packId) {
      const p = get().packs[packId];
      if (!p) return;
      const now = Date.now();
      put(packId, { ...p, pick: pickNext(p.ix, p.state, now), chosen: null, shownAt: now });
    },
  };
});

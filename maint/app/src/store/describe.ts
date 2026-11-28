import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logError } from "@appkit/log.ts";
import { reportError } from "@appkit/toast.ts";
import { jsonStorage } from "@appkit/storage.ts";
import { call } from "../engine/client.ts";
import type { ObservationInput, SymptomSearch } from "../engine/types.ts";

interface Entry {
  query: string;
  codes: ObservationInput[];
}

/** What the technician described, per unit, and the engine's ranked symptoms for it. */
interface DescribeState {
  entries: Record<string, Entry>;
  results: Record<string, SymptomSearch>;
  pending: Record<string, boolean>;
  setQuery(assetId: string, q: string): void;
  addCode(assetId: string, value: string): void;
  removeCode(assetId: string, i: number): void;
  search(assetId: string): Promise<void>;
}

const empty: Entry = { query: "", codes: [] };
let seq = 0;

export const useDescribe = create<DescribeState>()(
  persist(
    (set, get) => {
      const entry = (id: string) => get().entries[id] ?? empty;
      const put = (id: string, e: Entry) => set({ entries: { ...get().entries, [id]: e } });
      return {
        entries: {},
        results: {},
        pending: {},
        setQuery: (id, query) => put(id, { ...entry(id), query }),
        // A typed code carries no kind: the engine matches it against every kind the pack maps.
        addCode: (id, value) => put(id, { ...entry(id), codes: [...entry(id).codes, { signal_kind: null, value }] }),
        removeCode: (id, i) => put(id, { ...entry(id), codes: entry(id).codes.filter((_, j) => j !== i) }),
        async search(id) {
          const e = entry(id);
          if (!e.query.trim() && e.codes.length === 0) {
            const { [id]: _, ...results } = get().results;
            set({ results });
            return;
          }
          const mine = ++seq;
          set({ pending: { ...get().pending, [id]: true } });
          try {
            const r = await call("symptom.search", { asset_id: id, text: e.query.trim() || null, observations: e.codes });
            // A slower, older search never overwrites a newer one.
            if (mine === seq) set({ results: { ...get().results, [id]: r } });
          } catch (err) {
            logError("describe.search", err);
            reportError("describe.search", err, "The search did not run. Check the words and try again.");
          } finally {
            if (mine === seq) set({ pending: { ...get().pending, [id]: false } });
          }
        },
      };
    },
    { name: "maint.describe", storage: jsonStorage, version: 1, partialize: (s) => ({ entries: s.entries }) as unknown as DescribeState },
  ),
);

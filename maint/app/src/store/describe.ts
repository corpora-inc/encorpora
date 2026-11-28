import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logError } from "@appkit/log.ts";
import { reportError } from "@appkit/toast.ts";
import { jsonStorage } from "@appkit/storage.ts";
import { call } from "../engine/client.ts";
import type { ObservationInput, SignalMatch, SymptomSearch } from "../engine/types.ts";

interface Entry {
  query: string;
  codes: ObservationInput[];
}

/**
 * What is wrong with each unit: the technician's words and the unit's active
 * codes (read over a link, typed or pasted), the engine's ranked symptoms for
 * them, and what the engine makes of the codes.
 */
interface DescribeState {
  entries: Record<string, Entry>;
  results: Record<string, SymptomSearch>;
  pending: Record<string, boolean>;
  matches: Record<string, SignalMatch>;
  setQuery(assetId: string, q: string): void;
  addCode(assetId: string, value: string): void;
  addCodes(assetId: string, values: string[]): void;
  removeCode(assetId: string, i: number): void;
  clearCodes(assetId: string): void;
  matchCodes(assetId: string): Promise<void>;
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
        matches: {},
        setQuery: (id, query) => put(id, { ...entry(id), query }),
        // A typed code carries no kind: the engine matches it against every kind the pack maps.
        addCode: (id, value) => put(id, { ...entry(id), codes: [...entry(id).codes, { signal_kind: null, value }] }),
        addCodes: (id, values) => {
          const have = new Set(entry(id).codes.map((c) => c.value));
          const fresh = [...new Set(values)].filter((v) => !have.has(v)).map((value) => ({ signal_kind: null, value }));
          put(id, { ...entry(id), codes: [...entry(id).codes, ...fresh] });
        },
        removeCode: (id, i) => put(id, { ...entry(id), codes: entry(id).codes.filter((_, j) => j !== i) }),
        clearCodes: (id) => put(id, { ...entry(id), codes: [] }),
        async matchCodes(id) {
          const codes = entry(id).codes;
          if (codes.length === 0) {
            const { [id]: _, ...matches } = get().matches;
            set({ matches });
            return;
          }
          try {
            const m = await call("signal.match", { asset_id: id, observations: codes });
            set({ matches: { ...get().matches, [id]: m } });
          } catch (err) {
            reportError("describe.codes", err, "The codes could not be checked against the manual.");
          }
        },
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

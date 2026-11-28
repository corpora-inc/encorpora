import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { logError } from "./log.ts";
import { namespace } from "./namespace.ts";

/** localStorage that never throws: private mode or a full disk logs and carries on in memory. */
const memory = new Map<string, string>();
const safe: StateStorage = {
  getItem(name) {
    try {
      return localStorage.getItem(name) ?? memory.get(name) ?? null;
    } catch (e) {
      logError("storage.get", e);
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    memory.set(name, value);
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      logError("storage.set", e);
    }
  },
  removeItem(name) {
    memory.delete(name);
    try {
      localStorage.removeItem(name);
    } catch (e) {
      logError("storage.remove", e);
    }
  },
};

/** The one storage every persisted zustand store uses. */
export const jsonStorage = createJSONStorage(() => safe);

/** Bytes this app keeps in localStorage, for a storage screen. */
export function storedBytes(prefix = namespace()): number {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch (e) {
    logError("storage.size", e);
  }
  return n;
}

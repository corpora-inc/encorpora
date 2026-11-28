/** Instructor conversations, on the device: one store, each conversation at its own route. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Turn } from "../instructor/types.ts";
import { jsonStorage } from "../lib/storage.ts";

interface InstructorStore {
  conversations: Record<string, Conversation>;
  start(conv: Conversation): void;
  append(convId: string, turn: Turn): void;
  remove(convId: string): void;
}

export const useInstructor = create<InstructorStore>()(
  persist(
    (set) => ({
      conversations: {},
      start: (conv) => set((s) => ({ conversations: { ...s.conversations, [conv.conv_id]: conv } })),
      append: (convId, turn) =>
        set((s) => {
          const c = s.conversations[convId];
          return c ? { conversations: { ...s.conversations, [convId]: { ...c, turns: [...c.turns, turn] } } } : s;
        }),
      remove: (convId) =>
        set((s) => {
          const { [convId]: _gone, ...rest } = s.conversations;
          return { conversations: rest };
        }),
    }),
    { name: "crane.instructor", storage: jsonStorage, version: 1 },
  ),
);

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

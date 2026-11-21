import { useMutation, useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { qk } from "../../../lib/keys";
import { queryClient } from "../../../lib/query";
import { askForgotPicture, joinRosterOptions, readForgotPicture } from "./api";

/* "I forgot my pictures" (#2464): the student's side. The request is held on
   this device, per class and student, so a refresh comes back to the waiting
   screen; the server keeps it for 30 minutes. */

/** How long a held request counts: the server's own lifetime. */
const HELD_MS = 30 * 60_000;
/** How often the waiting screen asks whether the adult has reset. */
export const FORGOT_POLL_MS = 4_000;

type Held = {
  /** `code/personId` → when it was asked. */
  asked: Record<string, number>;
  ask: (key: string) => void;
  clear: (key: string) => void;
};

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("The picture request couldn’t be read here", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The picture request wasn’t kept on this device", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The picture request wasn’t cleared", error);
    }
  },
}));

export const useForgotStore = create<Held>()(
  persist(
    (set) => ({
      asked: {},
      ask: (key) =>
        set((held) => ({ asked: { ...held.asked, [key]: Date.now() } })),
      clear: (key) =>
        set((held) => {
          if (!(key in held.asked)) return held;
          const { [key]: _gone, ...rest } = held.asked;
          return { asked: rest };
        }),
    }),
    { name: "amp-forgot-picture", storage },
  ),
);

const forgotKey = (code: string, personId: string) => `${code}/${personId}`;

const stateKey = (code: string, personId: string) =>
  qk.account(null, "school", "join", code, "forgot", personId);

/** The one student-facing handle: whether the request is out, asking, and
 * taking it back. `waiting` polls the server while the page is shown, and a
 * `reset` answer refreshes the class list, whose changed pictures end the
 * wait (PicturesScreen). */
export function useForgotPicture(code: string, personId: string) {
  const key = forgotKey(code, personId);
  const heldAt = useForgotStore((held) => held.asked[key]);
  const waiting = heldAt !== undefined && Date.now() - heldAt < HELD_MS;
  const ask = useMutation({
    mutationFn: () => askForgotPicture({ code, personId }),
    onSuccess: () => useForgotStore.getState().ask(key),
    onError: (error) => console.warn("The picture request failed", error),
  });
  useQuery({
    queryKey: stateKey(code, personId),
    queryFn: async () => {
      const { state } = await readForgotPicture({ code, personId });
      if (state === "reset")
        await queryClient.invalidateQueries({
          queryKey: joinRosterOptions(code).queryKey,
        });
      // Withdrawn or timed out on the server: back to picking.
      if (state === "none") useForgotStore.getState().clear(key);
      return state;
    },
    enabled: waiting,
    // Paused by the library while the page is hidden.
    refetchInterval: FORGOT_POLL_MS,
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  return {
    waiting,
    asking: ask.isPending,
    failed: ask.isError,
    ask: () => ask.mutate(),
    /** The student remembered: back to picking. */
    giveUp: () => {
      ask.reset();
      useForgotStore.getState().clear(key);
    },
    /** The reset happened, or they signed in: nothing is held. */
    done: () => useForgotStore.getState().clear(key),
  };
}

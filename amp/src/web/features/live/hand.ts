import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  studentSignalsResponse,
  type StudentSignal,
} from "../../../schools/live/contracts";
import type { StudentLive } from "../../../schools/live/stream-contracts";
import { request } from "../../lib/api";
import { useSession } from "../../lib/session";
import { studentLiveKey } from "./api";

/* A student's raised hand (#2464): the one cache entry `useStudentLive` keeps
   is updated at once, then reconciled with what the server says. */

export const HAND_PENDING = "pending-hand";

/** The student's hand is up now: an open hand request they hold. */
export const handIsUp = (signals: readonly StudentSignal[]) =>
  signals.some((s) => s.kind === "hand" && s.resolvedAt === null);

/** `POST /school/student/signals` and `…/withdraw`: raise or lower. */
export function useHand() {
  const session = useSession();
  const client = useQueryClient();
  const key = studentLiveKey(session);
  const send = (path: "" | "/withdraw") =>
    request(`/school/student/signals${path}`, studentSignalsResponse, {
      token: session.token,
      method: "POST",
      body: { kind: "hand" },
    });
  const patch = (change: (held: StudentLive) => StudentLive) => {
    const held = client.getQueryData<StudentLive>(key);
    if (held) client.setQueryData<StudentLive>(key, change(held));
    return held;
  };
  const settle = () => client.invalidateQueries({ queryKey: key });
  const raise = useMutation({
    mutationFn: () => send(""),
    onMutate: () => {
      void client.cancelQueries({ queryKey: key });
      return patch((held) =>
        handIsUp(held.signals)
          ? held
          : {
              ...held,
              signals: [
                ...held.signals,
                {
                  id: HAND_PENDING,
                  classId: HAND_PENDING,
                  personId: HAND_PENDING,
                  kind: "hand",
                  createdAt: new Date().toISOString(),
                  resolvedAt: null,
                  resolution: null,
                },
              ],
            },
      );
    },
    onError: (error, _vars, before) => {
      console.error("Raising a hand failed", error);
      if (before) client.setQueryData(key, before);
    },
    onSettled: settle,
  });
  const lower = useMutation({
    mutationFn: () => send("/withdraw"),
    onMutate: () => {
      void client.cancelQueries({ queryKey: key });
      return patch((held) => ({
        ...held,
        signals: held.signals.filter(
          (s) => !(s.kind === "hand" && s.resolvedAt === null),
        ),
      }));
    },
    onError: (error, _vars, before) => {
      console.error("Lowering a hand failed", error);
      if (before) client.setQueryData(key, before);
    },
    onSettled: settle,
  });
  return { raise: raise.mutate, lower: lower.mutate };
}

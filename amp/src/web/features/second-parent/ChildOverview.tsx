import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { studentGrantResource } from "../../../schools/contracts";
import type { AuthSession } from "../../auth";
import { useLoggedError } from "../../feedback";
import { Home, type FrontierMap } from "../../Home";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { learnerFrontierOptions } from "../../lib/learning-view";
import { Toast } from "../../ui/Toast";
import { useFinishSignIn } from "../school/join/api";
import type { secondParentChild } from "./api";

const failures: Record<string, string> = {
  learner_cannot_practice:
    "This child needs access before practicing. Their family’s account holder adds it.",
  learner_not_found: "This child isn’t in your family’s class now.",
};

/** A child's Overview for their family's second parent (docs/families.md):
 * the same levels the account holder reads. Its one action hands this device
 * to the child, as "Let … practice here" does on the class; a child who can't
 * practice yet has none here, because access is the account holder's. */
export function ChildOverview({
  session,
  child,
  strands,
}: {
  session: AuthSession;
  child: NonNullable<ReturnType<typeof secondParentChild>>;
  strands: readonly string[];
}) {
  const frontier = useQuery(learnerFrontierOptions(session, child.id));
  const finish = useFinishSignIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const handOver = async () => {
    setBusy(true);
    try {
      const grant = await request(
        `/family/learners/${encodeURIComponent(child.id)}/practice-here`,
        studentGrantResource,
        { token: session.token, body: {} },
      );
      await finish(grant, true, `/${child.classPath}`);
    } catch (failure) {
      console.error("Practice on this device didn’t start", failure);
      setError(
        (failure instanceof AppError &&
          failure.code &&
          failures[failure.code]) ||
          "Practice didn’t start. Try again in a moment.",
      );
      setBusy(false);
    }
  };
  return (
    <>
      <Home
        name={child.name}
        birthYear={child.birthYear}
        resuming={false}
        frontier={(frontier.data as FrontierMap | undefined) ?? null}
        strands={strands}
        busy={busy}
        {...(child.entitlement.active
          ? {
              go: () => void handOver(),
              goLabel: `Let ${child.name} practice here`,
            }
          : {})}
      />
      <Toast
        message={
          error ||
          (frontier.isError
            ? `${child.name}’s levels didn’t load. Refresh to try again.`
            : "")
        }
        onDismiss={() => setError("")}
      />
    </>
  );
}

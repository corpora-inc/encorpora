import { useState } from "react";
import { studentGrantResource } from "../../../../../schools/contracts";
import type { AuthSession } from "../../../../auth";
import { request } from "../../../../lib/api";
import { AppError } from "../../../../lib/AppError";
import { useFinishSignIn } from "../../join/api";

const failures: Record<string, string> = {
  learner_cannot_practice:
    "This child needs access before practicing. Open Family to add it.",
  learner_not_found:
    "That child isn’t in your class now. Refresh and try again.",
};

/** "Let Fox practice here": starts that child's own session on this device
 * and goes straight to practice; the parent's view returns when they sign
 * out (docs/families.md). `starting` holds the one child it's starting. */
export function useHandOver(session: AuthSession) {
  const finish = useFinishSignIn();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const handOver = async (learnerId: string) => {
    setStarting(learnerId);
    try {
      const grant = await request(
        `/family/learners/${learnerId}/practice-here`,
        studentGrantResource,
        { token: session.token, body: {} },
      );
      await finish(grant, true);
    } catch (failure) {
      console.error("Practice on this device didn’t start", failure);
      setError(
        (failure instanceof AppError &&
          failure.code &&
          failures[failure.code]) ||
          "Practice didn’t start. Try again in a moment.",
      );
      setStarting(null);
    }
  };
  return { starting, error, clearError: () => setError(""), handOver };
}

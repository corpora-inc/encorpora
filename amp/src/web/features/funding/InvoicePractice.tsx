import { Link } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { selectLearner } from "../../learner-store";
import { Button, buttonClass } from "../../ui/Button";
import { useHandOver } from "../school/classes/today/use-hand-over";
import { practiceParams } from "../spaces/identity";

/** Invoice access uses the same child session as the family's Practice action. */
export function InvoicePractice({
  session,
  learnerId,
  adult,
}: {
  session: AuthSession;
  learnerId: string;
  adult: boolean;
}) {
  const { handOver, starting, error } = useHandOver(session);
  return (
    <>
      {adult ? (
        <Link
          to="/$"
          params={practiceParams(learnerId)}
          className={buttonClass("primary")}
          onClick={() => selectLearner(learnerId)}
        >
          Start learning
        </Link>
      ) : (
        <Button
          variant="primary"
          disabled={!!starting}
          aria-busy={!!starting}
          onClick={() => void handOver(learnerId)}
        >
          Start learning
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

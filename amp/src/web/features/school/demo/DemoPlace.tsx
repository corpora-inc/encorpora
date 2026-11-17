import { useState } from "react";
import { studentGrantResource } from "../../../../schools/contracts";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";
import { Button } from "../../../ui/Button";
import { Toast } from "../../../ui/Toast";
import { currentSession } from "../core-api";
import { useFinishSignIn } from "../join/api";
import styles from "./Demo.module.css";

// The bar's action and the demo test are the shell's (DemoSetupAction.tsx).
export { DemoSetupAction, useDemoOrg } from "./DemoSetupAction";

const failures: Record<string, string> = {
  not_found: "That student isn’t in this demo now. Refresh and try again.",
};
/** "Practice as": this device practices as one of the demo's made-up
 * students, as their own device would, until it signs out back to here. */
export function PracticeAs({
  student,
  returnName,
}: {
  student: { id: string; name: string };
  /** The class this roster is: the way back is named for it. */
  returnName?: string;
}) {
  const finish = useFinishSignIn();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setStarting(true);
    try {
      const grant = await request(
        `/school/demo/students/${student.id}/session`,
        studentGrantResource,
        { token: currentSession().token, body: {} },
      );
      // Signing out comes back to this roster.
      await finish(
        grant,
        true,
        location.pathname,
        undefined,
        undefined,
        returnName,
      );
    } catch (failure) {
      console.error("Practice as a demo student didn’t start", failure);
      setError(
        (failure instanceof AppError &&
          failure.code &&
          failures[failure.code]) ||
          "Practice didn’t start. Try again in a moment.",
      );
      setStarting(false);
    }
  };
  return (
    <>
      <Button
        variant="secondary"
        className={styles.practice}
        aria-label={`Practice as ${student.name}`}
        aria-busy={starting || undefined}
        disabled={starting}
        onClick={() => void start()}
      >
        Practice as
      </Button>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

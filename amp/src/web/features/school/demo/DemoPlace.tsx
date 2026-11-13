import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { studentGrantResource } from "../../../../schools/contracts";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";
import bar from "../../../ui/AppBar.module.css";
import { Button } from "../../../ui/Button";
import { Toast } from "../../../ui/Toast";
import { currentSession, orgOptions } from "../api";
import { useFinishSignIn } from "../join/api";
import styles from "./Demo.module.css";

/** Demo records stay separate from the real classroom. */
export const REAL_SETUP_PATH = "school/start";
export const REAL_SETUP_HASH = "";

/** Whether this org is a demo, from the org the frame already loaded. */
export function useDemoOrg(orgId: string) {
  return useQuery(orgOptions(currentSession(), orgId)).data?.demo === true;
}

/** The bar's one action in a demo: the way to the real class or school. Its
 * full label from 640 px, a short one on a phone, always a 44 px target. */
export function DemoSetupAction({ school }: { school: boolean }) {
  const label = school ? "Connect your school" : "Set up your real class";
  // A phone keeps a short word beside the arrow: an arrow alone says nothing.
  const short = school ? "Connect" : "Real class";
  return (
    <Link
      to="/$"
      params={{ _splat: school ? "school/connect" : REAL_SETUP_PATH }}
      hash={REAL_SETUP_HASH}
      className={`${bar.actionLink} ${styles.action}`}
      aria-label={label}
      data-demo-action
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.long}>{label}</span>
      <span className={styles.short} aria-hidden="true">
        {short}
      </span>
    </Link>
  );
}

const failures: Record<string, string> = {
  not_found: "That student isn’t in this demo now. Refresh and try again.",
};
/** "Practice as": this device practices as one of the demo's made-up
 * students, as their own device would, until it signs out back to here. */
export function PracticeAs({
  student,
}: {
  student: { id: string; name: string };
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
      await finish(grant, true, location.pathname);
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

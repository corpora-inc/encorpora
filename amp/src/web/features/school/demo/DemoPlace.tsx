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

/** Where a demo's owner sets up the real thing: never the demo converted in
 * place. A teacher's class starts with the data agreement and the roster, and
 * a school's with a person; both begin at "Talk to us" (white-glove). */
export const REAL_SETUP_PATH = "schools";
export const REAL_SETUP_HASH = "talk";

/** The quiet "Demo" label beside a demo place's name. */
export function DemoMark() {
  return (
    <span className={styles.mark} data-demo-mark>
      Demo
    </span>
  );
}

/** Whether this org is a demo, from the org the frame already loaded. */
export function useDemoOrg(orgId: string) {
  return useQuery(orgOptions(currentSession(), orgId)).data?.demo === true;
}

/** The bar's one action in a demo: the way to the real class or school. A
 * label from 640 px, the arrow on a phone, always a 44 px target. */
export function DemoSetupAction({ school }: { school: boolean }) {
  const label = school ? "Talk to us" : "Set up your real class";
  return (
    <Link
      to="/$"
      params={{ _splat: REAL_SETUP_PATH }}
      hash={REAL_SETUP_HASH}
      className={bar.actionLink}
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
      <span className={bar.actionLabel}>{label}</span>
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
      await finish(grant, true);
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

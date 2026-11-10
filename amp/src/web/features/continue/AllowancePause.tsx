import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { track } from "../../lib/analytics";
import { sessionOptions } from "../../lib/query";
import { TalkToUs } from "../schools/TalkToUs";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { rememberContinuation } from "./memory";
import styles from "./Continue.module.css";

/** Who is looking at a learner whose free allowance ended. */
export type PauseViewer = "parent" | "adult" | "student" | "staff";

/** A parent or a child is the family's pause; a teacher is the class. */
const pauseFor = {
  parent: "family",
  student: "family",
  adult: "adult",
  staff: "class",
} as const satisfies Record<PauseViewer, "family" | "adult" | "class">;

/** The words the pause says, by who is looking and what ended. */
export function pauseWords(
  kind: "problems" | "workbooks",
  viewer: PauseViewer,
  name: string,
) {
  if (kind === "workbooks")
    return {
      fact: "The five free workbooks are used.",
      detail: "Past workbooks and their results stay here.",
    };
  if (viewer === "student")
    return {
      fact: "You’ve finished the free problems.",
      detail: "Your grown-up can continue AMP.",
    };
  if (viewer === "adult") return { fact: "You’ve used the 100 free problems." };
  return { fact: `${name} has used the 100 free problems.` };
}

/**
 * The one pause when a learner's free problems or workbooks end, in place on
 * the screen they were using. It names the learner and the fact, then gives
 * the one action that works for whoever is looking: a parent or an adult
 * continues with AMP for that learner and comes back here; a class's teacher
 * talks to us; a student is told who can continue.
 */
export function AllowancePause({
  kind,
  viewer,
  learner,
  compact = false,
}: {
  kind: "problems" | "workbooks";
  viewer: PauseViewer;
  /** Whose allowance ended. A class's teacher looking at several needs none. */
  learner?: { id: string; name: string };
  /** Inside a screen with its own heading, rather than in place of it. */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const session = useQuery(sessionOptions).data;
  const here = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  });
  const words = pauseWords(kind, viewer, learner?.name ?? "");
  const headingId = `pause-${kind}-${learner?.id ?? viewer}`;
  const Heading = compact ? "h2" : "h1";
  const continued = useRef(false);
  // One record per showing. The second frame cancels the first, so strict
  // mode and a re-render do not count the pause twice. A new learner, kind,
  // or viewer is a new showing.
  useEffect(() => {
    let frame = 0,
      sent = false;
    const visible = () => {
      if (document.visibilityState !== "visible" || sent) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (sent || document.visibilityState !== "visible") return;
          sent = true;
          track("allowance_pause_view", { for: pauseFor[viewer] });
        });
      });
    };
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [kind, viewer, learner?.id]);
  return (
    <section
      className={compact ? styles.pauseCompact : styles.pause}
      data-allowance-pause={kind}
      data-viewer={viewer}
      aria-labelledby={headingId}
    >
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 7v10M15 7v10" />
        </svg>
      </span>
      <Heading id={headingId} className={styles.fact}>
        {words.fact}
      </Heading>
      {words.detail && <p className={styles.detail}>{words.detail}</p>}
      {(viewer === "parent" || viewer === "adult") && learner && (
        <Button
          variant="primary"
          className={styles.action}
          data-continue-with-amp={learner.id}
          disabled={!session}
          onClick={() => {
            if (!session) return;
            if (!continued.current) {
              continued.current = true;
              track("continue_click");
            }
            rememberContinuation({
              accountId: session.accountId,
              learnerId: learner.id,
              returnTo: here,
            });
            void navigate({
              to: "/continue/$learnerId",
              params: { learnerId: learner.id },
            });
          }}
        >
          Continue with AMP
        </Button>
      )}
      {viewer === "staff" && (
        <TalkToUsButton variant="primary" className={styles.action} />
      )}
    </section>
  );
}

/** "Talk to us" for a class or a school, with the inline contact form in a
 * sheet over the screen: a class's access is set up with a person. */
export function TalkToUsButton({
  variant = "quiet",
  className = "",
}: {
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
}) {
  const [talking, setTalking] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setTalking(true)}
      >
        Talk to us
      </Button>
      <Sheet open={talking} onOpenChange={setTalking} title="Talk to us" tall>
        <p className={styles.sheetText}>
          Tell us about your class or school, and we’ll set AMP up with you.
        </p>
        <TalkToUs />
      </Sheet>
    </>
  );
}

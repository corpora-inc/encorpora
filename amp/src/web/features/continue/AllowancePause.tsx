import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { track } from "../../lib/analytics";
import { meOptions, queryClient } from "../../lib/query";
import { useSessionOrNull } from "../../lib/session";
import { payLearnerFor } from "../pay/paths";
import { learnerOrigin, payOver } from "../pay/address";
import { TalkToUs } from "../schools/TalkToUs";
import { Button, buttonClass } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { useErrorToast } from "../../ui/useErrorToast";
import { rememberContinuation } from "./memory";
import { RecapLine } from "./Recap";
import styles from "./Continue.module.css";

/** Who is looking at a learner whose free allowance ended. `profile`: an
 * adult practicing as one of their practice profiles. */
export type PauseViewer = "parent" | "adult" | "profile" | "student" | "staff";

/** A parent's device handed to their child ("Practice", or the child's
 * practice opened by its address), as the practice screen that shows the
 * pause knows it: the child's page in their family, and how the parent
 * takes the device back (their sign-in, or null if it ended). */
export type HandedPause = {
  childPage: string;
  takeBack: () => Promise<{ accountId: string } | null>;
};
/** A parent or a child is the family's pause; a teacher is the class. */
const pauseFor = {
  parent: "family",
  student: "family",
  adult: "adult",
  // An adult practicing as one of their profiles.
  profile: "adult",
  staff: "class",
} as const satisfies Record<PauseViewer, "family" | "adult" | "class">;

/** The words the pause says, by who is looking and what ended. */
export function pauseWords(
  kind: "problems" | "workbooks",
  viewer: PauseViewer,
  name: string,
  /** A parent's device handed to this child: the parent's words. */
  handed = false,
) {
  if (kind === "workbooks")
    return {
      fact: "The five free workbooks are used.",
      detail: "Past workbooks and their results stay here.",
    };
  if (viewer === "student" && !handed)
    return {
      fact: "You’ve finished the free problems.",
      detail: "Your grown-up can continue AMP.",
    };
  if (viewer === "adult") return { fact: "You’ve used the 100 free problems." };
  if (viewer === "profile")
    return {
      fact: `${name} has used its 100 free problems.`,
      detail: "Your own plan covers every level you try.",
    };
  return { fact: `${name} has used the 100 free problems.` };
}

/**
 * The one pause when a learner's free problems or workbooks end, in place on
 * the screen they were using. It names the learner and the fact, then gives
 * the one action that works for whoever is looking: a parent or an adult
 * continues with AMP for that learner and comes back here; a class's teacher
 * talks to us; a student on their own device is told who can continue. On a
 * parent's device handed to their child, the parent is offered what their
 * own sign-in offers, and the tap takes the device back to them
 * (`handed`).
 */
export function AllowancePause({
  kind,
  viewer,
  learner,
  compact = false,
  handed,
  returnTo,
}: {
  kind: "problems" | "workbooks";
  viewer: PauseViewer;
  /** Whose allowance ended. A class's teacher looking at several needs none. */
  learner?: { id: string; name: string };
  /** Inside a screen with its own heading, rather than in place of it. */
  compact?: boolean;
  /** This child's sign-in is on their parent's device. */
  handed?: HandedPause;
  /** Where paying returns, when it isn't this screen: a child's practice is
   * the child's own sign-in, so a parent returns to the child's page. */
  returnTo?: string;
}) {
  const navigate = useNavigate();
  const session = useSessionOrNull();
  const here = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  });
  // A parent's device in their child's hands: the offer the parent's own
  // sign-in shows, which takes the device back to them as it opens.
  const back =
    viewer === "student" && kind === "problems" && learner ? handed : undefined;
  const [returning, setReturning] = useState(false);
  const errors = useErrorToast();
  const words = pauseWords(kind, viewer, learner?.name ?? "", !!back);
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
      {kind === "problems" && viewer === "adult" && learner && (
        <RecapLine learnerId={learner.id} withAnswered={false} />
      )}
      {(viewer === "parent" || viewer === "adult" || viewer === "profile") &&
        learner && (
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
              // A practice profile's plan is its family's (paths.ts).
              const me = queryClient.getQueryData(meOptions(session).queryKey);
              const payer =
                (me?.signedIn && payLearnerFor(me, learner.id)?.id) ||
                learner.id;
              rememberContinuation({
                accountId: session.accountId,
                learnerId: payer,
                returnTo: returnTo ?? here,
              });
              // Paying opens over the learner's own place (features/pay).
              void navigate({
                to: (me?.signedIn
                  ? payOver(learnerOrigin(me, payer), payer)
                  : payOver("/account/billing", payer)) as never,
              });
            }}
          >
            Continue with AMP
          </Button>
        )}
      {back && learner && (
        <Button
          variant="primary"
          className={styles.action}
          data-continue-with-amp={learner.id}
          aria-busy={returning || undefined}
          onClick={() => {
            if (returning) return;
            setReturning(true);
            // The device goes back to the parent (a family hand-over ends,
            // as its way home ends it), and paying opens over the child's
            // page on the parent's own sign-in.
            void back
              .takeBack()
              .then((parent) => {
                if (!continued.current) {
                  continued.current = true;
                  track("continue_click");
                }
                if (parent && !parent.accountId.startsWith("school:"))
                  rememberContinuation({
                    accountId: parent.accountId,
                    learnerId: learner.id,
                    returnTo: back.childPage,
                  });
                return navigate({
                  to: payOver(back.childPage, learner.id) as never,
                });
              })
              .catch((failure: unknown) => {
                setReturning(false);
                errors.report(failure, {
                  doing: "open Continue with AMP",
                  fallback: "That didn’t open. Try again.",
                });
              });
          }}
        >
          Continue with AMP
        </Button>
      )}
      {errors.toast}
      {viewer === "staff" && (
        <TalkToUsButton variant="primary" className={styles.action} />
      )}
      {viewer === "adult" && !compact && (
        <Link to="/me" className={buttonClass("quiet")}>
          See your progress
        </Link>
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

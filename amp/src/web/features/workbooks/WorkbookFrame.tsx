import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthSession } from "../../auth";
import { meOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import type { PauseViewer } from "../continue/AllowancePause";
import { canReadWorkbooks, type WorkbookAccess } from "./model";
import styles from "./Workbooks.module.css";

export type WorkbookLearner = { id: string; name: string } & WorkbookAccess & {
    /** Who sees the pause once the five free workbooks are used. */
    pauseViewer: PauseViewer;
  };

/** Whose workbooks these are, as the screen says it: the adult's own are
 * "yours" and never named; anyone else's carry a small, quiet label. */
export function whose(learner: Pick<WorkbookLearner, "name" | "pauseViewer">) {
  const own = learner.pauseViewer === "adult";
  return { own, label: own ? null : learner.name };
}

/** The way back to the learner's workbooks, above a workbook's own title. */
export function WorkbookTrail({ learner }: { learner: WorkbookLearner }) {
  const who = whose(learner);
  return (
    <nav className={styles.trail} aria-label="Workbooks">
      <Link
        to="/learners/$learnerId/workbooks"
        params={{ learnerId: learner.id }}
        className={styles.trailLink}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
        {who.own ? "Your workbooks" : `${learner.name}’s workbooks`}
      </Link>
    </nav>
  );
}

/** Workbook content on AppShell for an account-owned learner with learning
 * permission; workbook history does not depend on a license. */
export function WorkbookFrame({
  session,
  learnerId,
  busy = false,
  children,
}: {
  session: AuthSession;
  learnerId: string;
  busy?: boolean;
  children: (learner: WorkbookLearner) => ReactNode;
}) {
  const me = useQuery(meOptions(session));
  const data =
    me.data?.signedIn && me.data.account.id === session.accountId
      ? me.data
      : null;
  const learner = data?.family.learners.find(
    (l) => l.id === learnerId && !l.deletedAt,
  );
  let body: ReactNode;
  if (!data)
    body = me.error ? (
      <div className={styles.notice}>
        <h1 className={styles.title}>Workbooks</h1>
        <p role="alert">
          Your family details didn't load. Check your connection and try again.
        </p>
        <Button variant="primary" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    ) : (
      <div className={`${styles.skeleton} amp-skeleton`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  else if (!learner)
    body = (
      <div className={styles.notice}>
        <h1 className={styles.title}>Workbooks</h1>
        <p>This learner isn't in your family. Choose a learner in Family.</p>
        <Link
          to="/$"
          params={{ _splat: "family" }}
          className={buttonClass("primary")}
        >
          Open Family
        </Link>
      </div>
    );
  else if (!canReadWorkbooks(learner))
    body = (
      <div className={styles.notice}>
        {!(learner.adult && !learner.simulation) && (
          <p className={styles.learnerLabel}>{learner.name}</p>
        )}
        <h1 className={styles.title}>Workbooks</h1>
        <p>
          {learner.adult && !learner.simulation
            ? "Workbooks come with your practice. Finish setting up your access to print one."
            : `Workbooks come with ${learner.name}’s practice. Finish setting up their access to print one.`}
        </p>
        <Link
          to="/$"
          params={{ _splat: "family/access" }}
          className={buttonClass("primary")}
        >
          Review access
        </Link>
      </div>
    );
  // A parent continues with AMP. An adult's own practice and a child's
  // session have no purchase to offer.
  else
    body = children({
      ...learner,
      pauseViewer:
        data.account.kind === "student"
          ? "student"
          : learner.simulation
            ? "profile"
            : learner.adult
              ? "adult"
              : "parent",
    });
  return (
    <main className={styles.page} aria-busy={!data || busy}>
      {body}
    </main>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import type { ReactNode } from "react";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
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

/** A learner's workbooks, on a standard Page under the app frame, for an
 * account-owned learner with learning permission; workbook history does not
 * depend on a license. Each screen draws its own header. */
export function WorkbookFrame({
  learnerId,
  busy = false,
  children,
}: {
  learnerId: string;
  busy?: boolean;
  children: (learner: WorkbookLearner) => ReactNode;
}) {
  const session = useSession();
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
        <PageHeader title="Workbooks" />
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
        <PageHeader title="Workbooks" />
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
        <PageHeader
          title="Workbooks"
          subtitle={learner.adult && !learner.simulation ? null : learner.name}
        />
        <p>
          {learner.adult && !learner.simulation
            ? "Workbooks come with your practice. Finish setting up your access to print one."
            : `Workbooks come with ${learner.name}’s practice. Finish setting up their access to print one.`}
        </p>
        <Link
          to="/$"
          params={{ _splat: "account/billing" }}
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
  return <Page aria-busy={!data || busy}>{body}</Page>;
}

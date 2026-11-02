import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthSession } from "../../auth";
import { meOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import styles from "./Workbooks.module.css";

export type WorkbookLearner = { id: string; name: string };

/** The workbook card, once the learner is known to belong to this account
 * and to have practice (consent and a license, as the server checks). */
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
      <div className={styles.skeleton} aria-hidden="true">
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
  else if (!learner.canPractice)
    body = (
      <div className={styles.notice}>
        <h1 className={styles.title}>Workbooks for {learner.name}</h1>
        <p>
          Daily workbooks come with {learner.name}'s practice. Finish setting up
          their access to print one.
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
  else body = children({ id: learner.id, name: learner.name });
  return (
    <PageFrame>
      <section
        className={`${frameCard} ${styles.card}`}
        aria-busy={!data || busy}
      >
        {body}
      </section>
    </PageFrame>
  );
}

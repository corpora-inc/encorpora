import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { workbookHistoryOptions } from "./api";
import { localDate } from "./model";
import { WorkbookFrame, type WorkbookLearner } from "./WorkbookFrame";
import { WorkbookList } from "./WorkbookList";
import styles from "./Workbooks.module.css";

export function WorkbookHistoryScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const { learnerId } = useParams({ strict: false }) as { learnerId: string };
  if (!session) return <Navigate to="/sign-in" replace />;
  return (
    <WorkbookFrame session={session} learnerId={learnerId}>
      {(learner) => <History session={session} learner={learner} />}
    </WorkbookFrame>
  );
}

function History({
  session,
  learner,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
}) {
  const history = useQuery(workbookHistoryOptions(session, learner.id));
  return (
    <>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{learner.name} · Daily workbooks</p>
      </div>
      <h1 className={styles.title}>Workbooks</h1>
      <p className={styles.lede}>
        A new workbook every day, chosen from {learner.name}'s practice: a
        warm-up, today's idea, practice, review and a challenge, with an answer
        key.
      </p>
      <Link
        to="/learners/$learnerId/workbooks/$date"
        params={{ learnerId: learner.id, date: localDate() }}
        className={buttonClass("primary", styles.today)}
      >
        Today's workbook
      </Link>
      {history.data && !history.data.workbooks.length ? (
        <p className={styles.empty}>Workbooks you make appear here.</p>
      ) : (
        <WorkbookList
          session={session}
          learnerId={learner.id}
          query={history}
        />
      )}
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { buttonClass } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { PublicFrame } from "../../schools/PublicFrame";
import { buyerOptions } from "./api";
import styles from "./Pilot.module.css";

export function BuyerHandoffScreen() {
  const { token } = useParams({ strict: false }) as { token: string };
  const request = useQuery(buyerOptions(token));
  const data = request.data;
  const ends = [
    ...new Set(
      data?.pilots
        .map((pilot) => pilot.endsAt)
        .filter((date): date is string => !!date),
    ),
  ].sort();
  const subject = data
    ? `AMP seats for ${data.schoolName}`
    : "AMP school seats";
  const body = data
    ? `We would like to discuss ${data.seats} AMP seats for ${data.schoolName}.\n\nRequest reference: ${data.id}\n\nOur purchasing requirements:\n`
    : "";
  return (
    <PublicFrame>
      <main className={styles.page}>
        <meta name="referrer" content="no-referrer" />
        {request.isPending ? (
          <Loading>Opening the school’s request</Loading>
        ) : !data ? (
          <>
            <h1>This sharing link is unavailable</h1>
            <p>
              Ask the teacher for a fresh buyer link, or contact
              support@corpora.inc.
            </p>
          </>
        ) : (
          <>
            <header>
              <h1>AMP for {data.schoolName}</h1>
              <p className={styles.lead}>
                Your teacher is ready to discuss seats for adaptive math
                practice from counting through precalculus.
              </p>
            </header>
            <dl className={styles.facts}>
              <div>
                <dt>Seats requested</dt>
                <dd>{data.seats}</dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>{data.classCount}</dd>
              </div>
              <div>
                <dt>Students practicing</dt>
                <dd>{data.participating}</dd>
              </div>
            </dl>
            <p>
              {data.students}{" "}
              {data.students === 1 ? "student is" : "students are"} on these
              class rosters.
              {ends.length
                ? ` Pilot end date: ${ends.map((date) => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(new Date(date))).join(" and ")}.`
                : ""}
            </p>
            <p>
              Tell us your purchasing requirements and the number of students
              you want to include. We’ll agree on pricing and help with your
              school’s purchase order or invoice process.
            </p>
            <a
              href={`mailto:support@corpora.inc?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className={buttonClass("primary")}
            >
              Discuss seats with Corpora
            </a>
            <p className={styles.status}>Request reference: {data.id}</p>
          </>
        )}
      </main>
    </PublicFrame>
  );
}

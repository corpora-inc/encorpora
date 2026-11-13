import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLoggedError } from "../../../feedback";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { PublicFrame } from "../../schools/PublicFrame";
import { TalkToUs } from "../../schools/TalkToUs";
import { Lead, PlainPage } from "../PlainPage";
import { buyerOptions } from "./api";
import { prepareBuyerHandoff } from "./buyer-session";
import { practiceDate } from "./presentation";
import styles from "./Pilot.module.css";

/** `/schools/continue`: what a teacher sends the person who buys for their
 * school. The class in three numbers, then a quote request that already
 * carries the school, the seats and the reference. */
export function BuyerHandoffScreen() {
  const [token] = useState(prepareBuyerHandoff);
  const request = useQuery({ ...buyerOptions(token ?? ""), enabled: !!token });
  const data = request.data;
  useLoggedError(
    request.isError || !token ? "The buyer link didn’t open." : "",
  );
  if (token && request.isPending)
    return (
      <PublicFrame>
        <LoadingScreen overlay />
      </PublicFrame>
    );
  if (!data)
    return (
      <PublicFrame>
        <PlainPage title="This link has expired">
          <meta name="referrer" content="no-referrer" />
          <Lead>Ask the teacher for a new one.</Lead>
        </PlainPage>
      </PublicFrame>
    );
  const purchased = data.status === "active";
  const ends = data.pilots
    .map((pilot) => pilot.endsAt)
    .filter((date): date is string => !!date)
    .sort()
    .at(-1);
  const reference = data.id.slice(0, 8).toUpperCase();
  const facts = [
    ["Seats", data.seats],
    ["Classes", data.classCount],
    ...(data.participating > 0
      ? ([["Practicing", data.participating]] as const)
      : []),
  ] as const;
  return (
    <PublicFrame>
      <PlainPage title={`AMP for ${data.schoolName}`}>
        <meta name="referrer" content="no-referrer" />
        <Lead>
          {purchased
            ? "Your seats are confirmed. Students have access."
            : `${data.classCount === 1 ? "A class is" : `${data.classCount} classes are`} ready for AMP: counting to precalculus, every student at their own level.`}
        </Lead>
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.quiet}>
          {data.students.toLocaleString()}{" "}
          {data.students === 1 ? "student" : "students"}
          {!purchased && ends && new Date(ends) > new Date()
            ? ` · pilot through ${practiceDate(ends)}`
            : ""}
          {" · "}
          <span className={styles.nowrap}>Reference {reference}</span>
        </p>
        {purchased ? (
          <p className={styles.quiet}>Need more seats? support@corpora.inc</p>
        ) : (
          <section className={styles.quote} aria-labelledby="buyer-quote">
            <h2 id="buyer-quote">Get a quote</h2>
            <p className={styles.quiet}>
              We’ll set up pricing, a quote and a purchase order with you.
            </p>
            <TalkToUs
              prefill={{
                school: data.schoolName,
                students: data.seats,
                message: `Reference ${reference}`,
              }}
            />
          </section>
        )}
      </PlainPage>
    </PublicFrame>
  );
}

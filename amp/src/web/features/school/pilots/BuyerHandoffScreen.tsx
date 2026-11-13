import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { PublicFrame } from "../../schools/PublicFrame";
import { TalkToUs } from "../../schools/TalkToUs";
import { ContactAddress } from "../../support/ContactAddress";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { Lead, PlainPage } from "../PlainPage";
import { buyerOptions } from "./api";
import { prepareBuyerHandoff } from "./buyer-session";
import { practiceDate } from "./presentation";
import styles from "./Pilot.module.css";

/** `/schools/continue`: what a teacher sends the person who buys for their
 * school. The request in a few numbers, the teacher's note in their words,
 * then a quote request that carries the school, the seats, the reference and
 * the note without asking for them again. */
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
  if (!data) {
    const expired =
      !token ||
      (request.error instanceof AppError && request.error.status === 404);
    return (
      <PublicFrame>
        <PlainPage
          title={
            expired ? "This link has expired" : "This request couldn’t load"
          }
        >
          <meta name="referrer" content="no-referrer" />
          <Lead>
            {expired
              ? "Ask the teacher for a new one."
              : "Check your connection and try again."}
          </Lead>
          {!expired && (
            <Button
              variant="primary"
              aria-busy={request.isFetching}
              onClick={() => void request.refetch()}
            >
              Try again
            </Button>
          )}
        </PlainPage>
      </PublicFrame>
    );
  }
  const purchased = data.status === "active";
  const covered =
    data.students > 0 &&
    data.pilots.length > 0 &&
    data.pilots.every(
      (pilot) =>
        !!pilot.coverage && pilot.coverage.covered >= pilot.coverage.students,
    );
  const ends = data.pilots
    .map((pilot) => pilot.endsAt)
    .filter((date): date is string => !!date)
    .sort()
    .at(-1);
  // Carried with the quote request, never shown: the buyer has no use for
  // an internal reference.
  const reference = data.id.slice(0, 8).toUpperCase();
  const note = data.note.trim();
  const practicing =
    !purchased && ends && new Date(ends) > new Date() ? ends : null;
  return (
    <PublicFrame>
      <PlainPage title={`AMP for ${data.schoolName}`}>
        <meta name="referrer" content="no-referrer" />
        <Lead>
          {purchased
            ? `Your seats are confirmed.${covered ? " Students have access." : ""}`
            : `${data.classCount === 1 ? "A class is" : `${data.classCount} classes are`} ready for AMP: counting to precalculus, every student at their own level.`}
        </Lead>
        {/* Each number once: the seats asked for, the classes, and who is
            practicing now. */}
        <StatRow label="This request">
          <StatTile label="Seats" value={data.seats.toLocaleString()} />
          <StatTile
            label="Classes"
            value={data.classCount.toLocaleString()}
            detail={
              practicing
                ? `Practice through ${practiceDate(practicing)}`
                : undefined
            }
          />
          {data.participating > 0 && (
            <StatTile
              label="Practicing"
              value={data.participating.toLocaleString()}
            />
          )}
        </StatRow>
        {note && (
          <figure className={styles.note}>
            <blockquote>{note}</blockquote>
            {data.teacher && <figcaption>{data.teacher}</figcaption>}
          </figure>
        )}
        {purchased ? (
          <div className={styles.support}>
            <p className={styles.quiet}>Need more seats?</p>
            <ContactAddress />
          </div>
        ) : (
          <section className={styles.quote} aria-labelledby="buyer-quote">
            <h2 id="buyer-quote">Get a quote</h2>
            <p className={styles.quiet}>
              We’ll set up pricing, a quote and a purchase order with you.
            </p>
            <TalkToUs
              known={{
                school: data.schoolName,
                students: data.seats,
                context: [
                  `Buyer request ${reference}: ${data.seats} seats, ${data.classCount} ${data.classCount === 1 ? "class" : "classes"}.`,
                  note ? `${data.teacher ?? "The teacher"} wrote: ${note}` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              }}
            />
          </section>
        )}
      </PlainPage>
    </PublicFrame>
  );
}

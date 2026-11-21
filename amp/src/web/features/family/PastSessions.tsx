import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { sessionsOptions } from "../live/api";
import { percentText } from "../live/format";
import { familyHref } from "./FamilyFrame";
import styles from "./FamilyLive.module.css";

const FIRST = 5;
const STEP = 10;
const PAGE = 20;

const when = (at: string) =>
  new Date(at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * A family's past practice sessions at the foot of its Today, newest first,
 * each a line opening its report: when, how long, problems and percent
 * right. Nothing renders before the first one has ended (ia.md rule 1), so
 * a family that never starts a session never sees it. Five at first, then
 * older ones on request. The first page arrives with the route.
 */
export function PastSessions({
  family,
  place,
}: {
  family: string;
  place: { org: string; class: string };
}) {
  const session = useSession();
  const [shown, setShown] = useState(FIRST);
  const pages = Math.max(1, Math.ceil(shown / PAGE));
  const reads = useQueries({
    queries: Array.from({ length: pages }, (_, page) =>
      sessionsOptions(session, place, page * PAGE),
    ),
  });
  const ended = reads
    .flatMap((read) => read.data?.sessions ?? [])
    .filter((row) => row.endedAt !== null);
  if (ended.length === 0) return null;
  const more = ended.length > shown || reads.at(-1)?.data?.nextOffset != null;
  return (
    <section aria-labelledby="family-sessions" data-past-sessions="">
      <h2 id="family-sessions" className={styles.title}>
        Past sessions
      </h2>
      <ul className={styles.sessions}>
        {ended.slice(0, shown).map((row) => {
          const minutes = Math.max(
            0,
            Math.round(
              (Date.parse(row.endedAt ?? row.endsAt) -
                Date.parse(row.startedAt)) /
                60_000,
            ),
          );
          return (
            <li key={row.id}>
              <Link
                to="/$"
                params={{ _splat: familyHref(family, `sessions/${row.id}`) }}
                className={styles.sessionLink}
                data-past-session={row.id}
              >
                <span className={styles.sessionWhen}>
                  {when(row.startedAt)}
                </span>
                <span className={styles.sessionFacts}>
                  {minutes < 1 ? "under a minute" : `${minutes} min`}
                  {row.totals && (
                    <>
                      {" · "}
                      {row.totals.problems}{" "}
                      {row.totals.problems === 1 ? "problem" : "problems"}
                      {" · "}
                      {percentText(row.totals.correct, row.totals.problems)}
                    </>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more && (
        <Button
          variant="quiet"
          className={styles.older}
          onClick={() => setShown(shown + STEP)}
        >
          Older sessions
        </Button>
      )}
    </section>
  );
}

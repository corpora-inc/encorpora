import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { strandNames } from "../../BirthYearPrompt";
import { FrontierMap, gradeName } from "../../Home";
import { buttonClass } from "../../ui/Button";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import {
  catalogOptions,
  progressOptions,
  trialSessionOptions,
  type TrialSession,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { FreeMeter } from "./FreeMeter";
import { isEnded, TrialEnded, TrialFailure, TrialSkeleton } from "./TrialFrame";
import styles from "./Trial.module.css";

/** `/try/map`: the estimated level in every area after placement, the free
 * meter, and the next step that will succeed. */
export function TrialMap() {
  const session = useQuery(trialSessionOptions);
  if (session.error)
    return (
      <TrialFailure error={session.error} retry={() => session.refetch()} />
    );
  if (session.isPending) return <TrialSkeleton wide />;
  if (!session.data) return <Navigate to="/try" replace />;
  return <MapView session={session.data} />;
}

function MapView({ session }: { session: TrialSession }) {
  const progress = useQuery(progressOptions(session));
  const catalog = useQuery(catalogOptions);
  useEffect(() => {
    trackSessionStart();
    track("map_view");
  }, []);
  if (isEnded(progress.error)) return <TrialEnded />;
  if (progress.error && !progress.data)
    return (
      <TrialFailure error={progress.error} retry={() => progress.refetch()} />
    );
  if (catalog.error)
    return (
      <TrialFailure error={catalog.error} retry={() => catalog.refetch()} />
    );
  if (!progress.data || !catalog.data) return <TrialSkeleton wide />;
  const p = progress.data;
  // Before placement finishes there is no map yet: keep placing.
  if (p.phase === "placement" && p.totals.answered === 0)
    return <Navigate to="/try/practice" replace />;
  const frontier = p.frontier.current;
  const strands = Object.keys(strandNames).filter((strand) =>
    catalog.data.skills.some(
      (skill) =>
        skill.strand === strand &&
        catalog.data.templates.some((t) => t.skillId === skill.id),
    ),
  );
  const left = p.remaining;
  return (
    <PageFrame>
      <section className={`${frameCard} ${styles.panel}`}>
        <p className={styles.eyebrow}>
          {p.phase === "placement" ? "Placement in progress" : "Free practice"}
        </p>
        <h1 className={styles.title}>
          Estimated level: {gradeName(frontier.overall.level)}
        </h1>
        <p className={styles.lede}>
          {p.phase === "placement"
            ? `${p.placement - p.totals.answered} placement problems to go. The map sharpens with each answer.`
            : left > 0
              ? `Placement is done. The next ${left} free problems practice right at this level, with a lesson and a hint on every problem.`
              : `All ${p.free} free problems are used. Choose a plan to keep going from here.`}
        </p>
        <div className={styles.meterRow}>
          <FreeMeter answered={p.totals.answered} free={p.free} />
        </div>
        <FrontierMap name="the learner" frontier={frontier} strands={strands} />
        <div className={styles.actions}>
          {left > 0 ? (
            <>
              <Link to="/try/practice" className={buttonClass("primary")}>
                {p.phase === "placement"
                  ? "Continue placement"
                  : "Keep practicing"}
              </Link>
              <Link
                to="/try/plans"
                search={{ reason: "choice" }}
                className={buttonClass("secondary")}
              >
                See plans
              </Link>
            </>
          ) : (
            <Link
              to="/try/plans"
              search={{ reason: "limit" }}
              className={buttonClass("primary")}
            >
              See plans
            </Link>
          )}
        </div>
      </section>
    </PageFrame>
  );
}

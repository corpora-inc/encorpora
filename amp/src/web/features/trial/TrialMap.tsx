import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "../curriculum/CurriculumDetails";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { strandNames } from "../../BirthYearPrompt";
import { FrontierMap, gradeName } from "../../Home";
import { LevelReadout } from "../../ui/LevelReadout";
import { buttonClass } from "../../ui/Button";
import {
  catalogOptions,
  progressOptions,
  trialSessionOptions,
  type TrialSession,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { FreeMeter } from "./FreeMeter";
import { TrialWorkbooks } from "./TrialWorkbooks";
import { TrialInvitation, useTrialBuyOffered } from "./TrialBuy";
import { nativeRuntime } from "../../native-runtime";
import { trialEvidenceOptions } from "../pathways/queries";
import { ShareAssessment } from "./ShareAssessment";
import { isEnded, TrialEnded, TrialFailure, TrialSkeleton } from "./TrialFrame";
import styles from "./Trial.module.css";

/** `/try/map`: the estimated level in every area after placement, the free
 * meter, and the next step that will succeed. */
export function TrialMap() {
  const session = useQuery(trialSessionOptions);
  if (session.error)
    return (
      <TrialFailure
        framed
        error={session.error}
        retry={() => session.refetch()}
      />
    );
  if (session.isPending) return <TrialSkeleton wide framed />;
  if (!session.data) return <Navigate to="/try" replace />;
  return <MapView session={session.data} />;
}

function MapView({ session }: { session: TrialSession }) {
  const { shown } = useCurriculumDetails();
  const progress = useQuery(progressOptions(session));
  const catalog = useQuery(catalogOptions);
  const evidence = useQuery(trialEvidenceOptions(session));
  const offered = useTrialBuyOffered();
  const shareMap = useMemo(
    () =>
      catalog.data && evidence.data
        ? {
            skills: catalog.data.skills.map((s) => ({
              ...s,
              title: s.title ?? s.id,
              description: s.description ?? "",
              prerequisites: s.prerequisites ?? [],
            })),
            evidence: evidence.data.skills,
          }
        : undefined,
    [catalog.data, evidence.data],
  );
  useEffect(() => {
    trackSessionStart();
    track("map_view");
  }, []);
  if (isEnded(progress.error)) return <TrialEnded />;
  if (progress.error && !progress.data)
    return (
      <TrialFailure
        framed
        error={progress.error}
        retry={() => progress.refetch()}
      />
    );
  if (catalog.error)
    return (
      <TrialFailure
        framed
        error={catalog.error}
        retry={() => catalog.refetch()}
      />
    );
  if (!progress.data || !catalog.data) return <TrialSkeleton wide framed />;
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
  const invited = offered && !nativeRuntime && p.phase !== "placement";
  // The Overview of the free assessment, under the app frame's bar (the
  // logo and the Progress tabs): one column, no card.
  return (
    <main className={styles.mapPage}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>
          {p.phase === "placement" ? "Placement in progress" : "Free practice"}
        </p>
        <h1 className={styles.title}>
          {shown ? "Your estimated level" : "Your progress"}
        </h1>
        <CurriculumDetailsControl />
        <LevelReadout estimate={frontier.overall} />
        <p className={styles.lede}>
          {p.phase === "placement"
            ? `${p.placement - p.totals.answered} placement problems to go. The map sharpens with each answer.`
            : left > 0
              ? `Keep exploring your pathways with ${left} free problems, hints, and lessons.`
              : `All ${p.free} free problems are used. Choose a plan to keep going from here.`}
        </p>
        <div className={styles.meterRow}>
          <FreeMeter answered={p.totals.answered} free={p.free} />
        </div>
        <div className={styles.actions}>
          {left > 0 ? (
            <>
              <Link to="/try/practice" className={buttonClass("primary")}>
                {p.phase === "placement"
                  ? "Continue placement"
                  : "Keep practicing"}
              </Link>
              {/* The invitation below sells the year; one Buy is enough. */}
              {!invited && (
                <Link
                  to="/try/plans"
                  search={{ reason: "choice" }}
                  className={buttonClass("secondary")}
                >
                  See plans
                </Link>
              )}
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
        {/* The next step sits above the fold; the free workbooks and the map
            follow it. */}
        {/* After placement: the invitation to buy, with the free workbooks. */}
        {!nativeRuntime &&
          (p.phase !== "placement" ? (
            <TrialInvitation at="map" occasion={session.learnerId}>
              {p.workbooks && (
                <TrialWorkbooks session={session} status={p.workbooks} />
              )}
            </TrialInvitation>
          ) : (
            p.workbooks && (
              <TrialWorkbooks session={session} status={p.workbooks} />
            )
          ))}
        <FrontierMap
          name="the learner"
          birthYear={session.birthYear}
          frontier={frontier}
          strands={strands}
        />
        <Link
          to="/pathways"
          search={{ context: "trial" }}
          className={buttonClass("quiet")}
        >
          See your illuminated pathways →
        </Link>
        {p.phase !== "placement" && (
          <ShareAssessment
            level={gradeName(frontier.overall.level)}
            map={shareMap}
          />
        )}
      </section>
    </main>
  );
}

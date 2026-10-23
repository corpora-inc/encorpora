import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { catalogOptions, trialSessionOptions } from "../trial/api";
import { trialEvidenceOptions } from "./queries";
import {
  crystal,
  layout,
  neighborhood,
  neighborhoods,
  type Evidence,
  type MapSkill,
} from "./model";
import styles from "./TrialPathwaysOffer.module.css";
import { storedTrial } from "../../lib/pending-trial";

const empty: Evidence[] = [];
/** A read-only view of the saved device trial. Account learner selection never enters it. */
export function TrialPathwaysOffer({
  hideWithoutTrial = false,
}: {
  hideWithoutTrial?: boolean;
}) {
  const [show] = useState(() => !hideWithoutTrial || !!storedTrial());
  const session = useQuery(trialSessionOptions);
  const catalog = useQuery({ ...catalogOptions, enabled: show });
  const evidence = useQuery({
    ...trialEvidenceOptions(session.data ?? { learnerId: "", token: "" }),
    enabled: !!session.data,
  });
  const skills = useMemo<MapSkill[]>(
    () =>
      (catalog.data?.skills ?? []).map((s) => ({
        ...s,
        title: s.title ?? s.id,
        description: s.description ?? "",
        prerequisites: s.prerequisites ?? [],
      })),
    [catalog.data],
  );
  const records = session.data ? (evidence.data?.skills ?? empty) : empty;
  const known = new Set(skills.map((s) => s.id));
  const lit = records.filter(
    (e) => known.has(e.skillId) && e.independentCorrect > 0,
  ).length;
  const failed =
    session.isError || catalog.isError || (!!session.data && evidence.isError);
  const loading =
    session.isPending ||
    catalog.isPending ||
    (!!session.data && evidence.isPending);
  if (!show) return null;
  return (
    <section className={styles.offer} aria-label="Your saved pathways">
      <div className={styles.visual}>
        {skills.length > 0 && <MapPicture skills={skills} evidence={records} />}
        <div className={styles.caption}>
          <span className={styles.kicker}>Your pathways</span>
          <strong>
            {loading
              ? "Loading your map…"
              : failed
                ? "Your map is unavailable"
                : lit
                  ? `${lit} ${lit === 1 ? "skill" : "skills"} illuminated`
                  : "Room to explore"}
          </strong>
          <span>
            {failed
              ? "You can choose a plan while it reloads."
              : lit
                ? "Built from independent correct answers."
                : "Practice lights up the skills you use."}
          </span>
        </div>
      </div>
      <div className={styles.footer}>
        <p>
          {session.data
            ? "Your free practice carries into your family account. Keep building from here."
            : "Explore connected ideas, one problem at a time."}
        </p>
        {failed ? (
          <button
            type="button"
            onClick={() => {
              void session.refetch();
              void catalog.refetch();
              if (session.data) void evidence.refetch();
            }}
          >
            Reload map
          </button>
        ) : (
          <Link to="/pathways" search={{ context: "trial" }}>
            Explore full map →
          </Link>
        )}
      </div>
    </section>
  );
}

function MapPicture({
  skills,
  evidence,
}: {
  skills: MapSkill[];
  evidence: Evidence[];
}) {
  const points = useMemo(() => layout(skills), [skills]);
  const byId = new Map(points.map((p) => [p.skill.id, p]));
  const stats = new Map(evidence.map((e) => [e.skillId, e]));
  const at = (position: number[]) => [
    250 + position[0]! * 1.75,
    137 - position[1]! * 1.75,
  ];
  const projected = points.map((p) => at(p.position));
  const minX = Math.min(...projected.map((p) => p[0]!)) - 12;
  const minY = Math.min(...projected.map((p) => p[1]!)) - 12;
  const spanX = Math.max(...projected.map((p) => p[0]!)) - minX + 12;
  const spanY = Math.max(...projected.map((p) => p[1]!)) - minY + 12;
  return (
    <svg
      className={styles.map}
      viewBox={`${minX} ${minY} ${spanX} ${spanY}`}
      aria-hidden="true"
      focusable="false"
    >
      {points.flatMap((p) =>
        p.skill.prerequisites.flatMap((id) => {
          const prior = byId.get(id);
          if (!prior) return [];
          const [x1, y1] = at(prior.position),
            [x2, y2] = at(p.position);
          const lit =
            !!stats.get(id)?.independentCorrect &&
            !!stats.get(p.skill.id)?.independentCorrect;
          return (
            <path
              key={`${id}:${p.skill.id}`}
              d={`M${x1},${y1} Q${(x1! + x2!) / 2 + 8},${(y1! + y2!) / 2 - 8} ${x2},${y2}`}
              fill="none"
              stroke={
                lit
                  ? `var(${neighborhoods[neighborhood(p.skill)]!.color})`
                  : "var(--atlas-border)"
              }
              opacity={lit ? 0.75 : 0.45}
              strokeWidth={lit ? 1 : 0.6}
            />
          );
        }),
      )}
      {points.map((p) => {
        const [x, y] = at(p.position),
          earned = crystal(stats.get(p.skill.id));
        const tint = `var(${neighborhoods[neighborhood(p.skill)]!.color})`;
        const radius = earned.stage ? 2 + earned.stage + earned.score / 5 : 1.2;
        return (
          <g
            key={p.skill.id}
            transform={`translate(${x} ${y})`}
            data-illuminated={earned.stage > 0}
          >
            {earned.stage > 0 && (
              <circle r={radius * 3} fill={tint} opacity=".1" />
            )}
            {earned.stage > 0 ? (
              <path
                d={`M0,${-radius} L${radius},0 0,${radius} ${-radius},0 Z`}
                fill={tint}
                stroke="var(--atlas-on-surface)"
                strokeWidth=".35"
              />
            ) : (
              <circle r={radius} fill="var(--atlas-muted)" opacity=".55" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

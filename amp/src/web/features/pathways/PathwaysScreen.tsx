import { useMemo, type ReactNode } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { request } from "../../lib/api";
import { useLearnerStore } from "../../learner-store";
import type { AuthSession } from "../../auth";
import { FrontierMap, gradeName } from "../../Home";
import { strandNames } from "../../BirthYearPrompt";
import { Graph } from "./Graph";
import {
  bandLabel,
  bands,
  catalogSchema,
  crystal,
  progressSchema,
  frontierSchema,
  frontierRange,
  type Frontier,
  type Evidence,
  type MapSkill,
} from "./model";
import "./pathways.css";
const emptyEvidence: Evidence[] = [];
export function PathwaysScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  return session ? (
    <LearnerMap key={session.accountId} session={session} />
  ) : (
    <MapView
      evidence={emptyEvidence}
      start="/try"
      notice="Explore the curriculum. Sign in to see a learner’s earned skills."
    />
  );
}
function LearnerMap({ session }: { session: AuthSession }) {
  const me = useQuery(meOptions(session));
  const { learnerId, select } = useLearnerStore();
  const learners = me.data?.signedIn ? me.data.learners : [];
  const learner = learners.find((l) => l.id === learnerId);
  const progress = useQuery({
    queryKey: ["account", session.accountId, "pathways", learner?.id],
    enabled: !!learner,
    queryFn: ({ signal }) =>
      request(`/learners/${learner!.id}/progress`, progressSchema, {
        token: session.token,
        signal,
      }),
  });
  const frontier = useQuery({
    queryKey: ["account", session.accountId, "pathways-frontier", learner?.id],
    enabled: !!learner,
    queryFn: ({ signal }) =>
      request(`/learners/${learner!.id}/frontier`, frontierSchema, {
        token: session.token,
        signal,
      }),
  });
  const canPractice =
    !!learner &&
    !!(
      me.data?.signedIn &&
      ["active", "development"].includes(me.data.family.consent.status) &&
      me.data.family.learners.find((l) => l.id === learner.id)?.canPractice
    );
  const notice = me.isPending
    ? "Loading learners…"
    : me.isError
      ? "Learners could not be loaded. Retry to view progress."
      : !learner
        ? "Choose a learner to see earned skills."
        : progress.isPending
          ? "Loading earned skills…"
          : progress.isError
            ? "Progress could not be loaded. The map shows the curriculum without earned skills."
            : `${learner.name} · Crystals grow with independent successes. Bright crystals show strong recorded practice.`;
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start={canPractice ? "/practice" : "/start"}
      canPractice={canPractice}
      notice={notice}
      frontier={frontier.data}
      learnerName={learner?.name}
      controls={
        <>
          <label>
            Learner{" "}
            <select
              value={learner?.id ?? ""}
              onChange={(e) => select(e.target.value || null)}
            >
              <option value="">Choose learner</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {frontier.isError && (
            <p role="status">
              The frontier estimate could not be loaded. Retry to refresh it.
            </p>
          )}
          {(me.isError || progress.isError || frontier.isError) && (
            <button
              onClick={() =>
                void (me.isError
                  ? me.refetch()
                  : Promise.all([progress.refetch(), frontier.refetch()]))
              }
            >
              Retry
            </button>
          )}
        </>
      }
    />
  );
}
export function MapView({
  evidence,
  start,
  notice,
  canPractice = false,
  controls,
  frontier,
  learnerName,
}: {
  evidence: Evidence[];
  start: "/try" | "/practice" | "/start";
  notice: string;
  canPractice?: boolean;
  controls?: ReactNode;
  frontier?: Frontier;
  learnerName?: string;
}) {
  const catalog = useQuery({
    queryKey: ["pathways-catalog"],
    queryFn: ({ signal }) => request("/catalog", catalogSchema, { signal }),
    staleTime: 300000,
  });
  const search = useSearch({ strict: false });
  const selectedId = typeof search.skill === "string" ? search.skill : "";
  const navigate = useNavigate();
  const query = typeof search.topic === "string" ? search.topic : "";
  const band =
    typeof search.filter === "string" && bands.includes(search.filter)
      ? search.filter
      : "";
  const updateFilters = (update: { topic?: string; filter?: string }) =>
    void navigate({
      to: "/pathways",
      search: {
        skill: selectedId || undefined,
        topic: query || undefined,
        filter: band || undefined,
        ...update,
      },
      replace: true,
    });
  const skills = catalog.data?.skills;
  const selected = skills?.find((s) => s.id === selectedId);
  const stats = useMemo(
    () => new Map(evidence.map((s) => [s.skillId, s])),
    [evidence],
  );
  const earned = evidence.filter((s) => s.independentCorrect > 0).length;
  const select = (id: string) =>
    void navigate({
      to: "/pathways",
      search: {
        skill: id,
        topic: query || undefined,
        filter: band || undefined,
      },
    });
  const filtered =
    skills?.filter(
      (s) =>
        (!band || s.gradeBand === band) &&
        `${s.title} ${s.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  const range = frontier ? frontierRange(frontier, selected?.strand) : null;
  const selectedEvidence = selected ? stats.get(selected.id) : undefined;
  const relations = (ids: string[]) =>
    ids
      .map((id) => skills?.find((s) => s.id === id))
      .filter((s): s is MapSkill => !!s);
  const links = (items: MapSkill[]) =>
    items.length ? (
      <ul>
        {items.map((s) => (
          <li key={s.id}>
            <button onClick={() => select(s.id)}>
              {s.title} <small>{bandLabel(s.gradeBand)}</small>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p>None listed.</p>
    );
  return (
    <main className="pathways">
      <header className="pathways-header">
        <div>
          <Link to="/">Adaptive Math Pathways</Link>
          <h1>Your pathways</h1>
        </div>
        <Link
          className="pathways-go"
          to="/$"
          params={{ _splat: start.slice(1) }}
        >
          Start learning →
        </Link>
      </header>
      <div className="pathways-status">
        <p role="status">{notice}</p>
        {controls}
      </div>
      <p className="pathways-summary">
        {earned} skills with independent successes · {skills?.length ?? "…"}{" "}
        mapped skills from kindergarten through precalculus
      </p>
      {catalog.isError ? (
        <div role="alert">
          The skill map could not be loaded.{" "}
          <button onClick={() => void catalog.refetch()}>Retry map</button>
        </div>
      ) : !skills ? (
        <p role="status">Loading the curriculum…</p>
      ) : (
        <>
          <Graph
            skills={skills}
            evidence={evidence}
            selected={selectedId}
            onSelect={select}
            range={range}
          />
          {range && (
            <p className="pathways-range">
              {selected
                ? `${strandNames[selected.strand] ?? selected.strand} frontier`
                : "Overall frontier"}
              : {gradeName(range.lo)} to {gradeName(range.hi)} · estimated 90%
              range. The shaded band shows this range on the map.
            </p>
          )}
          {frontier && learnerName && (
            <details className="pathways-estimates">
              <summary>Frontier estimates by area</summary>
              <FrontierMap
                name={learnerName}
                frontier={frontier}
                strands={Object.keys(frontier.strands)}
              />
            </details>
          )}
          <div className="pathways-panels">
            <section className="pathways-browser" aria-label="Find a skill">
              <div className="pathways-filters">
                <label>
                  Find a skill
                  <input
                    type="search"
                    value={query}
                    onChange={(e) =>
                      updateFilters({ topic: e.target.value || undefined })
                    }
                    placeholder="Fractions, equations, angles…"
                  />
                </label>
                <label>
                  Grade or course
                  <select
                    value={band}
                    onChange={(e) =>
                      updateFilters({ filter: e.target.value || undefined })
                    }
                  >
                    <option value="">All grades and courses</option>
                    {bands.map((b) => (
                      <option key={b} value={b}>
                        {bandLabel(b)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p>{filtered.length} skills</p>
              <ul className="pathways-skill-list">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      aria-pressed={selectedId === s.id}
                      onClick={() => select(s.id)}
                    >
                      <span
                        className={`pathways-gem stage-${crystal(stats.get(s.id)).stage}`}
                        aria-hidden="true"
                      >
                        ◆
                      </span>
                      <span>
                        {s.title}
                        <small>
                          {bandLabel(s.gradeBand)} ·{" "}
                          {stats.get(s.id)?.independentCorrect ?? 0} independent
                          successes
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!filtered.length && (
                <p>No matching skills. Try another search or grade.</p>
              )}
            </section>
            <section
              className="pathways-detail"
              aria-label="Selected skill"
              aria-live="polite"
            >
              {selected ? (
                <>
                  <p>
                    {bandLabel(selected.gradeBand)} ·{" "}
                    {selected.strand.replaceAll("-", " ")}
                  </p>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                  <p>
                    {selectedEvidence?.independentCorrect ?? 0} independent
                    successes · {selectedEvidence?.attempts ?? 0} attempts
                  </p>
                  <p>
                    {selectedEvidence?.status === "review-ready"
                      ? "Strong recorded practice"
                      : selectedEvidence?.attempts
                        ? "Building strength"
                        : "Not practiced yet"}
                  </p>
                  {catalog.data!.templates.some(
                    (t) => t.skillId === selected.id,
                  ) ? (
                    canPractice ? (
                      <Link
                        className="pathways-go"
                        to="/$"
                        params={{ _splat: "practice" }}
                        search={{ skill: selected.id }}
                      >
                        Try a problem
                      </Link>
                    ) : (
                      <p>
                        <Link to="/$" params={{ _splat: start.slice(1) }}>
                          Start learning
                        </Link>{" "}
                        to practice with a learner.
                      </p>
                    )
                  ) : (
                    <p>Practice for this skill is being developed.</p>
                  )}
                  <h3>Builds on</h3>
                  {links(relations(selected.prerequisites))}
                  <h3>Leads to</h3>
                  {links(
                    skills.filter((s) => s.prerequisites.includes(selected.id)),
                  )}
                </>
              ) : (
                <>
                  <h2>Explore a pathway</h2>
                  <p>
                    Select a crystal or find a skill. See what it builds on and
                    what comes next.
                  </p>
                </>
              )}
            </section>
          </div>
          <footer className="pathways-note">
            Earned crystal growth stays with you when a skill needs review.
            Grade and course labels describe individual skills; they are not a
            certification of a whole grade. The map includes skills whose
            practice is being developed.
          </footer>
        </>
      )}
    </main>
  );
}

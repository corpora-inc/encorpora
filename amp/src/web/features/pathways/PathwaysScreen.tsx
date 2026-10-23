import {
  useMemo,
  useRef,
  useEffect,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
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
  neighborhoods,
  neighborhood,
  previewEvidence,
  progressSchema,
  frontierSchema,
  frontierRange,
  type Frontier,
  type Evidence,
  type MapSkill,
} from "./model";
import {
  trialSessionOptions,
  type TrialSession,
  progressOptions as trialProgressOptions,
} from "../trial/api";
import { Dialog } from "../../ui/Dialog";
const SkillLesson = lazy(() => import("./SkillLesson"));
import "./pathways.css";
const emptyEvidence: Evidence[] = [];
export function PathwaysScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const search = useSearch({ strict: false });
  return session && search.context !== "trial" ? (
    <LearnerMap key={session.accountId} session={session} />
  ) : (
    <GuestMap />
  );
}
function GuestMap() {
  const trial = useQuery(trialSessionOptions);
  return trial.data ? (
    <TrialAtlas key={trial.data.learnerId} session={trial.data} />
  ) : (
    <MapView
      evidence={emptyEvidence}
      start="/try"
      notice={
        trial.isError
          ? "Your assessment could not be loaded. Retry to see your progress."
          : trial.isPending
            ? "Loading your assessment…"
            : "Explore the curriculum. Start learning to illuminate your skills."
      }
      noticeImportant={trial.isError}
      controls={
        trial.isError ? (
          <button onClick={() => void trial.refetch()}>Retry</button>
        ) : undefined
      }
    />
  );
}
function TrialAtlas({ session }: { session: TrialSession }) {
  const progress = useQuery({
    queryKey: ["trial", session.learnerId, "atlas"],
    queryFn: ({ signal }) =>
      request(`/learners/${session.learnerId}/progress`, progressSchema, {
        trial: session.token,
        signal,
      }),
  });
  const trial = useQuery(trialProgressOptions(session));
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start="/try/practice"
      canPractice={!!trial.data?.remaining}
      trialMode
      noticeImportant={progress.isError}
      frontier={trial.data?.frontier.current}
      notice={
        progress.isError
          ? "Progress could not be loaded. Retry to see your illumination."
          : progress.isPending
            ? "Loading earned skills…"
            : "Your free assessment and practice are lighting up this map."
      }
      controls={
        progress.isError ? (
          <button onClick={() => void progress.refetch()}>Retry</button>
        ) : (
          <Link to="/try/map">Assessment summary →</Link>
        )
      }
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
      key={learner?.id ?? "none"}
      canPractice={canPractice}
      notice={notice}
      noticeImportant={!learner || me.isError || progress.isError}
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
            <p role="status" data-priority="true">
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
  trialMode = false,
  noticeImportant = false,
}: {
  evidence: Evidence[];
  start: "/try" | "/practice" | "/start" | "/try/practice";
  notice: string;
  canPractice?: boolean;
  controls?: ReactNode;
  frontier?: Frontier;
  learnerName?: string;
  trialMode?: boolean;
  noticeImportant?: boolean;
}) {
  const catalog = useQuery({
    queryKey: ["pathways-catalog"],
    queryFn: ({ signal }) => request("/catalog", catalogSchema, { signal }),
    staleTime: 300000,
  });
  const search = useSearch({ strict: false });
  const selectedId = typeof search.skill === "string" ? search.skill : "";
  const query = typeof search.topic === "string" ? search.topic : "";
  const band =
    typeof search.filter === "string" && bands.includes(search.filter)
      ? search.filter
      : "";
  const navigate = useNavigate();
  const preview = search.preview === "illumination";
  const [browse, setBrowse] = useState(false);
  const [lesson, setLesson] = useState<string | null>(null);
  const lessonTrigger = useRef<HTMLElement | null>(null);
  const openLesson = (id: string, trigger: HTMLElement) => {
    lessonTrigger.current = trigger;
    setLesson(id);
  };
  const skills = catalog.data?.skills;
  const selected = skills?.find((s) => s.id === selectedId);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) detailHeading.current?.focus({ preventScroll: true });
  }, [selected]);
  const stats = useMemo(
    () => new Map(evidence.map((s) => [s.skillId, s])),
    [evidence],
  );
  const displayEvidence = useMemo(
    () => (preview && skills ? previewEvidence(skills) : evidence),
    [preview, skills, evidence],
  );
  const earned = evidence.filter((s) => s.independentCorrect > 0).length;
  const update = (
    values: {
      skill?: string;
      topic?: string;
      filter?: string;
      preview?: "illumination";
    },
    replace = false,
  ) =>
    void navigate({
      to: "/pathways",
      search: {
        skill: selectedId || undefined,
        topic: query || undefined,
        filter: band || undefined,
        context: trialMode ? "trial" : undefined,
        preview: preview ? "illumination" : undefined,
        ...values,
      },
      replace,
    });
  const setPreview = (value: boolean) =>
    update({ preview: value ? "illumination" : undefined }, true);
  const select = (id: string) => {
    setBrowse(false);
    update({ skill: id || undefined });
  };
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
  const families =
    catalog.data?.templates.filter((t) => t.skillId === selected?.id) ?? [];
  const links = (ids: string[]) =>
    ids.length ? (
      <ul>
        {ids.map((id) => {
          const s = skills?.find((s) => s.id === id);
          return s ? (
            <li key={id}>
              <button onClick={() => select(id)}>
                {s.title}
                <small>{bandLabel(s.gradeBand)}</small>
              </button>
            </li>
          ) : null;
        })}
      </ul>
    ) : (
      <p className="pathways-muted">None listed.</p>
    );
  return (
    <main
      className={`pathways ${selected ? "has-selection" : ""} ${browse ? "is-browsing" : ""}`}
    >
      <header className="pathways-header">
        <Link to="/" className="pathways-brand">
          <svg viewBox="0 0 44 28" aria-hidden="true">
            <path d="M1 14C5 0 9 0 13 14S21 28 25 14S33 0 37 14S41 28 43 14" />
          </svg>
          <span>
            Adaptive Math <strong>Pathways</strong>
          </span>
        </Link>
        <Link
          className="pathways-go"
          to="/$"
          params={{ _splat: start.slice(1) }}
        >
          Start learning →
        </Link>
      </header>
      <div className="pathways-heading">
        <div>
          <p className="pathways-eyebrow">THE CURRICULUM, CONNECTED</p>
          <h1>Your pathways</h1>
        </div>
        <p className="pathways-summary">
          {earned} skills with independent successes · {skills?.length ?? "…"}{" "}
          mapped skills from kindergarten through precalculus
        </p>
      </div>
      <div className="pathways-status">
        <p role="status" data-priority={noticeImportant}>
          {notice}
        </p>
        {controls}
      </div>
      <div className="pathways-toolbar">
        <label className="pathways-search">
          {" "}
          <span className="sr-only">Find a skill</span>
          <input
            type="search"
            aria-label="Find a skill"
            placeholder="Find a skill…"
            value={query}
            onFocus={() => setBrowse(true)}
            onChange={(e) => {
              setBrowse(true);
              update({ topic: e.target.value || undefined }, true);
            }}
          />
        </label>
        <button
          aria-label={browse ? "Close browser" : "Browse skills"}
          aria-expanded={browse}
          aria-controls="pathways-browser"
          onClick={() => setBrowse((v) => !v)}
        >
          <span className="toolbar-wide">
            {browse ? "Close browser" : "Browse skills"}
          </span>
          <span className="toolbar-narrow" aria-hidden="true">
            {browse ? "Close" : "Browse"}
          </span>
        </button>
        <button
          aria-label={preview ? "Show my progress" : "Preview illumination"}
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          <span className="toolbar-wide">
            {preview ? "Show my progress" : "Preview illumination"}
          </span>
          <span className="toolbar-narrow" aria-hidden="true">
            {preview ? "My map" : "Preview"}
          </span>
        </button>
      </div>
      {preview && (
        <p className="pathways-demo" role="status">
          ILLUMINATION PREVIEW · Sample progress, not your results.{" "}
        </p>
      )}
      {catalog.isError ? (
        <div role="alert">
          The skill map could not be loaded.{" "}
          <button onClick={() => void catalog.refetch()}>Retry map</button>
        </div>
      ) : !skills ? (
        <p role="status">Loading the curriculum…</p>
      ) : (
        <>
          <div className="pathways-workspace">
            <section
              id="pathways-browser"
              className="pathways-browser"
              aria-label="Find a skill"
              hidden={!browse}
            >
              <label>
                Grade or course
                <select
                  value={band}
                  onChange={(e) =>
                    update({ filter: e.target.value || undefined }, true)
                  }
                >
                  <option value="">All grades & courses</option>
                  {bands.map((b) => (
                    <option key={b} value={b}>
                      {bandLabel(b)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pathways-muted">
                {filtered.length} skills · select to explore
              </p>
              <ul className="pathways-skill-list">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      aria-pressed={selectedId === s.id}
                      onClick={() => select(s.id)}
                    >
                      <span
                        className={`pathways-gem stage-${crystal(stats.get(s.id)).stage}`}
                        style={{
                          color: `var(--atlas-area-${Math.max(0, neighborhood(s))})`,
                        }}
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
            <Graph
              skills={skills}
              evidence={displayEvidence}
              selected={selectedId}
              onSelect={select}
              range={preview ? null : range}
            />
            {selected && (
              <section
                className="pathways-detail"
                aria-label="Selected skill"
                aria-live="polite"
              >
                <div className="pathways-detail-top">
                  <span className="pathways-eyebrow">
                    {bandLabel(selected.gradeBand)}
                  </span>
                  <button aria-label="Close skill" onClick={() => select("")}>
                    ×
                  </button>
                </div>
                <h2 ref={detailHeading} tabIndex={-1}>
                  {selected.title}
                </h2>
                <p>{selected.description}</p>
                <div className="pathways-earned">
                  <strong>{selectedEvidence?.independentCorrect ?? 0}</strong>
                  <span>
                    independent successes
                    <small>
                      {selectedEvidence?.status === "review-ready"
                        ? "Strong recorded practice"
                        : selectedEvidence?.attempts
                          ? "Building strength"
                          : "Not practiced yet"}{" "}
                      · {selectedEvidence?.attempts ?? 0} attempts
                    </small>
                  </span>
                </div>
                {families.length ? (
                  <>
                    <div className="pathways-detail-actions">
                      {canPractice ? (
                        <Link
                          className="pathways-go"
                          to="/$"
                          params={{
                            _splat: trialMode ? "try/practice" : "practice",
                          }}
                          search={{ skill: selected.id }}
                        >
                          Try a problem
                        </Link>
                      ) : (
                        <Link
                          className="pathways-go"
                          to="/$"
                          params={{ _splat: start.slice(1) }}
                        >
                          Start learning
                        </Link>
                      )}
                      <button
                        onClick={(e) =>
                          openLesson(families[0]!.id, e.currentTarget)
                        }
                      >
                        View lesson
                      </button>
                    </div>
                    <details className="pathways-types">
                      <summary>
                        {families.length} problem{" "}
                        {families.length === 1 ? "type" : "types"}
                      </summary>
                      <ul>
                        {families.map((t) => (
                          <li key={t.id}>
                            <button
                              onClick={(e) => openLesson(t.id, e.currentTarget)}
                            >
                              {t.title ?? t.id.replaceAll("-", " ")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                ) : (
                  <p>Practice for this skill is being developed.</p>
                )}
                <h3>
                  <i className="pathways-dot prerequisites" />
                  Builds on
                </h3>
                {links(selected.prerequisites)}
                <h3>
                  <i className="pathways-dot dependents" />
                  Leads to
                </h3>
                {links(
                  skills
                    .filter((s) => s.prerequisites.includes(selected.id))
                    .map((s) => s.id),
                )}
                {range && (
                  <p className="pathways-range">
                    {strandNames[selected.strand] ?? selected.strand} frontier:{" "}
                    {gradeName(range.lo)} to {gradeName(range.hi)} · estimated
                    90% range.
                  </p>
                )}
              </section>
            )}
          </div>
          <footer className="pathways-footer">
            <div className="pathways-legend">
              {neighborhoods.map((n, i) => (
                <span key={n.title}>
                  <i
                    className="pathways-dot"
                    style={{ background: `var(--atlas-area-${i})` }}
                  />
                  {n.title}
                </span>
              ))}
            </div>
            <p>
              {selected
                ? "Cyan: prerequisites · Violet: skills this leads to"
                : "Each point is a skill. Each connection leads from a prerequisite to a skill that uses it."}
            </p>
            <details className="pathways-note">
              <summary>About illumination & coverage</summary>
              <p>
                Independent successes grow your crystals. Earned growth stays
                when a skill needs review. Brightness is recorded practice, not
                certification of a whole grade. Prerequisites do not earn credit
                automatically. The map includes skills whose practice is being
                developed.
              </p>
              {range && !selected && (
                <p>
                  Overall frontier: {gradeName(range.lo)} to{" "}
                  {gradeName(range.hi)} · estimated 90% range shown as a faint
                  band.
                </p>
              )}
              {frontier && learnerName && (
                <FrontierMap
                  name={learnerName}
                  frontier={frontier}
                  strands={Object.keys(frontier.strands)}
                />
              )}
            </details>
          </footer>
        </>
      )}
      <Dialog
        open={!!lesson}
        onOpenChange={(open) => {
          if (!open) setLesson(null);
        }}
        title="Explore a problem type"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (lessonTrigger.current?.isConnected) lessonTrigger.current.focus();
        }}
      >
        {canPractice && selected && lesson && (
          <Link
            className="pathways-lesson-practice"
            to="/$"
            params={{ _splat: trialMode ? "try/practice" : "practice" }}
            search={{ skill: selected.id, template: lesson }}
          >
            Try this problem type →
          </Link>
        )}
        <Suspense fallback={<p role="status">Loading lesson…</p>}>
          {lesson && <SkillLesson key={lesson} templateId={lesson} />}
        </Suspense>
      </Dialog>
    </main>
  );
}

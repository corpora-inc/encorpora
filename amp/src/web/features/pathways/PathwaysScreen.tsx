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
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
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
  relatedConnections,
  connectionLabel,
  neighborhood,
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
import { LessonBoundary } from "./LessonRecovery";
const SkillLesson = lazy(() => import("./SkillLesson"));
import { trialEvidenceOptions } from "./queries";
import { usePathwaysMetadata } from "./usePathwaysMetadata";
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
      actionLabel="Start free assessment"
      guestMode
      notice={
        trial.isError
          ? "Your assessment could not be loaded. Retry to see your progress."
          : trial.isPending
            ? "Loading your assessment…"
            : "Explore the curriculum. Start a free assessment to illuminate your skills."
      }
      noticeImportant={trial.isError || trial.isPending}
      controls={
        trial.isError ? (
          <button onClick={() => void trial.refetch()}>Retry</button>
        ) : undefined
      }
    />
  );
}
function TrialAtlas({ session }: { session: TrialSession }) {
  const progress = useQuery(trialEvidenceOptions(session));
  const trial = useQuery(trialProgressOptions(session));
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start={trial.data?.remaining === 0 ? "/try/plans" : "/try/practice"}
      actionLabel={
        trial.data?.remaining === 0 ? "See plans" : "Resume free assessment"
      }
      canPractice={!!trial.data?.remaining}
      trialMode
      noticeImportant={
        progress.isError ||
        progress.isPending ||
        trial.isError ||
        trial.data?.remaining === 0
      }
      frontier={trial.data?.frontier.current}
      notice={
        progress.isError
          ? "Progress could not be loaded. Retry to see your illumination."
          : trial.isError
            ? "Your assessment status could not be loaded. Retry to continue."
            : progress.isPending
              ? "Loading earned skills…"
              : trial.data?.remaining === 0
                ? "Your free practice lit up this map. Explore your skills and lessons, or choose a plan for more adaptive practice."
                : "Your free assessment and practice are lighting up this map."
      }
      controls={
        progress.isError || trial.isError ? (
          <button
            onClick={() =>
              void Promise.all([progress.refetch(), trial.refetch()])
            }
          >
            Retry
          </button>
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
  const savedTrial = useQuery({
    ...trialSessionOptions,
    enabled: !!me.data?.signedIn && learners.length === 0,
  });
  const learner = learners.find((l) => l.id === learnerId);
  const progress = useQuery({
    queryKey: ["account", session.accountId, "pathways", learner?.id],
    enabled: !!learner,
    refetchInterval: 30_000,
    queryFn: ({ signal }) =>
      request(`/learners/${learner!.id}/progress`, progressSchema, {
        token: session.token,
        signal,
      }),
  });
  const frontier = useQuery({
    queryKey: ["account", session.accountId, "pathways-frontier", learner?.id],
    enabled: !!learner,
    refetchInterval: 30_000,
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
      : savedTrial.isError && me.data?.signedIn && learners.length === 0
        ? "Your assessment could not be loaded. Retry to see your progress."
        : savedTrial.isPending && me.data?.signedIn && learners.length === 0
          ? "Loading your assessment…"
          : me.data?.signedIn && learners.length === 0
            ? "Add a learner to see earned skills."
            : !learner
              ? "Choose a learner to see earned skills."
              : progress.isPending
                ? "Loading earned skills…"
                : progress.isError
                  ? "Progress could not be loaded. The map shows the curriculum without earned skills."
                  : `${learner.name} · Crystals grow with independent successes. Bright crystals show strong recorded practice.`;
  if (me.data && !me.data.signedIn) return <GuestMap />;
  if (savedTrial.data && me.data?.signedIn && learners.length === 0)
    return <TrialAtlas session={savedTrial.data} />;
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start={canPractice ? "/practice" : "/start"}
      key={learner?.id ?? "none"}
      canPractice={canPractice}
      notice={notice}
      noticeImportant={
        !learner || me.isError || progress.isError || progress.isPending
      }
      frontier={frontier.data}
      learnerName={learner?.name}
      controls={
        <>
          {learners.length > 0 && (
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
          )}
          {me.data?.signedIn &&
            learners.length === 0 &&
            !me.isPending &&
            !me.isError &&
            !savedTrial.isError &&
            !savedTrial.isPending && <Link to="/start">Add a learner →</Link>}
          {frontier.isError && (
            <p role="status" data-priority="true">
              The frontier estimate could not be loaded. Retry to refresh it.
            </p>
          )}
          {(me.isError ||
            savedTrial.isError ||
            progress.isError ||
            frontier.isError) && (
            <button
              onClick={() =>
                void (me.isError
                  ? me.refetch()
                  : savedTrial.isError
                    ? savedTrial.refetch()
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
  guestMode = false,
  actionLabel = "Start learning",
  noticeImportant = false,
}: {
  evidence: Evidence[];
  start: "/try" | "/practice" | "/start" | "/try/practice" | "/try/plans";
  notice: string;
  canPractice?: boolean;
  controls?: ReactNode;
  frontier?: Frontier;
  learnerName?: string;
  trialMode?: boolean;
  guestMode?: boolean;
  actionLabel?: string;
  noticeImportant?: boolean;
}) {
  const catalog = useQuery({
    queryKey: ["pathways-catalog"],
    queryFn: ({ signal }) => request("/catalog", catalogSchema, { signal }),
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
  const search = useSearch({ strict: false });
  const params = useParams({ strict: false });
  const routeSkillId = typeof params.skillId === "string" ? params.skillId : "";
  const selectedId =
    routeSkillId || (typeof search.skill === "string" ? search.skill : "");
  const query = typeof search.topic === "string" ? search.topic : "";
  const assessmentContext = trialMode || search.context === "trial";
  const band =
    typeof search.filter === "string" && bands.includes(search.filter)
      ? search.filter
      : "";
  const navigate = useNavigate();
  const [browse, setBrowse] = useState(false);
  const [lesson, setLesson] = useState<string | null>(null);
  useEffect(() => setLesson(null), [selectedId]);
  const lessonTrigger = useRef<HTMLElement | null>(null);
  const openLesson = (id: string, trigger: HTMLElement) => {
    lessonTrigger.current = trigger;
    setLesson(id);
  };
  const skills = catalog.data?.skills;
  const selected = skills?.find((s) => s.id === selectedId);
  const unknownSkill = !!skills && !!selectedId && !selected;
  usePathwaysMetadata(
    selected,
    !!selectedId && (unknownSkill || catalog.isError),
  );
  const linkSearch = () => ({
    topic: query || undefined,
    filter: band || undefined,
    context: assessmentContext ? ("trial" as const) : undefined,
  });
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) detailHeading.current?.focus({ preventScroll: true });
  }, [selected]);
  const stats = useMemo(
    () => new Map(evidence.map((s) => [s.skillId, s])),
    [evidence],
  );
  const earned = evidence.filter((s) => s.independentCorrect > 0).length;
  const update = (
    values: {
      skill?: string;
      topic?: string;
      filter?: string;
    },
    replace = false,
  ) => {
    const skillId = values.skill === undefined ? selectedId : values.skill;
    const nextSearch = {
      topic: (values.topic === undefined ? query : values.topic) || undefined,
      filter: (values.filter === undefined ? band : values.filter) || undefined,
      context: assessmentContext ? ("trial" as const) : undefined,
    };
    if (skillId)
      void navigate({
        to: "/pathways/$skillId",
        params: { skillId },
        search: nextSearch,
        replace,
      });
    else void navigate({ to: "/pathways", search: nextSearch, replace });
  };
  const select = (id: string) => {
    setBrowse(false);
    update({ skill: id });
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
  const related = selected ? relatedConnections(skills ?? [], selected.id) : [];
  const links = (ids: string[]) =>
    ids.length ? (
      <ul>
        {ids.map((id) => {
          const s = skills?.find((s) => s.id === id);
          return s ? (
            <li key={id}>
              <Link
                to="/pathways/$skillId"
                params={{ skillId: id }}
                search={linkSearch()}
                onClick={() => setBrowse(false)}
              >
                {s.title}
                <small>{bandLabel(s.gradeBand)}</small>
              </Link>
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
          {actionLabel} →
        </Link>
      </header>
      <div className="pathways-heading">
        <div>
          <p className="pathways-eyebrow">THE CURRICULUM, CONNECTED</p>
          <h1>Your pathways</h1>
        </div>
        <p className="pathways-summary">
          {earned} skills illuminated · {skills?.length ?? "…"} mapped skills
          from kindergarten through precalculus
        </p>
      </div>
      {guestMode && (
        <div className="pathways-guest-intro">
          <p>
            No account needed
            {catalog.data?.trial?.free
              ? ` · ${catalog.data.trial.free} free problems`
              : ""}
          </p>
          <a
            href="https://www.facebook.com/reel/2346490016085488"
            target="_blank"
            rel="noopener noreferrer"
          >
            See the map light up ↗
          </a>
        </div>
      )}
      <div className="pathways-status">
        <p role="status" data-priority={noticeImportant}>
          {notice}
        </p>
        {controls}
      </div>
      {unknownSkill && (
        <p role="alert" className="pathways-unknown">
          This skill is not in the map. Browse the curriculum to find a skill.
        </p>
      )}
      <div
        className="pathways-toolbar"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            setBrowse(false);
          }
        }}
      >
        <label className="pathways-search">
          {" "}
          <span className="sr-only">Find a skill</span>
          <input
            type="search"
            aria-label="Find a skill"
            placeholder="Find a skill…"
            maxLength={100}
            value={query}
            onFocus={() => setBrowse(true)}
            onChange={(e) => {
              setBrowse(true);
              update({ topic: e.target.value }, true);
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
      </div>
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
                  onChange={(e) => update({ filter: e.target.value }, true)}
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
                    <Link
                      to="/pathways/$skillId"
                      params={{ skillId: s.id }}
                      search={linkSearch()}
                      aria-current={selectedId === s.id ? "page" : undefined}
                      onClick={() => setBrowse(false)}
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
                    </Link>
                  </li>
                ))}
              </ul>
              {!filtered.length && (
                <p>No matching skills. Try another search or grade.</p>
              )}
            </section>
            <Graph
              skills={skills}
              evidence={evidence}
              selected={selectedId}
              onSelect={select}
              range={range}
              rangeStrand={selected?.strand}
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
                  <strong>
                    {crystal(selectedEvidence).score.toFixed(1)}
                    <small>/ 10</small>
                  </strong>
                  <span>
                    Earned illumination
                    <small>
                      {selectedEvidence?.independentCorrect ?? 0} independent
                      successes ·{" "}
                      {selectedEvidence?.status === "review-ready"
                        ? "Strong recorded practice"
                        : selectedEvidence?.attempts
                          ? "Building strength"
                          : "Not practiced yet"}
                    </small>
                  </span>
                </div>
                <div
                  className="pathways-illumination-meter"
                  role="meter"
                  aria-label="Earned illumination"
                  aria-valuemin={0}
                  aria-valuemax={10}
                  aria-valuenow={crystal(selectedEvidence).score}
                >
                  <i
                    style={{
                      width: `${crystal(selectedEvidence).score * 10}%`,
                    }}
                  />
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
                          {actionLabel}
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
                <h3>
                  <i className="pathways-dot related" />
                  Related skills
                </h3>
                {related.length ? (
                  <ul className="pathways-connections">
                    {related.map(({ skill, connection }) => (
                      <li key={skill.id}>
                        <Link
                          to="/pathways/$skillId"
                          params={{ skillId: skill.id }}
                          search={linkSearch()}
                          onClick={() => setBrowse(false)}
                        >
                          {skill.title}
                          <small>
                            {bandLabel(skill.gradeBand)}
                            {connection
                              ? ` · ${connectionLabel(connection)}`
                              : " · Shared foundations"}
                          </small>
                        </Link>
                        {connection && <p>{connection.explanation}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pathways-muted">None listed.</p>
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
                ? "Cyan: prerequisites · Violet: next skills · Dotted: related skills"
                : "Each point is a skill. Each connection leads from a prerequisite to a skill that uses it."}
            </p>
            <details className="pathways-note">
              <summary>About illumination & coverage</summary>
              <p>
                Each independent correct answer adds 0.5 illumination, up to 10
                per skill. Earned growth stays when a skill needs review.
                Illumination records practice, not certification of a whole
                grade. Prerequisites do not earn credit automatically. The map
                includes skills whose practice is being developed.
              </p>
              {range && !selected && (
                <p>
                  Overall frontier: {gradeName(range.lo)} to{" "}
                  {gradeName(range.hi)} · estimated 90% range shown by faint
                  outlines.
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
        {lesson && (
          <LessonBoundary key={lesson} onBack={() => setLesson(null)}>
            <Suspense fallback={<p role="status">Loading lesson…</p>}>
              <SkillLesson templateId={lesson} onBack={() => setLesson(null)} />
            </Suspense>
          </LessonBoundary>
        )}
      </Dialog>
    </main>
  );
}

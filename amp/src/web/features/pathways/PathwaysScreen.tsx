import { ScreenTitle } from "../../ui/ScreenTitle";
import { FREE_ONLINE_PROBLEMS } from "../../../learning/free-allowance";
import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "../curriculum/CurriculumDetails";
import { NavigationDrawer } from "../navigation/NavigationDrawer";
import {
  useDeferredValue,
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
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { skillCatalogOptions } from "../../lib/learning-view";
import { request } from "../../lib/api";
import { useUrlSearchText } from "../../lib/url-search-text";
import { useLearnerStore } from "../../learner-store";
import type { AuthSession } from "../../auth";
import { gradeName } from "../../Home";
import { fitScale, LevelRows } from "../../ui/level-range";
import { useLessonSearch, type SearchResult } from "../../lib/lesson-search";
import { SearchResults, type SearchActions } from "../search/SearchResults";
import { useSearchCorpus } from "../search/search-corpus";
import { strandNames } from "../../BirthYearPrompt";
import { Graph } from "./Graph";
import { ConnectionList } from "./ConnectionList";
import { skillNeighbors, type Neighbor } from "./neighbors";
import {
  bandLabel,
  bands,
  skillLight,
  neighborhoods,
  neighborhood,
  progressSchema,
  frontierSchema,
  frontierRange,
  levelRegion,
  type Frontier,
  type Evidence,
  type MapSkill,
} from "./model";
import { Dialog } from "../../ui/Dialog";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import { LessonBoundary } from "./LessonRecovery";
const SkillLesson = lazy(() => import("./SkillLesson"));
import { usePathwaysMetadata } from "./usePathwaysMetadata";
import "./pathways.css";
import { Loading } from "../../ui/Loading";
import {
  adultLearner,
  practicingAsAdult,
  profileLearner,
} from "../../lib/adult-learner";
import { secondParentChild, secondParentChildren } from "../second-parent/api";
const emptyEvidence: Evidence[] = [];
const bandOptions: ListboxOption[] = [
  { value: "", label: "All grades & courses" },
  ...bands.map((b) => ({ value: b, label: bandLabel(b) })),
];
// Related words a learner may type for what the catalog calls something else.
const synonyms: Record<string, string[]> = {
  logic: ["reasoning", "proof", "argument", "justify"],
  shapes: ["geometry", "polygon"],
  times: ["multiplication", "multiply"],
  share: ["division", "divide"],
};
function matchesQuery(text: string, query: string) {
  const haystack = text.toLowerCase();
  const q = query.trim().toLowerCase();
  return (
    haystack.includes(q) ||
    (synonyms[q] ?? []).some((w) => haystack.includes(w))
  );
}

/** A lesson, problem type or film a search found, offered first in its
 * skill's panel. */
type SearchFound = {
  kind: "lesson" | "type" | "film" | "term";
  id: string;
  title: string;
  skill: string;
};

/** A problem type's id, as `?lesson=` carries it. */
const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,119}$/;

/** On a phone a long list of results can leave the page scrolled past the
 * map, under the bar. A chosen skill shows on the map, so bring the map's
 * top back into view (a cut under reduced motion). */
function showMap() {
  requestAnimationFrame(() => {
    const map = document.querySelector<HTMLElement>(".pathways-viewport");
    if (!map || !matchMedia("(max-width: 650px)").matches) return;
    const margin = parseFloat(getComputedStyle(map).scrollMarginTop) || 0;
    if (map.getBoundingClientRect().top >= margin) return;
    map.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  });
}

export function PathwaysScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  // This public resource outlives the keyed learner view. Keep its in-flight
  // read alive when the account resolves and that view changes learner.
  useQuery(skillCatalogOptions);
  return session ? (
    <LearnerMap key={session.accountId} session={session} />
  ) : (
    <GuestMap />
  );
}
/** Signed out: the whole curriculum, and the way in. */
function GuestMap() {
  return (
    <MapView
      evidence={emptyEvidence}
      start="/sign-up"
      actionLabel="Try it free"
      guestMode
      notice="Explore the curriculum. Practice lights up each skill you earn."
    />
  );
}

function LearnerMap({ session }: { session: AuthSession }) {
  const me = useQuery(meOptions(session));
  const { learnerId, select } = useLearnerStore();
  const account = me.data?.signedIn ? me.data : null;
  // The adult's own pathways, when their own learner is the one chosen: the
  // family's learners aren't theirs to switch to here.
  // An adult who practices only as themselves sees their own map, whatever
  // this device last chose.
  const solo =
    account && !account.learners.length && !secondParentChildren(account).length
      ? adultLearner(account)
      : null;
  const own = practicingAsAdult(account, learnerId)
    ? adultLearner(account)
    : (profileLearner(account, learnerId) ?? solo);
  useEffect(() => {
    if (solo && own === solo && learnerId !== solo.id) select(solo.id);
  }, [solo?.id, learnerId]);
  // A second parent's family's children follow the family's own: their
  // progress, read-only.
  const learners = own
    ? [own]
    : [...(account?.learners ?? []), ...secondParentChildren(account)];
  const viewOnly = !own && !!secondParentChild(account, learnerId);
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
      me.data.family.learners.find((l) => l.id === learner.id)?.canPractice
    );
  const notice = me.isPending ? (
    <Loading inline>Loading learners…</Loading>
  ) : me.isError ? (
    "Learners could not be loaded. Retry to view progress."
  ) : me.data?.signedIn && learners.length === 0 ? (
    "Add a learner to see earned skills."
  ) : !learner ? (
    "Choose a learner to see earned skills."
  ) : progress.isPending ? (
    <Loading inline>Loading earned skills…</Loading>
  ) : progress.isError ? (
    "Progress could not be loaded. The map shows the curriculum without earned skills."
  ) : (
    "Skills grow with independent successes. Brighter means stronger recorded practice."
  );
  if (me.data && !me.data.signedIn) return <GuestMap />;
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start={learner ? "/practice" : "/start"}
      readOnly={viewOnly}
      key={learner?.id ?? "none"}
      canPractice={canPractice}
      recordLoading={me.isPending || (!!learner && progress.isPending)}
      notice={notice}
      noticeImportant={
        !learner || me.isError || progress.isError || progress.isPending
      }
      frontier={frontier.data}
      frontierLoading={
        me.isPending ||
        (!!learner && (frontier.isPending || progress.isPending))
      }
      learnerName={learner?.name}
      birthYear={learner?.birthYear}
      controls={
        <>
          {/* The learner row holds its place while the family loads. */}
          {(me.isPending || (learners.length > 0 && !own)) && (
            <div
              className="pathways-learner"
              aria-hidden={me.isPending || undefined}
              style={me.isPending ? { visibility: "hidden" } : undefined}
            >
              <span aria-hidden="true">Learner</span>
              <ListboxDisclosure
                label="Learner"
                placeholder="Choose learner"
                align="end"
                options={learners.map((l) => ({ value: l.id, label: l.name }))}
                value={learner?.id ?? null}
                onChange={select}
              />
            </div>
          )}
          {me.data?.signedIn &&
            learners.length === 0 &&
            !me.isPending &&
            !me.isError && <Link to="/start">Add a learner →</Link>}
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
  frontierLoading = false,
  learnerName,
  birthYear,
  guestMode = false,
  actionLabel = "Start learning",
  noticeImportant = false,
  recordLoading = false,
  readOnly = false,
}: {
  evidence: Evidence[];
  start: "/sign-up" | "/practice" | "/start";
  notice: ReactNode;
  canPractice?: boolean;
  controls?: ReactNode;
  frontier?: Frontier;
  /** The learner's estimate or record is on its way: "My level" waits. */
  frontierLoading?: boolean;
  learnerName?: string;
  birthYear?: number | null;
  guestMode?: boolean;
  actionLabel?: string;
  noticeImportant?: boolean;
  /** The learner's record is still on its way: counts wait for it. */
  recordLoading?: boolean;
  /** A second parent's family's child: progress to read, no practice. */
  readOnly?: boolean;
}) {
  const catalog = useQuery({
    ...skillCatalogOptions,
    refetchInterval: 300_000,
  });
  const search = useSearch({ strict: false });
  const params = useParams({ strict: false });
  const routeSkillId = typeof params.skillId === "string" ? params.skillId : "";
  const selectedId =
    routeSkillId || (typeof search.skill === "string" ? search.skill : "");
  const urlQuery = typeof search.topic === "string" ? search.topic : "";
  // The field owns its text while typing; the URL follows after a pause.
  const field = useUrlSearchText(urlQuery, (topic) => update({ topic }, true));
  const query = useDeferredValue(field.text);
  const band =
    typeof search.filter === "string" && bands.includes(search.filter)
      ? search.filter
      : "";
  const navigate = useNavigate();
  const router = useRouter();
  const { shown } = useCurriculumDetails();
  // Arriving with a search (a link, or /lessons?q=) opens its results.
  // A shared search opens its results, unless the link names a skill: then
  // the skill is what it shows, its search kept in the field.
  const [browse, setBrowse] = useState(
    () => urlQuery.trim().length > 0 && !selectedId,
  );
  // A problem type's short lesson has its own address (`?lesson=`), so a
  // link, a refresh or Back opens it again. Opened here, closing goes back;
  // arrived at by a link, closing leaves the address without it.
  const lesson =
    typeof search.lesson === "string" && LESSON_ID.test(search.lesson)
      ? search.lesson
      : null;
  const lessonTrigger = useRef<HTMLElement | null>(null);
  const openedHere = useRef(false);
  // Closed any way (Back, a link), the next close starts afresh.
  useEffect(() => {
    if (!lesson) openedHere.current = false;
  }, [lesson]);
  const openLesson = (id: string, trigger: HTMLElement) => {
    lessonTrigger.current = trigger;
    openedHere.current = true;
    update({ lesson: id });
  };
  const closeLesson = () => {
    if (!lesson) return;
    if (openedHere.current) {
      openedHere.current = false;
      router.history.back();
    } else update({ lesson: null }, true);
  };
  // The one search (docs/design/ia.md): skills, lessons, films and math
  // words, grouped, once there is something typed.
  const searching = query.trim().length > 0;
  const docs = useSearchCorpus(searching);
  const found = useLessonSearch(docs, searching ? query.trim() : "", "");
  // On Pathways every result selects its skill in the map, as the list
  // without a search does (founder): the camera frames it, its panel opens,
  // the search closes with the query kept. A lesson, problem type or film is
  // then offered first in the panel, as found.
  const [picked, setPicked] = useState<SearchFound | null>(null);
  const searchActionsFor = (): SearchActions => {
    // An older server's result carries no skill: this page's own corpus
    // knows every document's.
    const skillOf = (result: SearchResult) =>
      result.skill || docs?.find((doc) => doc.id === result.id)?.skill || "";
    const href = (result: SearchResult) =>
      skillOf(result)
        ? `/pathways/${encodeURIComponent(skillOf(result))}${window.location.search}`
        : `/pathways${window.location.search}`;
    return {
      href,
      open: (result) => {
        const skill = skillOf(result);
        if (!skill) return;
        setPicked(
          result.kind === "skill"
            ? null
            : {
                kind: result.kind,
                id: result.target,
                title: result.title,
                skill,
              },
        );
        select(skill);
      },
    };
  };
  const skills = catalog.data?.skills;
  const selected = skills?.find((s) => s.id === selectedId);
  // What a search found, while its skill is the one selected.
  const fromSearch =
    picked && selected && picked.skill === selected.id ? picked : null;
  // The skill a short lesson practices: the selected one, or its own when
  // the lesson was opened by its address.
  const lessonSkill = lesson
    ? (selected?.id ??
      catalog.data?.templates.find((t) => t.id === lesson)?.skillId)
    : undefined;
  const unknownSkill = !!skills && !!selectedId && !selected;
  usePathwaysMetadata(
    selected,
    !!selectedId && (unknownSkill || catalog.isError),
  );
  const linkSearch = () => ({
    topic: field.text.trim() || undefined,
    filter: band || undefined,
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
  const countsReady = !!catalog.data && !recordLoading;
  const update = (
    values: {
      skill?: string;
      topic?: string;
      filter?: string;
      /** A short lesson to open; any other change closes it. */
      lesson?: string | null;
    },
    replace = false,
  ) => {
    const skillId = values.skill === undefined ? selectedId : values.skill;
    const nextSearch = {
      topic:
        (values.topic === undefined ? field.carry() : values.topic) ||
        undefined,
      filter: (values.filter === undefined ? band : values.filter) || undefined,
      lesson: values.lesson || undefined,
    };
    if (skillId)
      void navigate({
        to: "/pathways/$skillId",
        params: { skillId },
        search: nextSearch,
        replace,
        resetScroll: false,
      });
    else
      void navigate({
        to: "/pathways",
        search: nextSearch,
        replace,
        resetScroll: false,
      });
  };
  const select = (id: string) => {
    setBrowse(false);
    update({ skill: id });
    showMap();
  };
  const filtered =
    skills?.filter(
      (s) =>
        (!band || s.gradeBand === band) &&
        matchesQuery(`${s.title} ${s.description}`, query),
    ) ?? [];
  const range = frontier ? frontierRange(frontier, selected?.strand) : null;
  const level = useMemo(
    () =>
      skills && !frontierLoading
        ? levelRegion(skills, frontier, evidence)
        : null,
    [skills, frontier, evidence, frontierLoading],
  );
  const selectedEvidence = selected ? stats.get(selected.id) : undefined;
  const families =
    catalog.data?.templates.filter((t) => t.skillId === selected?.id) ?? [];
  const neighbors = useMemo(
    () => skillNeighbors(skills ?? [], selected?.id ?? "", { shared: true }),
    [skills, selected?.id],
  );
  const connectionList = (
    group: "builds-on" | "leads-to" | "related",
    items: Neighbor<MapSkill>[],
  ) => (
    <ConnectionList
      key={`${selected?.id}:${group}`}
      group={group}
      items={items}
      linkSearch={linkSearch()}
      onNavigate={() => setBrowse(false)}
    />
  );
  return (
    <main
      className={`pathways ${selected ? "has-selection" : ""} ${browse ? "is-browsing" : ""}`}
    >
      {/* Signed in, the app frame's bar holds the logo, the Progress tabs and
          the way to practice. A visitor gets the map's own header. */}
      {guestMode && (
        <header className="pathways-header">
          <NavigationDrawer />
          <Link to="/" className="pathways-brand">
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
      )}
      <div className="pathways-heading">
        <div>
          <ScreenTitle>Pathways</ScreenTitle>
        </div>
        {/* The counts paint once, when both the map and the learner's
            record are in: their line is held until then, never rewritten. */}
        <p
          className="pathways-summary"
          aria-busy={!countsReady}
          style={countsReady ? undefined : { visibility: "hidden" }}
        >
          {guestMode
            ? `${skills?.length ?? 335} skills, kindergarten through precalculus`
            : `${earned} of ${skills?.length ?? 335} skills earned · kindergarten through precalculus`}
        </p>
      </div>
      {guestMode && (
        <div className="pathways-guest-intro">
          <p>
            Free account · {FREE_ONLINE_PROBLEMS} free problems for each learner
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
        {/* Phones: the count shares the learner's row (the full sentence
            above stays for screen readers), so the map starts on the first
            screen. */}
        <p
          className="pathways-phone-summary"
          aria-hidden="true"
          style={countsReady ? undefined : { visibility: "hidden" }}
        >
          {guestMode
            ? `${skills?.length ?? 335} skills, kindergarten to precalculus`
            : `${earned} of ${skills?.length ?? 335} skills earned`}
        </p>
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
          if (
            event.key === "Escape" &&
            !event.nativeEvent.isComposing &&
            event.currentTarget.contains(event.target as Node)
          ) {
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
            aria-label="Search skills, lessons and math words"
            placeholder="Search skills, lessons, math words…"
            maxLength={100}
            value={field.text}
            onFocus={() => setBrowse(true)}
            onChange={(e) => {
              setBrowse(true);
              field.change(e.target.value);
            }}
            onBlur={field.flush}
            onKeyDown={(e) => {
              if (e.key === "Enter") field.flush();
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
        <Loading>Loading the curriculum…</Loading>
      ) : (
        <>
          <div className="pathways-workspace">
            <section
              id="pathways-browser"
              className="pathways-browser"
              aria-label="Find a skill"
              hidden={!browse}
            >
              <CurriculumDetailsControl />
              <div className="pathways-grade" hidden={!shown && !band}>
                {!shown && band && (
                  <small>
                    A curriculum filter is active. Choose All grades to clear
                    it.
                  </small>
                )}
                <span aria-hidden="true">Grade or course</span>
                <ListboxDisclosure
                  label="Grade or course"
                  options={bandOptions}
                  value={band}
                  onChange={(next) => update({ filter: next }, true)}
                />
              </div>
              {searching && (
                <div className="pathways-results">
                  <SearchResults
                    results={found.results}
                    pending={found.pending}
                    actions={searchActionsFor()}
                  />
                </div>
              )}
              <p className="pathways-muted" hidden={searching}>
                {filtered.length} skills · select to explore
              </p>
              <ul className="pathways-skill-list" hidden={searching}>
                {filtered.map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/pathways/$skillId"
                      params={{ skillId: s.id }}
                      search={linkSearch()}
                      aria-current={selectedId === s.id ? "page" : undefined}
                      onClick={() => {
                        setBrowse(false);
                        showMap();
                      }}
                    >
                      <span
                        className={`pathways-gem stage-${skillLight(stats.get(s.id)).stage}`}
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
                          {shown && <>{bandLabel(s.gradeBand)} · </>}
                          {stats.get(s.id)?.independentCorrect ?? 0} independent
                          successes
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {!searching && !filtered.length && (
                <p>No matching skills. Try another grade.</p>
              )}
            </section>
            <Graph
              skills={skills}
              evidence={evidence}
              selected={selectedId}
              onSelect={select}
              range={range}
              rangeStrand={selected?.strand}
              level={level}
              levelLoading={frontierLoading}
            />
            {selected && (
              <section
                className="pathways-detail"
                aria-label="Selected skill"
                aria-live="polite"
              >
                <div className="pathways-detail-top">
                  {shown && (
                    <span className="pathways-eyebrow">
                      Curriculum band: {bandLabel(selected.gradeBand)}
                    </span>
                  )}
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
                    {skillLight(selectedEvidence).score.toFixed(1)}
                    <small>/ 10</small>
                  </strong>
                  <span>
                    Skill progress
                    <small>
                      {selectedEvidence?.independentCorrect ?? 0} correct
                      without help ·{" "}
                      {selectedEvidence?.status === "review-ready"
                        ? "Strong"
                        : selectedEvidence?.attempts
                          ? "Building"
                          : "Not practiced yet"}
                    </small>
                  </span>
                </div>
                <div
                  className="pathways-illumination-meter"
                  role="meter"
                  aria-label="Skill progress"
                  aria-valuemin={0}
                  aria-valuemax={10}
                  aria-valuenow={skillLight(selectedEvidence).score}
                >
                  <i
                    style={{
                      width: `${skillLight(selectedEvidence).score * 10}%`,
                    }}
                  />
                </div>
                {fromSearch && fromSearch.kind !== "term" && (
                  <div className="pathways-found" data-found={fromSearch.kind}>
                    <span className="pathways-found-kind">
                      {fromSearch.kind === "lesson"
                        ? "Lesson"
                        : fromSearch.kind === "film"
                          ? "Lesson film"
                          : "Problem type"}
                    </span>
                    <strong>{fromSearch.title}</strong>
                    {fromSearch.kind === "type" ? (
                      <button
                        onClick={(e) =>
                          openLesson(fromSearch.id, e.currentTarget)
                        }
                      >
                        View lesson
                      </button>
                    ) : fromSearch.kind === "film" ? (
                      <Link
                        to="/lessons/$templateId/watch"
                        params={{ templateId: fromSearch.id }}
                        search={{
                          from:
                            window.location.pathname + window.location.search,
                        }}
                      >
                        Watch
                      </Link>
                    ) : (
                      <Link
                        to="/$"
                        params={{ _splat: `lessons/${fromSearch.id}` }}
                      >
                        Read the lesson
                      </Link>
                    )}
                  </div>
                )}
                {families.length ? (
                  <>
                    <div className="pathways-detail-actions">
                      {readOnly ? null : canPractice ? (
                        <Link
                          className="pathways-go"
                          to="/$"
                          params={{ _splat: "practice" }}
                          search={{
                            skill: selected.id,
                            // A problem type the search found: that one.
                            ...(fromSearch?.kind === "type" ||
                            fromSearch?.kind === "film"
                              ? { template: fromSearch.id }
                              : {}),
                          }}
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
                {connectionList("builds-on", neighbors.buildsOn)}
                <h3>
                  <i className="pathways-dot dependents" />
                  Leads to
                </h3>
                {connectionList("leads-to", neighbors.leadsTo)}
                <h3>
                  <i className="pathways-dot related" />
                  Related skills
                </h3>
                {connectionList("related", neighbors.related)}
                {range && (
                  <p className="pathways-range">
                    {shown ? (
                      <>
                        {strandNames[selected.strand] ?? selected.strand}{" "}
                        frontier: {gradeName(range.lo)} to {gradeName(range.hi)}{" "}
                        · estimated range.
                      </>
                    ) : (
                      "Faint outlines show the estimated range of skills to practice."
                    )}
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
              <summary>How skills grow</summary>
              <p>
                Each correct answer without help fills a skill’s bar by a
                twentieth. What is earned stays when a skill needs review. The
                bar records practice; it does not certify a whole grade, and a
                prerequisite fills only from its own answers.
              </p>
              {range && !selected && (
                <p>
                  {shown ? (
                    <>
                      Overall frontier: {gradeName(range.lo)} to{" "}
                      {gradeName(range.hi)} · estimated range shown by faint
                      outlines.
                    </>
                  ) : (
                    "Faint outlines show the estimated range of skills to practice."
                  )}
                </p>
              )}
              {frontier && <PathwayLevels frontier={frontier} />}
            </details>
          </footer>
        </>
      )}
      <Dialog
        open={!!lesson}
        onOpenChange={(open) => {
          if (!open) closeLesson();
        }}
        title="Explore a problem type"
        fullOnPhone
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (lessonTrigger.current?.isConnected) lessonTrigger.current.focus();
        }}
      >
        {canPractice && lessonSkill && lesson && (
          <Link
            className="pathways-lesson-practice"
            to="/$"
            params={{ _splat: "practice" }}
            search={{ skill: lessonSkill, template: lesson }}
          >
            Try this problem type →
          </Link>
        )}
        {lesson && (
          <LessonBoundary key={lesson} onBack={closeLesson}>
            <Suspense fallback={<Loading>Loading lesson…</Loading>}>
              <SkillLesson templateId={lesson} onBack={closeLesson} />
            </Suspense>
          </LessonBoundary>
        )}
      </Dialog>
    </main>
  );
}

/** Where the learner is by area, as every level view draws it
 * (ui/level-range): the overall estimate, then each area practiced. */
function PathwayLevels({
  frontier,
}: {
  frontier: {
    overall: { level: number; sd: number };
    strands: Record<string, { level: number; sd: number; answered?: number }>;
  };
}) {
  const areas = Object.entries(frontier.strands)
    .filter(([, estimate]) => (estimate.answered ?? 1) > 0)
    .map(([id, estimate]) => ({
      id,
      label: strandNames[id] ?? id,
      estimate,
    }));
  const scale = fitScale(
    [frontier.overall, ...areas.map((area) => area.estimate)],
    { minSpan: 5 },
  );
  return <LevelRows overall={frontier.overall} areas={areas} scale={scale} />;
}

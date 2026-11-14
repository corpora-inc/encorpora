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
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { skillCatalogOptions } from "../../lib/learning-view";
import { request } from "../../lib/api";
import { useUrlSearchText } from "../../lib/url-search-text";
import { useLearnerStore } from "../../learner-store";
import type { AuthSession } from "../../auth";
import { gradeName } from "../../Home";
import { fitScale, LevelRows, WHOLE_SCALE } from "../../ui/level-range";
import { measured } from "../../../learning/level-check";
import { useLessonSearch, type SearchResult } from "../../lib/lesson-search";
import { SearchResults, type SearchActions } from "../search/SearchResults";
import { useSearchCorpus } from "../search/search-corpus";
import { strandNames } from "../../BirthYearPrompt";
import { Graph } from "./Graph";
import { PathwayPlan } from "./PathwayPlan";
import { canDrawMap } from "./drawable";
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
} from "./model";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import { LayerHost } from "../../nav/LayerHost";
import { EntityLink, useLayers } from "../../nav/links";
import { OPEN_KEY, pushLayer } from "../../nav/entities";
import { buttonClass } from "../../ui/Button";
import layers from "../../nav/layers.module.css";
import { RootLink } from "../../nav/root";
import { usePathwaysMetadata } from "./usePathwaysMetadata";
import "./pathways.css";
import { Loading } from "../../ui/Loading";
import {
  adultLearner,
  practicingAsAdult,
  profileLearner,
} from "../../lib/adult-learner";
import { secondParentChild, secondParentChildren } from "../second-parent/api";
import {
  useAddressedIdentity,
  useAddressedRecordsReadable,
} from "../spaces/useAddressed";
import { childAddress, childPath } from "../spaces/identity";
import { childFamily } from "../spaces/learner-urls";
import { familyPlacesOptions } from "../family/api";
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

/** On a phone a long list of results can leave the page scrolled past the
 * map, under the bar. A chosen skill shows on the map, so bring the map's
 * top back into view (a cut under reduced motion). */
function showMap() {
  requestAnimationFrame(() => {
    const map = document.querySelector<HTMLElement>(
      ".pathways-viewport, .pathways-plan",
    );
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
  const { learnerId: chosenId, select } = useLearnerStore();
  // Whose map the address names (features/spaces/identity.ts): yourself at
  // /pathways, a family's child at /family/<family>/kids/<learner>/pathways,
  // a practice profile by `?profile=`. Unnamed, a parent with no practice of
  // their own was sent to their child's address before this showed.
  const addressed = useAddressedIdentity();
  const learnerId = addressed?.id ?? chosenId;
  const navigate = useNavigate();
  const places = useQuery(familyPlacesOptions(session));
  const pathname = useLocation({ select: (location) => location.pathname });
  const childMap = !!childAddress(pathname);
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
    if (!addressed && solo && own === solo && learnerId !== solo.id)
      select(solo.id);
  }, [solo?.id, learnerId]);
  /** Another child's map is their own address. */
  const openChild = (id: string) => {
    const family = account ? childFamily(account, id, places.data) : null;
    if (!family) return;
    void navigate({
      to: "/$",
      params: { _splat: childPath(family, id, "pathways").slice(1) },
    });
  };
  // A second parent's family's children follow the family's own: their
  // progress, read-only.
  const learners = own
    ? [own]
    : [...(account?.learners ?? []), ...secondParentChildren(account)];
  // A child's map is theirs to read: their practice is their own session,
  // from their page or the family's Today, never this adult's /practice.
  const viewOnly =
    (!own && !!secondParentChild(account, learnerId)) || (childMap && !own);
  const readable = useAddressedRecordsReadable();
  const learner = readable
    ? learners.find((l) => l.id === learnerId)
    : undefined;
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
      learnerId={learner?.id}
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
                onChange={openChild}
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
  learnerId,
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
  /** The learner's estimate or record is on its way: "Where you are" waits. */
  frontierLoading?: boolean;
  /** Whose map it is: a skill opened here shows their work on it. */
  learnerId?: string;
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
  // A skill is a layer over the map (`?open=skill:<id>`, nav/entities.ts):
  // the top one is the map's selection. Opening and closing it never moves
  // the map; a skill found by the search or the list is framed on it.
  const stack = useLayers().stack;
  const selectedId =
    stack.filter((layer) => layer.kind === "skill").at(-1)?.id ?? "";
  const [frame, setFrame] = useState<{ id: string } | null>(null);
  const urlQuery = typeof search.topic === "string" ? search.topic : "";
  // The field owns its text while typing; the URL follows after a pause.
  const field = useUrlSearchText(urlQuery, (topic) => update({ topic }, true));
  const query = useDeferredValue(field.text);
  const band =
    typeof search.filter === "string" && bands.includes(search.filter)
      ? search.filter
      : "";
  const navigate = useNavigate();
  const { shown } = useCurriculumDetails();
  // A browser that can't draw the 3D map (or loses its context while it is
  // open) gets the flat pathway in its place: no canvas, no camera controls.
  const [drawn, setDrawn] = useState(canDrawMap);
  // Arriving with a search (a link, or /lessons?q=) opens its results.
  // A shared search opens its results, unless the link names a skill: then
  // the skill is what it shows, its search kept in the field.
  const [browse, setBrowse] = useState(
    () => urlQuery.trim().length > 0 && !selectedId,
  );
  // A problem type's short lesson is a layer over the map (nav/entities.ts,
  // `?open=lesson:<id>`): a link, a refresh or Back opens it again, and
  // closing returns to this map as it was.
  const lesson =
    stack.filter((layer) => layer.kind === "lesson").at(-1)?.id ?? null;
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
    const href = (result: SearchResult) => {
      const params = new URLSearchParams(window.location.search);
      if (skillOf(result))
        params.set(
          OPEN_KEY,
          pushLayer(params.get(OPEN_KEY) ?? undefined, {
            kind: "skill",
            id: skillOf(result),
          })!,
        );
      return `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    };
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
        select(skill, true);
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
  const stats = useMemo(
    () => new Map(evidence.map((s) => [s.skillId, s])),
    [evidence],
  );
  const earned = evidence.filter((s) => s.independentCorrect > 0).length;
  const countsReady = !!catalog.data && !recordLoading;
  // The map's own view: its search and grade filter, beside any layers.
  const update = (
    values: {
      topic?: string;
      filter?: string;
      /** A skill to open over the map. */
      skill?: string;
    },
    replace = false,
  ) =>
    void navigate({
      // This map's own address: yours, or a child's.
      to: ".",
      search: ((current: Record<string, unknown>) => {
        const next: Record<string, unknown> = {
          ...current,
          topic:
            (values.topic === undefined ? field.carry() : values.topic) ||
            undefined,
          filter:
            (values.filter === undefined ? band : values.filter) || undefined,
        };
        if (values.skill)
          next[OPEN_KEY] = pushLayer(current[OPEN_KEY], {
            kind: "skill",
            id: values.skill,
          });
        return next;
      }) as never,
      replace,
      resetScroll: false,
    });
  /** Opens a skill over the map. Chosen on the map, the map stays where it
   * is; found by the search or the list, the map frames it as it opens. */
  const select = (id: string, framed = false) => {
    setBrowse(false);
    if (framed) setFrame({ id });
    update({ skill: id });
    if (framed) showMap();
  };
  const filtered =
    skills?.filter(
      (s) =>
        (!band || s.gradeBand === band) &&
        matchesQuery(`${s.title} ${s.description}`, query),
    ) ?? [];
  const range = frontier ? frontierRange(frontier, selected?.strand) : null;
  const overall = frontier ? frontierRange(frontier) : null;
  const level = useMemo(
    () =>
      skills && !frontierLoading
        ? levelRegion(skills, frontier, evidence)
        : null,
    [skills, frontier, evidence, frontierLoading],
  );
  // What this map offers with a skill opened over it: what a search found
  // in it, then practicing it (or the way in, for a visitor).
  const skillActions = (skillId: string) => {
    const found = picked?.skill === skillId ? picked : null;
    const practiced = catalog.data?.templates.some(
      (t) => t.skillId === skillId,
    );
    const shownFound = found && found.kind !== "term" ? found : null;
    if (!shownFound && (readOnly || !practiced)) return null;
    return (
      <>
        {shownFound && (
          <div className={layers.row} data-found={shownFound.kind}>
            <span>
              <span className={layers.rowFact}>
                {shownFound.kind === "lesson"
                  ? "Lesson"
                  : shownFound.kind === "film"
                    ? "Lesson film"
                    : "Problem type"}
              </span>{" "}
              {shownFound.title}
            </span>
            {shownFound.kind === "type" ? (
              <EntityLink
                entity={{ kind: "lesson", id: shownFound.id }}
                className={layers.rowAction}
              >
                View lesson
              </EntityLink>
            ) : shownFound.kind === "film" ? (
              <Link
                className={layers.rowAction}
                to="/lessons/$templateId/watch"
                params={{ templateId: shownFound.id }}
                search={{
                  from: window.location.pathname + window.location.search,
                }}
              >
                Watch
              </Link>
            ) : (
              <Link
                className={layers.rowAction}
                to="/$"
                params={{ _splat: `lessons/${shownFound.id}` }}
              >
                Read the lesson
              </Link>
            )}
          </div>
        )}
        {!readOnly && practiced && (
          <div className={layers.actions}>
            {canPractice ? (
              <Link
                className={buttonClass("primary")}
                to="/$"
                params={{ _splat: "practice" }}
                search={{
                  skill: skillId,
                  // A problem type the search found: that one.
                  ...(found?.kind === "type" || found?.kind === "film"
                    ? { template: found.id }
                    : {}),
                }}
              >
                Try a problem
              </Link>
            ) : (
              <Link
                className={buttonClass("primary")}
                to="/$"
                params={{ _splat: start.slice(1) }}
              >
                {actionLabel}
              </Link>
            )}
          </div>
        )}
      </>
    );
  };
  return (
    <main className={`pathways ${browse ? "is-browsing" : ""}`}>
      {/* Signed in, the app frame's bar holds the logo, the Progress tabs and
          the way to practice. A visitor gets the map's own header. */}
      {guestMode && (
        <header className="pathways-header">
          <NavigationDrawer />
          <RootLink className="pathways-brand">
            <span>
              Adaptive Math <strong>Pathways</strong>
            </span>
          </RootLink>
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
                    <EntityLink
                      entity={{ kind: "skill", id: s.id }}
                      aria-current={selectedId === s.id ? "page" : undefined}
                      onClick={() => {
                        setBrowse(false);
                        setFrame({ id: s.id });
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
                    </EntityLink>
                  </li>
                ))}
              </ul>
              {!searching && !filtered.length && (
                <p>No matching skills. Try another grade.</p>
              )}
            </section>
            {drawn ? (
              <Graph
                skills={skills}
                evidence={evidence}
                selected={selectedId}
                onSelect={select}
                frame={frame}
                range={range}
                rangeStrand={selected?.strand}
                level={level}
                levelLoading={frontierLoading}
                onUnavailable={() => setDrawn(false)}
              />
            ) : (
              <PathwayPlan
                skills={skills}
                evidence={evidence}
                selected={selectedId}
                frame={frame}
                here={level ? overall : null}
              />
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
              {!drawn
                ? selected
                  ? "Cyan: what it builds on · Violet: what it leads to"
                  : "Rows run from the first skills to precalculus. Brighter gems mark stronger practice."
                : selected
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
                  {shown && drawn ? (
                    <>
                      Overall frontier: {gradeName(range.lo)} to{" "}
                      {gradeName(range.hi)} · estimated range shown by faint
                      outlines.
                    </>
                  ) : drawn ? (
                    "Faint outlines show the estimated range of skills to practice."
                  ) : (
                    "“Where you are” marks the range of skills to practice next."
                  )}
                </p>
              )}
              {frontier && <PathwayLevels frontier={frontier} />}
            </details>
          </footer>
        </>
      )}
      {/* A skill or a lesson opened here is a layer over the map: the map
          stays, where it was. */}
      <LayerHost
        learner={learnerId}
        skillActions={skillActions}
        lessonActions={(type, skill) => {
          if (type !== lesson || readOnly) return null;
          // The skill it practices: the one open under it, else its own.
          const practiced = lessonSkill ?? skill;
          // The learner is on their way: the action's place is held, so the
          // film beside it never moves.
          if (recordLoading)
            return (
              <span
                className={buttonClass("primary")}
                aria-hidden="true"
                data-action-wait=""
                style={{ visibility: "hidden" }}
              >
                Try this problem type
              </span>
            );
          if (!practiced) return null;
          return canPractice ? (
            <Link
              className={buttonClass("primary")}
              to="/$"
              params={{ _splat: "practice" }}
              search={{ skill: practiced, template: type }}
            >
              Try this problem type
            </Link>
          ) : (
            // Not practicing yet: the way in, as the skill's own layer offers.
            <Link
              className={buttonClass("primary")}
              to="/$"
              params={{ _splat: start.slice(1) }}
            >
              {actionLabel}
            </Link>
          );
        }}
      />
    </main>
  );
}

/** Where the learner is by area, as every level view draws it
 * (ui/level-range): the overall estimate, then each area practiced. */
function PathwayLevels({
  frontier,
}: {
  frontier: {
    overall: { level: number; sd: number; answered?: number };
    strands: Record<string, { level: number; sd: number; answered?: number }>;
  };
}) {
  // Before the first answer: not measured yet, the whole scale (Q-201).
  if (!measured(frontier.overall))
    return <LevelRows overall={null} areas={[]} scale={WHOLE_SCALE} moving />;
  const areas = Object.entries(frontier.strands)
    .filter(([, estimate]) => measured(estimate))
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

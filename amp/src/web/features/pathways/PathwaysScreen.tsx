import {
  childAddress,
  childPath,
  practiceParams,
  practicePath,
} from "../spaces/identity";
import { useSession, useSessionOrNull } from "../../lib/session";
import { qk } from "../../lib/keys";
import {
  CurriculumPractice,
  PracticeLabel,
} from "../practice/CurriculumPractice";
import { ScreenTitle } from "../../ui/ScreenTitle";
import { FREE_ONLINE_PROBLEMS } from "../../../learning/free-allowance";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import { NavigationDrawer } from "../navigation/NavigationDrawer";
import {
  Suspense,
  startTransition,
  useDeferredValue,
  useImperativeHandle,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { meOptions } from "../../lib/query";
import { skillCatalogOptions } from "../../lib/learning-view";
import { request } from "../../lib/api";
import { useUrlSearchText } from "../../lib/url-search-text";
import { useCurrentLearner } from "../../learner-store";
import { useLearnerChoice } from "../spaces/learner-choice";
import { gradeName } from "../../Home";
import { byArea, fitScale, LevelRows, WHOLE_SCALE } from "../../ui/level-range";
import { measured } from "../../../learning/level-check";
import { SearchResults } from "../search/SearchResults";
import {
  SiteSearchField,
  useResultKeys,
  useSearchActions,
  useSiteSearch,
} from "../search/SiteSearch";
import { strandNames } from "../../BirthYearPrompt";
import { lazyRouteComponent } from "../../lib/lazy-route-component";
import { PathwayPlan } from "./PathwayPlan";
import { AreaKey } from "./AreaKey";
import { canDrawMap } from "./drawable";
import {
  areas,
  bandLabel,
  bands,
  skillLight,
  areaSlot,
  progressSchema,
  frontierSchema,
  frontierRange,
  levelRegion,
  type Frontier,
  type Evidence,
} from "./model";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import { Segmented } from "../../ui/Segmented";
import { LayerHost } from "../../nav/LayerHost";
import { useMapView } from "./map-view";
import { EntityLink, shareableHref, useLayers } from "../../nav/links";
import { pushed } from "../../nav/layer-store";
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
import { childFamily } from "../spaces/learner-urls";
import { familyPlacesOptions } from "../family/api";
const emptyEvidence: Evidence[] = [];
/** How the map is drawn: by grade (the default, everywhere) or in 3D. */
type MapMode = "grades" | "3d";
const VIEW_KEY = "amp.pathways-view";
const viewOptions = [
  { value: "grades" as const, label: "Grades" },
  { value: "3d" as const, label: "3D" },
];
/** The 3D map is three.js (about 140 KB compressed), and the grades view is
 * the default: the map's code loads when it is chosen, and is fetched while
 * the browser is idle once Pathways shows, so choosing it is immediate. */
const Graph = lazyRouteComponent(() => import("./Graph"), "Graph");
/** The map's box while its code arrives: the same size, the same atlas. */
const MapWaiting = () => (
  <section
    className="pathways-viewport"
    aria-label="Interactive curriculum map"
    aria-busy="true"
  />
);
/** This device's last choice of view; the grades view until there is one. */
function savedView(): MapMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "3d" ? "3d" : "grades";
  } catch (error) {
    console.warn("This device's map view is not readable", error);
    return "grades";
  }
}
const bandOptions: ListboxOption[] = [
  { value: "", label: "All grades & courses" },
  ...bands.map((b) => ({ value: b, label: bandLabel(b) })),
];
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
    // The 3D map only: the grades view centres the chosen skill itself.
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
  // The route made sure of the session before this screen (framedScreen).
  const session = useSessionOrNull();
  // This public resource outlives the keyed learner view. Keep its in-flight
  // read alive when the account resolves and that view changes learner.
  useQuery(skillCatalogOptions);
  return session ? <LearnerMap key={session.accountId} /> : <GuestMap />;
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

function LearnerMap() {
  const session = useSession();
  const me = useQuery(meOptions(session));
  const chosenId = useCurrentLearner();
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
  const choice = useLearnerChoice();
  // A child's session never has a chooser, so holds no place for one.
  const holding = me.isPending && !session.accountId.startsWith("school:");
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
    queryKey: qk.account(session.accountId, "pathways", learner?.id),
    enabled: !!learner,
    refetchInterval: 30_000,
    queryFn: ({ signal }) =>
      request(`/learners/${learner!.id}/progress`, progressSchema, {
        token: session.token,
        signal,
      }),
  });
  const frontier = useQuery({
    queryKey: qk.account(session.accountId, "pathways-frontier", learner?.id),
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
    "Learners didn’t load. Try again."
  ) : (me.data?.signedIn && learners.length === 0) || !learner ? (
    // The add link or the learner picker beside it says what to do.
    ""
  ) : progress.isPending ? (
    <Loading inline>Loading earned skills…</Loading>
  ) : progress.isError ? (
    "Progress didn’t load. Try again."
  ) : (
    // All in: the map says the rest.
    ""
  );
  if (me.data && !me.data.signedIn) return <GuestMap />;
  return (
    <MapView
      evidence={progress.data?.skills ?? emptyEvidence}
      start={learner ? practicePath(learner.id) : "/start"}
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
          {/* Only when there is a real choice (learner-choice.ts); the row
              holds its place while the account loads. */}
          {(holding || choice.canChoose) && (
            <div
              className="pathways-learner"
              aria-hidden={holding || undefined}
              style={holding ? { visibility: "hidden" } : undefined}
            >
              <span aria-hidden="true">Learner</span>
              <ListboxDisclosure
                label="Learner"
                placeholder="Choose learner"
                align="end"
                options={choice.learners.map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
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
              The level estimate didn’t load. Try again.
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
  /** "/sign-up", "/start", or the learner's practice (`/practice/<id>`). */
  start: string;
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
  // Its search, grade and area: this screen's map view (map-view.ts).
  const mapView = useMapView();
  // A skill is a layer over the map (nav/layer-store.ts): the top one is the
  // map's selection. Opening and closing it never moves the map; a skill
  // found by the search or the list is framed on it.
  const mapLayers = useLayers();
  const stack = mapLayers.stack;
  const selectedId =
    stack.filter((layer) => layer.kind === "skill").at(-1)?.id ?? "";
  const [frame, setFrame] = useState<{ id: string } | null>(null);
  const savedQuery = mapView.topic;
  // The field owns its text while typing (MapSearchField, so a keystroke
  // repaints only the field); this screen takes the query in a transition,
  // and the map's view follows after a pause.
  const [typed, setTyped] = useState(savedQuery);
  const search = useRef<{ flush: () => void }>(null);
  const query = useDeferredValue(typed);
  const band = bands.includes(mapView.band) ? mapView.band : "";
  // One area of math, chosen in the key; else all five.
  const area = mapView.area;
  const { shown } = useCurriculumDetails();
  // A browser that can't draw the 3D map (or loses its context while it is
  // open) gets the flat pathway in its place: no canvas, no camera controls,
  // and no choice of view.
  const [drawn, setDrawn] = useState(canDrawMap);
  // The grades view, or 3D: this device's last choice. Either keeps the
  // skill open over it.
  const [view, setView] = useState(savedView);
  const threeD = drawn && view === "3d";
  // Fetch the map's code once the screen is up, so choosing 3D is immediate.
  useEffect(() => {
    if (!drawn) return;
    const fetchMap = () => void Graph.preload?.();
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(fetchMap, { timeout: 4000 });
      return () => cancelIdleCallback(idle);
    }
    const timer = setTimeout(fetchMap, 1500);
    return () => clearTimeout(timer);
  }, [drawn]);
  const chooseView = (next: MapMode) => {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch (error) {
      // This device keeps no choice; this visit still does.
      console.warn("This device keeps no map view", error);
    }
    setView(next);
  };
  // Arriving with a search (a link, or /lessons?q=) opens its results.
  // A shared search opens its results, unless the link names a skill: then
  // the skill is what it shows, its search kept in the field.
  const [browse, setBrowse] = useState(
    () => savedQuery.trim().length > 0 && !selectedId,
  );
  // A problem type's short lesson is a layer over the map
  // (nav/layer-store.ts): a refresh or Back to this screen shows it again,
  // and closing returns to this map as it was.
  const lesson =
    stack.filter((layer) => layer.kind === "lesson").at(-1)?.id ?? null;
  // The one search (docs/design/ia.md): skills, lessons, films and math
  // words, grouped, once there is something typed.
  const searching = query.trim().length > 0;
  const found = useSiteSearch(query, browse);
  const keys = useResultKeys();
  // On Pathways every result selects its skill in the map, as the list
  // without a search does (founder): the camera frames it, its panel opens,
  // the search closes with the query kept. A lesson, problem type or film is
  // then offered first in the panel, as found.
  const [picked, setPicked] = useState<SearchFound | null>(null);
  const searchActions = useSearchActions(found.docs, (result, skill) => {
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
  });
  // A chosen grade or course narrows the results too; math words stay.
  const results = useMemo(
    () =>
      band
        ? found.results.filter(
            (result) => result.kind === "term" || result.band === band,
          )
        : found.results,
    [found.results, band],
  );
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
  /** Opens a skill over the map. Chosen on the map, the map stays where it
   * is; found by the search or the list, the map frames it as it opens. */
  const select = (id: string, framed = false) => {
    setBrowse(false);
    if (framed) setFrame({ id });
    // The search's text stays in the map's view; the skill opens over the
    // map, in this screen's layers.
    search.current?.flush();
    mapLayers.open({ kind: "skill", id });
    if (framed) showMap();
  };
  const filtered =
    skills?.filter(
      (s) =>
        (!band || s.gradeBand === band) &&
        (!area || areaSlot(s) === areas.findIndex((a) => a.id === area)),
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
                to="/$"
                // Closing the film comes Back here, the map's layers as
                // they were (nav/layer-store.ts).
                params={{ _splat: `lessons/${shownFound.id}/watch` }}
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
        {readOnly && practiced && (
          <CurriculumPractice filter={{ skill: skillId }} />
        )}
        {!readOnly && practiced && (
          <div className={layers.actions}>
            {canPractice ? (
              <Link
                className={buttonClass("primary")}
                to="/$"
                // The skill's practice, at its own address; a problem type
                // the search found: that one (it wins over its skill).
                params={
                  learnerId
                    ? practiceParams(learnerId, {
                        skill: skillId,
                        ...(found?.kind === "type" || found?.kind === "film"
                          ? { template: found.id }
                          : {}),
                      })
                    : { _splat: "practice" }
                }
              >
                <PracticeLabel />
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
    <main
      className={`pathways ${browse ? "is-browsing" : ""} ${threeD ? "" : "is-flow"}`}
    >
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
        <MapSearchField
          saved={savedQuery}
          save={(topic) => mapView.set({ topic })}
          onQuery={setTyped}
          handle={search}
          className="pathways-search"
          inputRef={keys.input}
          onFocus={() => setBrowse(true)}
          onChange={() => setBrowse(true)}
          onEscape={() => setBrowse(false)}
          onKeyDown={keys.onKeyDown}
        />
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
        {drawn && (
          <div className="pathways-view">
            <Segmented
              label="Map view"
              options={viewOptions}
              value={view}
              onChange={chooseView}
              compact
              dense
            />
          </div>
        )}
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
              <div className="pathways-grade" hidden={!shown && !band}>
                {!shown && band && (
                  <small>Filtered by grade. Choose All grades to clear.</small>
                )}
                <span aria-hidden="true">Grade or course</span>
                <ListboxDisclosure
                  label="Grade or course"
                  options={bandOptions}
                  value={band}
                  onChange={(next) => mapView.set({ band: next })}
                />
              </div>
              {searching && (
                <div
                  className="pathways-results"
                  ref={keys.list}
                  onKeyDown={keys.onKeyDown}
                >
                  <SearchResults
                    results={results}
                    pending={found.pending}
                    actions={searchActions}
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
                          color: `var(--atlas-area-${areaSlot(s)})`,
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
            {threeD ? (
              <Suspense fallback={<MapWaiting />}>
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
                  area={area}
                  onUnavailable={() => setDrawn(false)}
                />
              </Suspense>
            ) : (
              <PathwayPlan
                skills={skills}
                evidence={evidence}
                selected={selectedId}
                frame={frame}
                here={level ? overall : null}
                levelLoading={frontierLoading}
                area={area}
              />
            )}
          </div>
          <footer className="pathways-footer">
            {/* The grades view holds its key at its top. */}
            {threeD && <AreaKey area={area} className="pathways-legend" />}
            <p>
              {!threeD
                ? selected
                  ? "Cyan: builds on · Violet: leads to"
                  : "Brighter gems: stronger practice"
                : selected
                  ? "Cyan: builds on · Violet: leads to · Dotted: related"
                  : "Lines lead from a skill to the skills that use it"}
            </p>
            <details className="pathways-note">
              <summary>How skills grow</summary>
              <p>
                Each correct answer without help fills a twentieth of a skill’s
                bar. What is earned stays. A bar records practice on that skill
                only, not a whole grade.
              </p>
              {range && !selected && (
                <p>
                  {shown && threeD ? (
                    <>
                      Overall frontier: {gradeName(range.lo)} to{" "}
                      {gradeName(range.hi)} · estimated range shown by faint
                      outlines.
                    </>
                  ) : threeD ? (
                    "Faint outlines show the estimated range of skills to practice."
                  ) : (
                    "“Where you are” marks the range of skills to practice next."
                  )}
                </p>
              )}
              {frontier && (
                <PathwayLevels frontier={frontier} numbers={shown} />
              )}
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
                <PracticeLabel />
              </span>
            );
          if (!practiced) return null;
          return canPractice ? (
            <Link
              className={buttonClass("primary")}
              to="/$"
              params={
                learnerId
                  ? practiceParams(learnerId, {
                      skill: practiced,
                      template: type,
                    })
                  : { _splat: "practice" }
              }
            >
              <PracticeLabel />
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
  numbers,
}: {
  /** Grade names on the axis: off where the child's grades are hidden. */
  numbers: boolean;
  frontier: {
    overall: { level: number; sd: number; answered?: number };
    strands: Record<string, { level: number; sd: number; answered?: number }>;
  };
}) {
  // Before the first answer: not measured yet, the whole scale (Q-201).
  if (!measured(frontier.overall))
    return (
      <LevelRows
        overall={null}
        areas={[]}
        scale={WHOLE_SCALE}
        numbers={numbers}
        moving
      />
    );
  const areas = byArea(
    Object.entries(frontier.strands)
      .filter(([, estimate]) => measured(estimate))
      .map(([id, estimate]) => ({
        id,
        label: strandNames[id] ?? id,
        estimate,
      })),
  );
  const scale = fitScale(
    [frontier.overall, ...areas.map((area) => area.estimate)],
    { minSpan: 5 },
  );
  return (
    <LevelRows
      overall={frontier.overall}
      areas={areas}
      scale={scale}
      numbers={numbers}
    />
  );
}

/** The map's search field. Its text is its own while typing, so a
 * keystroke's urgent render is the field alone; the screen receives the
 * query in a transition (React may interrupt it for the next keystroke), and
 * the map's view stores it after a pause (lib/url-search-text.ts). */
function MapSearchField({
  saved,
  save,
  onQuery,
  handle,
  ...props
}: {
  saved: string;
  save: (topic: string) => void;
  onQuery: (query: string) => void;
  handle: Ref<{ flush: () => void }>;
} & Omit<ComponentProps<typeof SiteSearchField>, "field">) {
  const field = useUrlSearchText(saved, save);
  useImperativeHandle(handle, () => ({ flush: field.flush }), [field.flush]);
  useEffect(() => {
    startTransition(() => onQuery(field.text));
  }, [field.text]);
  return <SiteSearchField field={field} {...props} />;
}

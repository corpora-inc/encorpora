import { childAddress, practiceParams } from "../spaces/identity";
import { PracticeLabel } from "../practice/CurriculumPractice";
import { ScreenTitle } from "../../ui/ScreenTitle";
import { EntityLink } from "../../nav/links";
import { LayerHost } from "../../nav/LayerHost";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "@tanstack/react-router";
import { skillCatalogOptions, useLearningView } from "../../lib/learning-view";
import { useUrlSearchText } from "../../lib/url-search-text";
import { useHeroAction } from "../../lib/shell-slots";
import { useInventoryView } from "./inventory-view";
import {
  bandLabel,
  bands,
  areaParam,
  areas,
  areaSlot,
  illumination,
  type Evidence,
  type MapSkill,
} from "../pathways/model";
import { gradeName } from "../../Home";
import { buttonClass } from "../../ui/Button";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import styles from "./Inventory.module.css";
import layers from "../../nav/layers.module.css";
import { Loading } from "../../ui/Loading";
import { SearchResults } from "../search/SearchResults";
import {
  SiteSearchField,
  useResultKeys,
  useSearchActions,
  useSiteSearch,
} from "../search/SiteSearch";

/* Inventory: every skill the learner has met, how far each has grown and how
   strong it is lately. The founder's reference for a dense screen: one flat
   list across the page's width, filters whose counts follow the search and
   the math area, and nothing that sits empty. A learner who hasn't answered
   yet sees the whole curriculum they'll fill. */

type Filter = "tried" | "earned" | "strong" | "all";
const filters: { id: Filter; label: string }[] = [
  { id: "tried", label: "Tried" },
  { id: "earned", label: "Earned" },
  { id: "strong", label: "Strong" },
  { id: "all", label: "All" },
];
const areaOptions: ListboxOption[] = [
  { value: "", label: "Every math area" },
  ...areas.map((a) => ({ value: a.id, label: a.title })),
];
/** Older links named the earned collection "illuminated". */
const readFilter = (value: unknown): Filter | null =>
  value === "illuminated"
    ? "earned"
    : filters.some((f) => f.id === value)
      ? (value as Filter)
      : null;
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;
function strength(e?: Evidence) {
  return !e?.attempts
    ? "Not tried"
    : e.status === "review-ready"
      ? "Strong"
      : e.independentCorrect
        ? "Building"
        : "Getting started";
}
const shows = (filter: Filter, e?: Evidence) =>
  filter === "all" ||
  (filter === "tried" && !!e?.attempts) ||
  (filter === "earned" && !!e?.independentCorrect) ||
  (filter === "strong" && e?.status === "review-ready");

export function InventoryScreen() {
  const view = useLearningView();
  // A family's child's inventory (/family/<family>/kids/<learner>/inventory):
  // theirs to read. Their practice is their own session, never this adult's.
  const child = !!childAddress(
    useLocation({ select: (location) => location.pathname }),
  );
  const { shown } = useCurriculumDetails();
  const catalog = useQuery(skillCatalogOptions);
  // How this inventory is being looked at (inventory-view.ts): its search,
  // collection and area, kept for the screen, never in the address.
  const inventoryView = useInventoryView();
  // The field owns its text while typing; the view follows after a pause.
  const field = useUrlSearchText(inventoryView.topic, (topic) =>
    inventoryView.set({ topic }),
  );
  const query = useDeferredValue(field.text.trim());
  // The math area, as Pathways names it (`?area=geometry`).
  const area = areaParam(inventoryView.area) ?? "";
  const evidence = useMemo(
    () => new Map(view.evidence?.skills.map((e) => [e.skillId, e]) ?? []),
    [view.evidence],
  );
  const allSkills = catalog.data?.skills ?? [];
  // Counts follow the chosen math area and the search, so every number
  // matches the list it opens.
  const inArea = area
    ? allSkills.filter((s) => areas[areaSlot(s)]?.id === area)
    : allSkills;
  // The one search (features/search): its skills, best first, then any
  // other skill whose own words hold what was typed. Its lessons and math
  // words follow the list; every result opens its skill over the page.
  const [warm, setWarm] = useState(false);
  const found = useSiteSearch(query, warm);
  const keys = useResultKeys();
  const actions = useSearchActions(found.docs);
  const needle = query.toLowerCase();
  const rank = new Map(
    found.results
      .filter((result) => result.kind === "skill")
      .map((result, at) => [result.target, at]),
  );
  const matching = needle
    ? inArea
        .filter(
          (s) =>
            rank.has(s.id) ||
            `${s.title} ${s.description}`.toLowerCase().includes(needle),
        )
        .sort(
          (a, b) =>
            (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size),
        )
    : inArea;
  // Lessons in the chosen math area (a lesson's area is its skill's).
  const areaOfSkill = useMemo(
    () => new Map(allSkills.map((s) => [s.id, areas[areaSlot(s)]?.id])),
    [allSkills],
  );
  const related = area
    ? found.results.filter(
        (result) =>
          result.kind === "term" || areaOfSkill.get(result.skill) === area,
      )
    : found.results;
  const count = (filter: Filter) =>
    matching.filter((s) => shows(filter, evidence.get(s.id))).length;
  const triedAnything = (view.evidence?.skills ?? []).some((e) => e.attempts);
  // Before the first answer the collection is the whole curriculum.
  const filter =
    readFilter(inventoryView.collection) ?? (triedAnything ? "tried" : "all");
  const update = (values: { collection?: string; area?: string }) =>
    inventoryView.set({ topic: field.carry(), ...values });
  const earnedInArea = inArea.filter(
    (s) => (evidence.get(s.id)?.independentCorrect ?? 0) > 0,
  );
  const strongInArea = inArea.filter(
    (s) => evidence.get(s.id)?.status === "review-ready",
  );
  const xp = earnedInArea.reduce(
    (sum, s) => sum + (evidence.get(s.id)?.independentCorrect ?? 0),
    0,
  );
  const inCollection = matching.filter((s) =>
    shows(filter, evidence.get(s.id)),
  );
  // A search lists best first; the whole collection, by grade then title.
  const visible = needle
    ? inCollection
    : inCollection.sort(
        (a, b) =>
          bands.indexOf(a.gradeBand) - bands.indexOf(b.gradeBand) ||
          a.title.localeCompare(b.title),
      );
  const busy = catalog.isPending || view.loading;
  const failure = catalog.error || view.error;
  const level =
    shown && view.frontier?.overall.answered
      ? view.frontier.overall.level
      : null;
  // Day 0: a centred hero rather than 335 untouched rows (docs/design/ia.md,
  // rule 7). Asking for a filter or a search shows the list itself.
  const hero =
    !busy &&
    !failure &&
    view.active &&
    !child &&
    !triedAnything &&
    !inventoryView.collection &&
    !query &&
    !area;
  if (hero)
    return (
      <main className={styles.page}>
        <InventoryHero
          browseAll={() => inventoryView.set({ collection: "all" })}
          learner={view.learner?.id}
          total={allSkills.length}
          preview={visible.slice(0, 4).map((skill) => skill.title)}
        />
      </main>
    );
  return (
    <main className={styles.page}>
      {/* The app frame's bar holds the logo, the Progress tabs and the way to
          practice; whose record this is shows in the drawer. */}
      <div className={styles.heading}>
        <ScreenTitle>Inventory</ScreenTitle>
        {/* With grade numbers on, held while the estimate loads, so the
            title row never moves. */}
        {shown && (
          <p
            className={styles.level}
            style={level === null ? { visibility: "hidden" } : undefined}
            aria-hidden={level === null || undefined}
          >
            Estimated level <strong>{gradeName(level ?? 5)}</strong>
          </p>
        )}
      </div>
      {failure ? (
        <section className={styles.notice} role="alert">
          <p>Skills didn’t load. Try again.</p>
          <button
            className={buttonClass("secondary")}
            onClick={() => {
              view.retry();
              void catalog.refetch();
            }}
          >
            Try again
          </button>
        </section>
      ) : busy ? (
        <div className={styles.waiting}>
          <Loading>Loading skills…</Loading>
        </div>
      ) : !view.active ? (
        <p className={styles.lead}>
          {view.learners.length > 1
            ? "Choose a learner in the menu."
            : "Skills appear here once someone practices."}
        </p>
      ) : (
        <>
          {triedAnything ? (
            <section className={styles.summary} aria-label="Totals">
              {/* Earned and strong are counted once, on their filters. */}
              <Stat value={xp} label="XP" />
            </section>
          ) : null}
          <div className={styles.filters}>
            <SiteSearchField
              field={field}
              onFocus={() => setWarm(true)}
              inputRef={keys.input}
              onKeyDown={keys.onKeyDown}
            />
            <ListboxDisclosure
              label="Math area"
              align="end"
              options={areaOptions}
              value={area}
              onChange={(next) => update({ area: next || "" })}
            />
          </div>
          {triedAnything && (
            <div
              className={styles.filterRow}
              role="group"
              aria-label="Skills to show"
            >
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => update({ collection: f.id })}
                >
                  {f.label}
                  <span>{count(f.id)}</span>
                </button>
              ))}
            </div>
          )}
          {needle ? (
            <div
              className={styles.found}
              ref={keys.list}
              onKeyDown={keys.onKeyDown}
              aria-busy={found.pending}
            >
              <section className={styles.group}>
                <div className={styles.groupHeading}>
                  <h2>Skills</h2>
                  <span>{plural(visible.length, "skill")}</span>
                </div>
                {visible.length ? (
                  <ul className={styles.list}>
                    {visible.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        skill={skill}
                        evidence={evidence.get(skill.id)}
                        grade={shown}
                        result
                      />
                    ))}
                  </ul>
                ) : found.pending ? (
                  <Loading>Searching…</Loading>
                ) : (
                  <p className={styles.lead}>
                    No skills match. Try another search or math area.
                  </p>
                )}
              </section>
              <SearchResults
                results={related}
                pending={found.pending}
                actions={actions}
                groups={["lessons", "glossary"]}
              />
            </div>
          ) : !visible.length ? (
            <p className={styles.lead}>
              {area
                ? "No skills match. Try another math area."
                : filter === "strong"
                  ? "No strong skills yet."
                  : "No skills here yet."}
            </p>
          ) : (
            areas.map((n, i) => {
              const rows = visible.filter((s) => areaSlot(s) === i);
              if (!rows.length) return null;
              return (
                <section className={styles.group} key={n.id}>
                  <div className={styles.groupHeading}>
                    <h2>{n.title}</h2>
                    <span>{plural(rows.length, "skill")}</span>
                  </div>
                  <ul className={styles.list}>
                    {rows.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        skill={skill}
                        evidence={evidence.get(skill.id)}
                        grade={shown}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
          <div className={styles.footer}>
            <details className={styles.explainer}>
              <summary>How XP works</summary>
              <p>
                Each correct answer without help earns 1 XP and fills a
                twentieth of the skill’s bar. Both stay.
              </p>
              <p>
                Strong skills go back to Building when they’re due for review.
                Grade labels place a skill in the curriculum, not the learner.
              </p>
            </details>
          </div>
        </>
      )}
      {/* A skill opens over the list, the learner's own work on it with it:
          the list stays, scrolled where it was. */}
      <LayerHost
        learner={view.learner?.id}
        skillActions={(skill) =>
          view.canPractice &&
          !view.viewOnly &&
          !child &&
          catalog.data?.templates.some((type) => type.skillId === skill) ? (
            <div className={layers.actions}>
              <Link
                className={buttonClass("primary")}
                to="/$"
                // Practice held to this skill, at its own address.
                params={
                  view.learner
                    ? practiceParams(view.learner.id, { skill })
                    : { _splat: "practice" }
                }
              >
                <PracticeLabel />
              </Link>
            </div>
          ) : null
        }
      />
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

/** One skill: its name, a bar that fills with independent successes in its
 * strand's colour, and how strong it is lately. */
function SkillRow({
  skill,
  evidence,
  grade,
  result = false,
}: {
  skill: MapSkill;
  evidence?: Evidence;
  grade: boolean;
  /** A search result: the arrow keys move between results. */
  result?: boolean;
}) {
  const score = illumination(evidence);
  const attempts = evidence?.attempts ?? 0;
  const status = strength(evidence);
  return (
    <li
      className={styles.skill}
      data-strength={status}
      style={
        {
          "--skill-hue": `var(--color-strand-${skill.strand}, var(--color-primary))`,
        } as CSSProperties
      }
    >
      <EntityLink
        className={styles.skillName}
        entity={{ kind: "skill", id: skill.id }}
        data-result={result ? "" : undefined}
      >
        <strong>{skill.title}</strong>
        {grade && <small>{bandLabel(skill.gradeBand)}</small>}
      </EntityLink>
      <div
        className={styles.meter}
        role="meter"
        aria-label={`${skill.title}: skill progress`}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={score}
        aria-valuetext={`${evidence?.independentCorrect ?? 0} of 20 correct without help`}
      >
        <i style={{ width: `${score * 10}%` }} />
      </div>
      <div className={styles.strength}>
        <strong>{status}</strong>
        {attempts > 0 && <small>{plural(attempts, "attempt")}</small>}
      </div>
    </li>
  );
}

/** Day 0: what Inventory will be, the one step that fills it, and the whole
 * list a tap away. The bar's Practice steps aside for this one. */
function InventoryHero({
  learner,
  total,
  preview,
  browseAll,
}: {
  learner: string | undefined;
  total: number;
  preview: readonly string[];
  browseAll: () => void;
}) {
  useHeroAction(true);
  return (
    <section className={styles.hero} aria-labelledby="inventory-title">
      <ul className={styles.heroPreview} aria-hidden="true">
        {preview.map((title, index) => (
          <li key={title} style={{ opacity: 1 - index * 0.2 }}>
            <span>{title}</span>
            <span className={styles.heroBar} />
          </li>
        ))}
      </ul>
      <h1 id="inventory-title">Your skills fill in as you practice</h1>
      <p>
        All {total.toLocaleString("en-US")} skills, from counting to
        precalculus.
      </p>
      <Link
        to="/$"
        params={learner ? practiceParams(learner) : { _splat: "practice" }}
        className={buttonClass("primary", styles.heroGo)}
      >
        Start practicing
      </Link>
      {/* The whole collection, on this same screen (inventory-view.ts). */}
      <button
        type="button"
        className={buttonClass("quiet")}
        onClick={browseAll}
      >
        Browse all {total.toLocaleString("en-US")} skills
      </button>
    </section>
  );
}

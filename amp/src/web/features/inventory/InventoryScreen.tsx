import { ScreenTitle } from "../../ui/ScreenTitle";
import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "../curriculum/CurriculumDetails";
import { useDeferredValue, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { skillCatalogOptions, useLearningView } from "../../lib/learning-view";
import { useUrlSearchText } from "../../lib/url-search-text";
import { useHeroAction } from "../../lib/shell-slots";
import {
  bandLabel,
  bands,
  illumination,
  neighborhood,
  neighborhoods,
  type Evidence,
  type MapSkill,
} from "../pathways/model";
import { gradeName } from "../../Home";
import { buttonClass } from "../../ui/Button";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import styles from "./Inventory.module.css";
import { Loading } from "../../ui/Loading";

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
  ...neighborhoods.map((n) => ({ value: n.title, label: n.title })),
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
  const { shown } = useCurriculumDetails();
  const catalog = useQuery(skillCatalogOptions);
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const urlQuery = typeof search.topic === "string" ? search.topic : "";
  // The field owns its text while typing; the URL follows after a pause.
  const field = useUrlSearchText(urlQuery, (topic) =>
    update({ topic: topic || undefined }, true),
  );
  const query = useDeferredValue(field.text.trim());
  const area =
    typeof search.area === "string" &&
    neighborhoods.some((n) => n.title === search.area)
      ? search.area
      : "";
  const evidence = useMemo(
    () => new Map(view.evidence?.skills.map((e) => [e.skillId, e]) ?? []),
    [view.evidence],
  );
  const allSkills = catalog.data?.skills ?? [];
  // Counts follow the chosen math area and the search, so every number
  // matches the list it opens.
  const inArea = area
    ? allSkills.filter((s) => neighborhoods[neighborhood(s)]?.title === area)
    : allSkills;
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? inArea.filter((s) =>
        `${s.title} ${s.description}`.toLowerCase().includes(needle),
      )
    : inArea;
  const count = (filter: Filter) =>
    matching.filter((s) => shows(filter, evidence.get(s.id))).length;
  const triedAnything = (view.evidence?.skills ?? []).some((e) => e.attempts);
  // Before the first answer the collection is the whole curriculum.
  const filter =
    readFilter(search.collection) ?? (triedAnything ? "tried" : "all");
  const update = (
    values: { topic?: string; collection?: string; area?: string },
    replace = false,
  ) =>
    void navigate({
      to: "/inventory",
      search: {
        topic: field.carry() || undefined,
        collection: search.collection ? filter : undefined,
        area: area || undefined,
        ...values,
      },
      replace,
    });
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
  const visible = matching
    .filter((s) => shows(filter, evidence.get(s.id)))
    .sort(
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
    !triedAnything &&
    !search.collection &&
    !query &&
    !area;
  if (hero)
    return (
      <main className={styles.page}>
        <InventoryHero
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
          <p>Your skills didn’t load. Try again to see the saved progress.</p>
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
            ? "Choose a learner from the AMP menu to see their skills."
            : "Skills appear here once someone practices."}
        </p>
      ) : (
        <>
          {triedAnything ? (
            <section className={styles.summary} aria-label="Totals">
              {/* Earned and strong are counted once, on their filters. */}
              <Stat value={xp} label="XP" />
            </section>
          ) : (
            <p className={styles.lead}>
              Every skill from counting to precalculus. Each one fills in as
              it’s answered without help.
            </p>
          )}
          <div className={styles.filters}>
            <label className={styles.search}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <input
                type="search"
                aria-label="Find a skill"
                placeholder="Find a skill…"
                value={field.text}
                maxLength={100}
                onChange={(e) => field.change(e.target.value)}
                onBlur={field.flush}
                onKeyDown={(e) => {
                  if (e.key === "Enter") field.flush();
                }}
              />
            </label>
            <ListboxDisclosure
              label="Math area"
              align="end"
              options={areaOptions}
              value={area}
              onChange={(next) => update({ area: next || undefined })}
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
          {!visible.length ? (
            <p className={styles.lead}>
              {query || area
                ? "No skills match. Try another search or math area."
                : filter === "strong"
                  ? "No strong skills yet. A skill turns strong after a run of correct answers without help."
                  : "No skills here yet."}
            </p>
          ) : (
            neighborhoods.map((n, i) => {
              const rows = visible.filter((s) => neighborhood(s) === i);
              if (!rows.length) return null;
              return (
                <section className={styles.group} key={n.title}>
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
            <CurriculumDetailsControl />
            <details className={styles.explainer}>
              <summary>How XP and skill progress work</summary>
              <p>
                Each correct answer without help earns 1 XP and fills that
                skill’s bar by a twentieth. XP and filled bars stay.
              </p>
              <p>
                Strong means a strong record on the skill lately; it can go back
                to Building when the skill is due for review. Grade labels give
                the skill’s place in the curriculum, not the learner’s level.
              </p>
            </details>
          </div>
        </>
      )}
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
}: {
  skill: MapSkill;
  evidence?: Evidence;
  grade: boolean;
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
      <Link
        className={styles.skillName}
        to="/pathways/$skillId"
        params={{ skillId: skill.id }}
      >
        <strong>{skill.title}</strong>
        {grade && <small>{bandLabel(skill.gradeBand)}</small>}
      </Link>
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
  total,
  preview,
}: {
  total: number;
  preview: readonly string[];
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
        precalculus. Each one fills as it’s answered without help.
      </p>
      <Link
        to="/$"
        params={{ _splat: "practice" }}
        className={buttonClass("primary", styles.heroGo)}
      >
        Start practicing
      </Link>
      <Link
        to="/inventory"
        search={{ collection: "all" } as never}
        className={buttonClass("quiet")}
      >
        Browse all {total.toLocaleString("en-US")} skills
      </Link>
    </section>
  );
}

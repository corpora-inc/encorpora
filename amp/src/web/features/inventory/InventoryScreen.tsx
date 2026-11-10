import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "../curriculum/CurriculumDetails";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { skillCatalogOptions, useLearningView } from "../../lib/learning-view";
import {
  bandLabel,
  bands,
  illumination,
  neighborhood,
  neighborhoods,
  type Evidence,
} from "../pathways/model";
import { gradeName } from "../../Home";
import { buttonClass } from "../../ui/Button";
import { ListboxDisclosure, type ListboxOption } from "../../ui/Listbox";
import styles from "./Inventory.module.css";
import { Loading } from "../../ui/Loading";

type Filter = "tried" | "illuminated" | "strong" | "all";
const filters: { id: Filter; label: string }[] = [
  { id: "tried", label: "Tried" },
  { id: "illuminated", label: "Illuminated" },
  { id: "strong", label: "Strong" },
  { id: "all", label: "All skills" },
];
const areaOptions: ListboxOption[] = [
  { value: "", label: "Every math area" },
  ...neighborhoods.map((n) => ({ value: n.title, label: n.title })),
];
function strength(e?: Evidence) {
  return !e?.attempts
    ? "Not tried"
    : e.status === "review-ready"
      ? "Strong"
      : e.independentCorrect
        ? "Building"
        : "Getting started";
}

export function InventoryScreen() {
  const view = useLearningView();
  const { shown } = useCurriculumDetails();
  const catalog = useQuery(skillCatalogOptions);
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const query = typeof search.topic === "string" ? search.topic : "";
  const filter = filters.some((f) => f.id === search.collection)
    ? (search.collection as Filter)
    : "tried";
  const area =
    typeof search.area === "string" &&
    neighborhoods.some((n) => n.title === search.area)
      ? search.area
      : "";
  const update = (
    values: { topic?: string; collection?: string; area?: string },
    replace = false,
  ) =>
    void navigate({
      to: "/inventory",
      search: {
        ...view.contextSearch,
        topic: query || undefined,
        collection: filter === "tried" ? undefined : filter,
        area: area || undefined,
        ...values,
      },
      replace,
    });
  const evidence = useMemo(
    () => new Map(view.evidence?.skills.map((e) => [e.skillId, e]) ?? []),
    [view.evidence],
  );
  const allSkills = catalog.data?.skills ?? [];
  // Every count follows the chosen math area, so the numbers match the list.
  const skills = area
    ? allSkills.filter((s) => neighborhoods[neighborhood(s)]?.title === area)
    : allSkills;
  const earned = skills.filter(
    (s) => (evidence.get(s.id)?.independentCorrect ?? 0) > 0,
  );
  const tried = skills.filter((s) => (evidence.get(s.id)?.attempts ?? 0) > 0);
  const strong = skills.filter(
    (s) => evidence.get(s.id)?.status === "review-ready",
  );
  const xp = area
    ? earned.reduce(
        (sum, s) => sum + (evidence.get(s.id)?.independentCorrect ?? 0),
        0,
      )
    : (view.evidence?.skills ?? []).reduce(
        (sum, e) => sum + e.independentCorrect,
        0,
      );
  const visible = skills
    .filter((s) => {
      const e = evidence.get(s.id);
      return (
        `${s.title} ${s.description}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "tried" && !!e?.attempts) ||
          (filter === "illuminated" && !!e?.independentCorrect) ||
          (filter === "strong" && e?.status === "review-ready"))
      );
    })
    .sort(
      (a, b) =>
        bands.indexOf(a.gradeBand) - bands.indexOf(b.gradeBand) ||
        a.title.localeCompare(b.title),
    );
  const busy = catalog.isPending || view.loading;
  const failure = catalog.error || view.error;
  const statsReady = !busy && !failure;
  return (
    <main className={styles.page}>
      {/* The app frame's bar holds the logo, the Progress tabs and the way to
          practice; whose record this is shows in the drawer. */}
      <div className={styles.heading}>
        <h1>Your inventory</h1>
        <CurriculumDetailsControl />
        {shown && view.frontier?.overall.answered ? (
          <p className={styles.level}>
            Estimated level{" "}
            <strong>{gradeName(view.frontier.overall.level)}</strong>
          </p>
        ) : shown && !view.frontier && !view.trialMode ? (
          // Holds the line's place while the estimate loads.
          <p
            className={styles.level}
            aria-hidden="true"
            style={{ visibility: "hidden" }}
          >
            Estimated level <strong>Grade 5</strong>
          </p>
        ) : null}
      </div>
      <section
        className={styles.summary}
        aria-label="Inventory totals"
        aria-busy={busy}
      >
        <div>
          <strong>
            {statsReady ? xp.toLocaleString() : "—"}
            <small> XP</small>
          </strong>
          <span>XP earned</span>
        </div>
        <div>
          <strong>{statsReady ? earned.length : "—"}</strong>
          <span>Skills illuminated</span>
        </div>
        <div>
          <strong>{statsReady ? strong.length : "—"}</strong>
          <span>Strong skills</span>
        </div>
      </section>
      <div className={styles.filters}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search your skills</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            type="search"
            aria-label="Search your skills"
            placeholder="Find a skill…"
            value={query}
            maxLength={100}
            onChange={(e) =>
              update({ topic: e.target.value || undefined }, true)
            }
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
      <div
        className={styles.filterRow}
        role="group"
        aria-label="Skills to show"
        aria-busy={!statsReady}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() =>
              update({ collection: f.id === "tried" ? undefined : f.id })
            }
          >
            {f.label}
            <span>
              {statsReady
                ? f.id === "tried"
                  ? tried.length
                  : f.id === "illuminated"
                    ? earned.length
                    : f.id === "strong"
                      ? strong.length
                      : skills.length
                : "—"}
            </span>
          </button>
        ))}
      </div>
      {failure ? (
        <section className={styles.empty} role="alert">
          <h2>Your inventory could not be loaded</h2>
          <p>Try again to see your saved progress.</p>
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
        <div className={styles.empty}>
          <Loading>Loading your skills…</Loading>
        </div>
      ) : !visible.length ? (
        <section className={styles.empty}>
          <span className={styles.emptyGem} aria-hidden="true">
            ◇
          </span>
          <h2>
            {query || area || filter === "strong" || filter === "illuminated"
              ? "No skills in this view yet"
              : "Your collection starts with a problem"}
          </h2>
          <p>
            {!view.active && view.learners.length > 1
              ? "Choose a learner from the AMP menu to see their skills."
              : tried.length
                ? "Try another filter or keep learning to build more strength."
                : "As you practice, your skills and earned illumination appear here."}
          </p>
          {/* A second parent's family's child practices from its class. */}
          {!view.viewOnly && (
            <Link
              className={buttonClass("primary")}
              to="/$"
              params={{ _splat: view.practiceHref.slice(1) }}
            >
              {view.canPractice ? "Keep learning" : "Start learning"}
            </Link>
          )}
        </section>
      ) : (
        neighborhoods.map((n, i) => {
          const rows = visible.filter((s) => neighborhood(s) === i);
          if (!rows.length) return null;
          return (
            <section className={styles.group} key={n.title}>
              <div className={styles.groupHeading}>
                <h2>{n.title}</h2>
                <span>
                  {rows.length} {rows.length === 1 ? "skill" : "skills"}
                </span>
              </div>
              <ul className={styles.list}>
                {rows.map((skill) => {
                  const e = evidence.get(skill.id),
                    score = illumination(e);
                  return (
                    <li
                      className={styles.skill}
                      key={skill.id}
                      data-strength={strength(e)}
                    >
                      <span
                        className={styles.gem}
                        data-lit={!!e?.independentCorrect}
                        aria-hidden="true"
                      >
                        {e?.status === "review-ready"
                          ? "✦"
                          : e?.independentCorrect
                            ? "◆"
                            : "◇"}
                      </span>
                      <Link
                        className={styles.skillName}
                        to="/pathways/$skillId"
                        params={{ skillId: skill.id }}
                        search={view.contextSearch}
                      >
                        <strong>{skill.title}</strong>
                        {shown && <small>{bandLabel(skill.gradeBand)}</small>}
                      </Link>
                      <div className={styles.illumination}>
                        <div>
                          <strong>
                            {score.toFixed(1)}
                            <small> / 10</small>
                          </strong>
                          <span>{e?.independentCorrect ?? 0} XP</span>
                        </div>
                        <div
                          role="meter"
                          aria-label={`${skill.title}: earned illumination`}
                          aria-valuemin={0}
                          aria-valuemax={10}
                          aria-valuenow={score}
                        >
                          <i style={{ width: `${score * 10}%` }} />
                        </div>
                      </div>
                      <div className={styles.strength}>
                        <strong>{strength(e)}</strong>
                        <small>{e?.attempts ?? 0} attempts</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
      {/* Follows the skills once they load, rather than sliding down from
          under the loading line. */}
      {!busy && (
        <details className={styles.explainer}>
          <summary>How XP, illumination and strength work</summary>
          <p>
            Each correct answer without help earns 1 XP and 0.5 illumination, up
            to 10 illumination per skill. XP keeps accumulating. Illumination
            matches your pathways map.
          </p>
          <p>
            Strength reflects recorded practice; it can change when you need
            review. Earned XP stays. Grade labels describe the skill’s
            curriculum level; your estimated level is shown separately.
          </p>
        </details>
      )}
    </main>
  );
}

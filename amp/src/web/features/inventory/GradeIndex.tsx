import { useId, useLayoutEffect, useRef, useState } from "react";
import { EntityLink } from "../../nav/links";
import { SkillKey, STANDING, StandingSwatch } from "../learners/SkillKey";
import { bandLabel, bands, type Evidence } from "../pathways/model";
import { shortBand, standingOf, type IndexSection } from "./grade-index";
import styles from "./Inventory.module.css";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Inventory by grade: one grade as a flat index, read top to bottom. The
 * row of grades (each one tap), the key to the standings, then each area's
 * heading, its skills in teaching order (each opening its skill, with
 * where the learner stands on it in the dashboard's words and swatches)
 * and under each skill its problem types, each opening its lesson.
 *
 * From 768 px everything is listed. On a phone a skill's problem types sit
 * behind its own "4 problem types" (a grade has up to 160 of them: listed
 * out, one grade ran past ten screens and the skills were lost among them).
 * On paper it is a checklist: every problem type listed, a box to tick by
 * each skill and type.
 */
export function GradeIndex({
  band,
  onBand,
  sections,
  evidence,
  searching = false,
  who,
}: {
  band: string;
  onBand: (band: string) => void;
  sections: readonly IndexSection[];
  evidence: ReadonlyMap<string, Evidence>;
  /** A search has narrowed the grade's skills. */
  searching?: boolean;
  /** Whose it is, for the printed sheet's heading: another person's name
   * (a child's); nobody's on a learner's own. */
  who?: string;
}) {
  return (
    <div data-grade-index={band}>
      <GradeRow band={band} onChange={onBand} />
      {/* Paper only: what the sheet is. */}
      <p className={styles.printHead}>
        {who ? `${who} · ` : ""}
        {bandLabel(band)} skills
      </p>
      <div className={styles.key}>
        <SkillKey label="What the words mean" />
      </div>
      {sections.length ? (
        sections.map((section) => (
          <section
            className={styles.group}
            key={section.area}
            data-index-area={section.area}
          >
            <div className={styles.groupHeading}>
              <h2>{section.title}</h2>
              <span>{plural(section.skills.length, "skill")}</span>
            </div>
            <ul className={styles.index}>
              {section.skills.map(({ skill, types }) => (
                <IndexSkill
                  key={skill.id}
                  id={skill.id}
                  title={skill.title}
                  types={types}
                  evidence={evidence.get(skill.id)}
                />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className={styles.lead}>
          {searching
            ? `No ${bandLabel(band)} skills match. Try another search or grade, or search every grade by area.`
            : `${bandLabel(band)} has no skills in this math area. Try another.`}
        </p>
      )}
    </div>
  );
}

/** One skill of the index: its name (its layer), where the learner stands
 * on it, and its problem types (their lessons). */
function IndexSkill({
  id,
  title,
  types,
  evidence,
}: {
  id: string;
  title: string;
  types: readonly { id: string; title?: string }[];
  evidence: Evidence | undefined;
}) {
  const standing = standingOf(evidence);
  const list = useId();
  // A phone's own fold; a wider screen and paper list them regardless.
  const [open, setOpen] = useState(false);
  return (
    <li className={styles.indexSkill} data-skill={id} data-standing={standing}>
      <div className={styles.indexRow}>
        <EntityLink className={styles.indexName} entity={{ kind: "skill", id }}>
          {title}
        </EntityLink>
        <span className={styles.standing}>
          <StandingSwatch standing={standing} />
          <span data-standing-word="">{STANDING[standing].term}</span>
        </span>
      </div>
      {types.length > 0 && (
        <>
          <button
            type="button"
            className={styles.typesToggle}
            aria-expanded={open}
            aria-controls={list}
            onClick={() => setOpen(!open)}
          >
            {plural(types.length, "problem type")}
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
            </svg>
          </button>
          <ul
            id={list}
            className={styles.types}
            data-open={open || undefined}
            aria-label={`${title}: problem types`}
          >
            {types.map((type) => (
              <li key={type.id}>
                <EntityLink
                  className={styles.type}
                  entity={{ kind: "lesson", id: type.id }}
                  data-type={type.id}
                >
                  {type.title ?? "Its lesson"}
                </EntityLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

/** How much of the next grade shows beside the chosen one, so the row
 * reads as one that scrolls. */
const GRADE_PEEK = 40;

/** The grades and courses, kindergarten to precalculus, each one tap. On a
 * narrow screen the row scrolls sideways, the chosen grade on view from
 * the first frame. */
function GradeRow({
  band,
  onChange,
}: {
  band: string;
  onChange: (band: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  // Before paint, and only the row's own scroll: the page never moves.
  useLayoutEffect(() => {
    const strip = row.current;
    const chosen = strip?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!strip || !chosen) return;
    const left = chosen.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft)
      strip.scrollLeft = Math.max(0, left - GRADE_PEEK);
    else if (left + chosen.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft =
        left + chosen.offsetWidth - strip.clientWidth + GRADE_PEEK;
  }, [band]);
  return (
    <div
      ref={row}
      className={`${styles.filterRow} ${styles.gradeRow}`}
      role="group"
      aria-label="Grade"
      data-grade-row=""
    >
      {bands.map((grade) => (
        <button
          key={grade}
          type="button"
          aria-pressed={band === grade}
          aria-label={bandLabel(grade)}
          data-grade={grade}
          onClick={() => onChange(grade)}
        >
          {shortBand(grade)}
        </button>
      ))}
    </div>
  );
}

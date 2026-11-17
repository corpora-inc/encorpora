import { useSheet } from "../../nav/sheet";
import { Button } from "../../ui/Button";
import { PageSection } from "../../ui/PageSection";
import { YearRibbon } from "../school/YearRibbon";
import { useSchoolYear, type YearPlace } from "./api";
import {
  caption,
  choiceOf,
  isDivision,
  periodsOf,
  yearLines,
  type Period,
} from "./model";
import { SchoolYearSheet } from "./SchoolYearSheet";
import styles from "./SchoolYear.module.css";

/** The edit sheet's name in history state (`state.sheet`). */
export const SHEET = "school-year";

/**
 * A place's school year, one section (docs/design/ia.md, "Settings"): the
 * year's name and days, the year as a bar cut into its grading periods with
 * today marked, one caption, and one Edit. Edit opens one sheet holding the
 * dates, the periods and a live bar, saved together.
 *
 * Self-contained: it reads the year, the periods and the class from the
 * Query cache and knows no route. A family's Settings and a small class's
 * Settings compose it.
 */
export function SchoolYearSection({
  org,
  classId,
  grading,
  setBy,
  title = "School year",
  titleId,
}: YearPlace & {
  /** A child or student here has report cards: the periods are shown and
   * chosen. Without, the year is one bar and its dates. */
  grading: boolean;
  /** Who sets this year when it isn't this place's to change ("Your
   * tutoring group"): shown read-only, with that said. */
  setBy?: string;
  title?: string;
  /** The heading's id, for a link's #hash (a family's `family-year`). */
  titleId?: string;
}) {
  const year = useSchoolYear({ org, classId });
  // The edit sheet is a same-address history entry (nav/sheet.ts): Back and
  // ✕ close it, and a reload keeps it open.
  const sheet = useSheet(SHEET);
  const { saved } = year;
  const canEdit = !setBy && year.canEditYear;
  if (year.readable === false) return null;
  const choice = saved ? choiceOf(saved.kind) : "year";
  const periods: Period[] =
    saved && grading && isDivision(choice)
      ? periodsOf(saved.sessions, saved.year.id, choice)
      : [];
  return (
    <PageSection
      title={title}
      titleId={titleId}
      data-school-year=""
      actions={
        // The action's room is kept while it loads and when there's none,
        // so the heading never moves.
        <span className={styles.action}>
          {canEdit && saved && (
            <Button
              variant="secondary"
              aria-label={`Edit the ${title.toLowerCase()}`}
              onClick={sheet.show}
            >
              Edit
            </Button>
          )}
        </span>
      }
    >
      <div className={styles.body} aria-busy={year.pending || undefined}>
        {year.failed ? (
          <div className={styles.failed}>
            <p role="alert">The school year didn’t load.</p>
            <Button variant="secondary" onClick={year.retry}>
              Try again
            </Button>
          </div>
        ) : saved ? (
          <>
            <p className={styles.line}>
              <strong>{yearLines(saved.year).name}</strong>
              <span>{yearLines(saved.year).days}</span>
            </p>
            <YearRibbon
              startsOn={saved.year.startsOn}
              endsOn={saved.year.endsOn}
              division={periods.length && isDivision(choice) ? choice : null}
              sessions={periods.length ? periods : undefined}
              list={false}
              labels
              today={year.today}
            />
            <p className={styles.caption}>
              {caption({
                grading,
                choice,
                periods,
                year: saved.year,
                today: year.today,
              })}
            </p>
            {setBy && (
              <p className={styles.note} data-year-set-by="">
                {setBy} sets these dates.
              </p>
            )}
          </>
        ) : (
          <div className={`${styles.skeleton} amp-skeleton`} aria-hidden="true">
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonBar} />
            <span className={styles.skeletonCaption} />
          </div>
        )}
      </div>
      {canEdit && saved && (
        <SchoolYearSheet
          place={{ org, classId }}
          grading={grading}
          open={sheet.open}
          onOpenChange={sheet.onOpenChange}
        />
      )}
    </PageSection>
  );
}

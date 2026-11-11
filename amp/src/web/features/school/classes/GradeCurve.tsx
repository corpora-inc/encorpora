import { useEffect, useMemo, useState } from "react";
import {
  curveIssues,
  curveIssueText,
  curveLetters,
  placeOdds,
  scaleCurve,
  type Allocation,
  type CurveLetter,
  type GradeCurve,
} from "../../../../schools/grade-curve";
import type {
  GradebookResponse,
  TermResource,
} from "../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../auth";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { Stepper } from "../../../ui/Stepper";
import { failureMessage, useSetCurve, type Place } from "./teacher-api";
import styles from "./GradeCurve.module.css";

/** The most columns the picture draws; a bigger class is binned. */
const COLUMNS = 60;

/** A class ranked best to worst, left to right, each place a column of its
 * letters' chances: solid where the curve is sure, blended where a boundary
 * could fall. */
export function CurvePicture({
  odds,
  label,
  tall = false,
}: {
  odds: readonly Allocation[];
  label: string;
  tall?: boolean;
}) {
  const columns = useMemo(() => {
    if (odds.length <= COLUMNS) return odds;
    const binned: Allocation[] = [];
    for (let column = 0; column < COLUMNS; column++) {
      const from = Math.floor((column * odds.length) / COLUMNS);
      const to = Math.floor(((column + 1) * odds.length) / COLUMNS);
      const sum: Allocation = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      for (let place = from; place < to; place++)
        for (const letter of curveLetters) sum[letter] += odds[place]![letter];
      for (const letter of curveLetters) sum[letter] /= Math.max(1, to - from);
      binned.push(sum);
    }
    return binned;
  }, [odds]);
  // Where each letter sits on average, for its label.
  const centres = useMemo(() => {
    let before = 0;
    return curveLetters.map((letter) => {
      const expected = odds.reduce((sum, place) => sum + place[letter], 0);
      const centre = before + expected / 2;
      before += expected;
      return {
        letter,
        expected,
        centre: odds.length ? centre / odds.length : 0,
      };
    });
  }, [odds]);
  return (
    <figure className={styles.picture} data-tall={tall || undefined}>
      <svg
        className={styles.bars}
        viewBox={`0 0 ${Math.max(1, columns.length)} 1`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        {columns.map((place, column) => {
          let y = 0;
          return curveLetters.map((letter) => {
            const height = place[letter];
            const rect =
              height > 0.001 ? (
                <rect
                  key={`${column}${letter}`}
                  x={column}
                  y={y}
                  width={1.02}
                  height={height + 0.002}
                  data-letter={letter}
                />
              ) : null;
            y += height;
            return rect;
          });
        })}
      </svg>
      <div className={styles.letters} aria-hidden="true">
        {centres.map(({ letter, expected, centre }) =>
          expected >= 0.5 ? (
            <span
              key={letter}
              data-letter={letter}
              style={{ left: `${centre * 100}%` }}
            >
              {letter}
            </span>
          ) : null,
        )}
      </div>
    </figure>
  );
}

/** Where the standard scale puts the class now, as certain columns. */
function standardOdds(standard: Allocation): Allocation[] {
  return curveLetters.flatMap((letter) =>
    Array.from({ length: standard[letter] }, () => ({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
      [letter]: 1,
    })),
  );
}
const rangeText = ([low, high]: readonly [number, number]) =>
  low === high ? `${low}` : `${low}–${high}`;

/** The curve above the gradebook: the teacher's own, or, until there is one,
 * where the standard scale puts the class. One height either way. */
export function CurveStrip({
  book,
  term,
  onEdit,
}: {
  book: GradebookResponse;
  term: TermResource;
  onEdit: (() => void) | null;
}) {
  const own = book.curve?.own ?? null;
  const size = book.students.length;
  const odds = useMemo(
    () =>
      own
        ? (placeOdds(scaleCurve(own, size).ranges, size) ?? [])
        : standardOdds(book.curve!.standard),
    [own, size, book],
  );
  const counts = useMemo(() => {
    const found: Allocation = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const place of odds)
      for (const letter of curveLetters) found[letter] += place[letter];
    return found;
  }, [odds]);
  const shown = own ? scaleCurve(own, size) : null;
  return (
    <section className={styles.strip} aria-labelledby="grade-curve">
      <div className={styles.stripHead}>
        <h2 id="grade-curve" className={styles.stripTitle}>
          {own ? "Your curve" : "Standard scale"}
        </h2>
        <p className={styles.stripLegend}>
          {curveLetters.map((letter) => (
            <span key={letter} className={styles.legendItem}>
              <i data-letter={letter} aria-hidden="true" />
              {letter}{" "}
              {shown
                ? rangeText(shown.ranges[letter])
                : Math.round(counts[letter])}
            </span>
          ))}
        </p>
        <div className={styles.stripAction}>
          {onEdit ? (
            <Button variant="secondary" onClick={onEdit}>
              {own ? "Edit curve" : "Set your curve"}
            </Button>
          ) : term.state === "closed" ? (
            <span className={styles.frozen}>Frozen with the term</span>
          ) : null}
        </div>
      </div>
      <CurvePicture
        odds={odds}
        label={
          own
            ? `Your curve for ${size} students: ${curveLetters.map((letter) => `${letter} ${rangeText(shown!.ranges[letter])}`).join(", ")}`
            : `The standard scale today: ${curveLetters.map((letter) => `${letter} ${Math.round(counts[letter])}`).join(", ")}`
        }
      />
    </section>
  );
}

const sameCurve = (a: GradeCurve | null, b: GradeCurve | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Sets the teacher's curve: for each letter, the fewest and the most students
 * they expect, checked live against the class. */
export function CurveSheet({
  open,
  onOpenChange,
  session,
  place,
  book,
  term,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AuthSession | null;
  place: Place;
  book: GradebookResponse;
  term: TermResource;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const save = useSetCurve(session, place);
  const size = book.students.length;
  const own = book.curve?.own ? scaleCurve(book.curve.own, size) : null;
  const proposed = book.curve ? scaleCurve(book.curve.proposed, size) : null;
  const start = own ?? proposed;
  const [draft, setDraft] = useState<GradeCurve | null>(start);
  // Each opening starts from what's saved, else from the class's work.
  useEffect(() => {
    if (open) setDraft(start);
    // The sheet resets when it opens, not on every refetch while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const issues = draft ? curveIssues(draft) : [];
  const odds = useMemo(
    () => (draft && !issues.length ? placeOdds(draft.ranges, size) : null),
    // `issues` follows the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, size],
  );
  if (!draft) return null;
  const lows = curveLetters.reduce((sum, l) => sum + draft.ranges[l][0], 0);
  const highs = curveLetters.reduce((sum, l) => sum + draft.ranges[l][1], 0);
  // Past the other end, a value carries it along: the fewest never exceeds
  // the most. Both steppers span the whole class, so every row lines up.
  const set = (letter: CurveLetter, end: 0 | 1, value: number) => {
    const [low, high] = draft.ranges[letter];
    setDraft({
      size,
      ranges: {
        ...draft.ranges,
        [letter]:
          end === 0
            ? [value, Math.max(high, value)]
            : [Math.min(low, value), value],
      },
    });
  };
  const write = (curve: GradeCurve | null, message: string) =>
    save.mutate(
      { term: term.id, curve },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved(message);
        },
        onError: (error) =>
          onError(
            failureMessage(
              error,
              "The curve didn’t save. Check your connection and try again.",
            ),
          ),
      },
    );
  const unchanged = sameCurve(draft, own);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Grade curve"
      description={`${term.name}, ${size} students`}
    >
      <div className={styles.editor}>
        <p className={styles.intro}>
          How many students do you expect at each letter? AMP ranks the class on
          its composite, and each place takes the letter your curve gives it.
        </p>
        <div className={styles.preview}>
          {odds ? (
            <CurvePicture
              tall
              odds={odds}
              label={`The curve for ${size} students, highest composite first`}
            />
          ) : (
            <div className={styles.previewBlank} aria-hidden="true" />
          )}
          <div className={styles.axis} aria-hidden="true">
            <span>Highest composite</span>
            <span>Lowest</span>
          </div>
        </div>
        <div
          className={styles.rows}
          role="group"
          aria-label="Students at each letter"
        >
          <div className={styles.rowHead} aria-hidden="true">
            <span />
            <span>Fewest</span>
            <span />
            <span>Most</span>
          </div>
          {curveLetters.map((letter) => {
            const [low, high] = draft.ranges[letter];
            return (
              <div key={letter} className={styles.row}>
                <span className={styles.rowLetter}>
                  <i data-letter={letter} aria-hidden="true" />
                  {letter}
                </span>
                <Stepper
                  hideLabel
                  label={`Fewest ${letter}s`}
                  value={low}
                  min={0}
                  max={size}
                  onChange={(value) => set(letter, 0, value)}
                />
                <span className={styles.to} aria-hidden="true">
                  to
                </span>
                <Stepper
                  hideLabel
                  label={`Most ${letter}s`}
                  value={high}
                  min={0}
                  max={size}
                  onChange={(value) => set(letter, 1, value)}
                />
              </div>
            );
          })}
        </div>
        <p
          className={styles.check}
          data-tone={issues.length ? "danger" : undefined}
          role="status"
        >
          {issues.length
            ? curveIssueText(issues[0]!)
            : `The fewest add to ${lows} and the most to ${highs}, so all ${size} fit.`}
        </p>
        {/* One row of three boxed actions: on a narrow sheet they wrap, and
            every row starts at the same left edge. */}
        <div className={styles.actions}>
          <Button
            variant="primary"
            disabled={!!issues.length || unchanged || save.isPending}
            aria-busy={save.isPending || undefined}
            onClick={() => write(draft, `Saved the curve for ${term.name}.`)}
          >
            Save curve
          </Button>
          {proposed && !sameCurve(draft, proposed) && (
            <Button
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setDraft(proposed)}
            >
              Start from the class’s work
            </Button>
          )}
          {own && (
            <Button
              variant="secondary"
              disabled={save.isPending}
              onClick={() =>
                write(null, `${term.name} uses the standard scale again.`)
              }
            >
              Use the standard scale
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Where the curve put one student: their place in the class and how often
 * each letter came up, as one bar. */
export function CurvePlace({
  basis,
  letters,
}: {
  basis: string;
  letters: Allocation;
}) {
  const shown = curveLetters.filter((letter) => letters[letter] >= 0.005);
  return (
    <div className={styles.place}>
      <p>{basis}</p>
      <div
        className={styles.shares}
        role="img"
        aria-label={shown
          .map((letter) => `${letter} ${Math.round(letters[letter] * 100)}%`)
          .join(", ")}
      >
        {shown.map((letter) => (
          <span
            key={letter}
            data-letter={letter}
            style={{ flexGrow: letters[letter] }}
          >
            {letters[letter] >= 0.12
              ? `${letter} ${Math.round(letters[letter] * 100)}%`
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

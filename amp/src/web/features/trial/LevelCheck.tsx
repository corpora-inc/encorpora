import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { levelRange } from "../../../learning/level-check";
import { strandNames } from "../../BirthYearPrompt";
import { gradeName } from "../../Home";
import { Link } from "@tanstack/react-router";
import { Button, buttonClass } from "../../ui/Button";
import {
  LevelAxis,
  LevelTrack,
  LevelTrend,
  levelScale,
} from "../../ui/LevelChart";
import type { TrialProgress } from "./api";
import { levelCopy as copy } from "./level-copy";
import styles from "./LevelCheck.module.css";

/** The level as the free assessment states it: best guess and range. */
export function levelWords(estimate: { level: number; sd: number }) {
  const [from, to] = levelRange(estimate);
  return {
    level: gradeName(estimate.level),
    from: gradeName(from),
    to: gradeName(to),
  };
}

/**
 * The level check between problems: the best guess with its likely range,
 * how the guess moved over the run, and each practiced area. A modal sheet
 * over practice that never moves it; Escape, a tap outside and Continue all
 * close it. It records nothing on the server and uses no problem.
 */
export function LevelCheck({
  progress,
  strands,
  age,
  open,
  onContinue,
  onMap,
  actions,
}: {
  progress: TrialProgress;
  /** Areas in display order; only those with answers are shown. */
  strands: readonly string[];
  age?: number;
  open: boolean;
  onContinue: () => void;
  /** Called as "See your full map" navigates to /try/map. */
  onMap?: () => void;
  /** Further actions after the two defaults (sharing). */
  actions?: ReactNode;
}) {
  const frontier = progress.frontier.current;
  const answered = progress.totals.answered;
  const words = levelWords(frontier.overall);
  const measured = strands.filter((strand) => frontier.strands[strand]);
  const scale = levelScale(frontier.expected, [
    frontier.overall,
    ...measured.map((strand) => frontier.strands[strand]!),
  ]);
  const trend = progress.trend;
  const first = trend[0];
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onContinue();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.sheet}
          aria-describedby="level-check-summary"
          onOpenAutoFocus={(event) => {
            // The sheet itself takes focus: its title and summary are read,
            // and Continue is the next Tab stop, without a ring on open.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            // Back to the waiting problem, not the top of the page.
            event.preventDefault();
            document
              .querySelector<HTMLElement>("#problem-prompt")
              ?.focus({ preventScroll: true });
          }}
        >
          {/* Scrolls on short screens, so it is focusable for keyboards. */}
          <div className={styles.body} tabIndex={0} aria-label={copy.title}>
            <p className={styles.eyebrow}>{copy.eyebrow(answered)}</p>
            <RadixDialog.Title className={styles.title}>
              {copy.title}
            </RadixDialog.Title>
            <div className={styles.overall}>
              <p className={styles.guess}>
                <span className={styles.guessLabel}>{copy.bestGuessLabel}</span>
                <strong>{words.level}</strong>
              </p>
              <LevelTrack
                estimate={frontier.overall}
                scale={scale}
                size="large"
              />
              <LevelAxis scale={scale} name={gradeName} />
            </div>
            <p id="level-check-summary" className={styles.summary}>
              {copy.range({ answered, from: words.from, to: words.to, age })}
              {words.from !== words.to && <> {copy.bestGuess(words.level)}</>}
            </p>
            {trend.length > 1 && first && (
              <section className={styles.block}>
                <h3 className={styles.blockTitle}>{copy.trendTitle}</h3>
                <LevelTrend
                  points={trend}
                  label={copy.trendLabel({
                    answered: trend.at(-1)!.answered,
                    from: gradeName(first.level),
                    to: words.level,
                  })}
                />
              </section>
            )}
            {measured.length > 0 && (
              <section className={styles.block}>
                <h3 className={styles.blockTitle}>{copy.areas}</h3>
                <ul className={styles.areas}>
                  {measured.map((strand) => {
                    const estimate = frontier.strands[strand]!;
                    const area = levelWords(estimate);
                    return (
                      <li
                        key={strand}
                        data-strand={strand}
                        aria-label={copy.areaLabel({
                          area: strandNames[strand] ?? strand,
                          ...area,
                        })}
                      >
                        <span className={styles.areaName} aria-hidden="true">
                          {strandNames[strand] ?? strand}
                        </span>
                        <LevelTrack estimate={estimate} scale={scale} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <p className={styles.sharpen}>{copy.sharpen}</p>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" onClick={onContinue}>
              {copy.continue}
            </Button>
            <Link
              to="/try/map"
              className={buttonClass("secondary")}
              onClick={onMap}
            >
              {copy.fullMap}
            </Link>
            {actions}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

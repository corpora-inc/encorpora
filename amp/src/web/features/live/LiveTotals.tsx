import type { LiveTotals as Totals } from "../../../schools/live/contracts";
import { Changed } from "./Changed";
import { helpCount, percentText } from "./format";
import styles from "./LiveTotals.module.css";

/**
 * The session's totals as fixed tiles, figure over label: here (of the
 * class), answering now, problems, percent correct and help used. Every
 * tile keeps its width and height whatever its figure, so the tiles never
 * move; on a phone the fifth (help used) waits for a wider screen.
 */
export function LiveTotals({
  totals,
  answeringNow,
  label = "This session",
}: {
  totals: Totals;
  /** Students answering in the last two minutes (`answeringNow`). */
  answeringNow: number;
  /** Names the tiles for assistive technology. */
  label?: string;
}) {
  const help = helpCount(totals);
  const tiles = [
    {
      key: "here",
      label: "Here",
      value: totals.present,
      of: totals.students,
      words: `${totals.present} of ${totals.students} here`,
    },
    {
      key: "answering",
      label: "Active",
      value: answeringNow,
      words: `${answeringNow} answering now`,
    },
    {
      key: "problems",
      label: "Problems",
      value: totals.problems,
      words: `${totals.problems} ${totals.problems === 1 ? "problem" : "problems"}`,
    },
    {
      key: "correct",
      label: "Correct",
      value: percentText(totals.correct, totals.problems),
      words:
        totals.problems > 0
          ? `${percentText(totals.correct, totals.problems)} correct`
          : "No answers yet",
    },
    {
      key: "help",
      label: "Help used",
      value: help,
      words: `Help used ${help} ${help === 1 ? "time" : "times"}`,
    },
  ];
  return (
    <div className={styles.frame} data-live-totals="">
      <dl className={styles.tiles} aria-label={label}>
        {tiles.map((tile) => (
          <div key={tile.key} className={styles.tile} data-tile={tile.key}>
            <dt className={styles.label}>{tile.label}</dt>
            <dd className={styles.value} aria-label={tile.words}>
              <Changed value={tile.value}>{tile.value}</Changed>
              {tile.of !== undefined && (
                <span className={styles.of}>/{tile.of}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

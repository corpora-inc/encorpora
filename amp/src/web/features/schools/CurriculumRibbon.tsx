import type { CSSProperties } from "react";
import type { CurriculumSummary } from "../../../schools/share-contracts";
import styles from "./Schools.module.css";

const CYCLE = 12;
const HEIGHT = 24;
const REACH = 7;

/** One full wave for each objective, one colour for each strand. */
function Wave({
  strands,
}: {
  strands: CurriculumSummary["levels"][number]["strands"];
}) {
  let x = 0;
  const total = strands.reduce((sum, run) => sum + run.objectives, 0);
  return (
    <svg
      className={styles.wave}
      viewBox={`0 0 ${total * CYCLE} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {strands.map((run, index) => {
        const mid = HEIGHT / 2;
        let d = `M${x} ${mid}`;
        for (let cycle = 0; cycle < run.objectives; cycle++) {
          d += ` Q${x + CYCLE / 4} ${mid - REACH * 2} ${x + CYCLE / 2} ${mid}`;
          d += ` T${x + CYCLE} ${mid}`;
          x += CYCLE;
        }
        return <path key={index} data-strand={run.strand} d={d} />;
      })}
    </svg>
  );
}

const shortLabel = (id: string, label: string) =>
  /^\d$/.test(id) ? id : id === "K" ? "K" : label;

/** The whole program as one line, counting at the left and precalculus at the
 * right. Each level's width is its share of the objectives. On a phone each
 * level takes its own line, at the same scale. */
export function CurriculumRibbon({ summary }: { summary: CurriculumSummary }) {
  const largest = Math.max(...summary.levels.map((level) => level.objectives));
  return (
    <figure className={styles.ribbonFigure}>
      <ol
        className={styles.ribbon}
        role="img"
        aria-label={`Objectives by level: ${summary.levels
          .map((level) => `${level.label}, ${level.objectives}`)
          .join("; ")}.`}
      >
        {summary.levels.map((level, index) => (
          <li
            key={level.id}
            className={styles.ribbonLevel}
            style={
              {
                "--objectives": level.objectives,
                "--share": level.objectives / largest,
                "--index": index,
              } as CSSProperties
            }
          >
            <span className={styles.ribbonWave}>
              <Wave strands={level.strands} />
            </span>
            <span className={styles.ribbonLabel} aria-hidden="true">
              <span className={styles.ribbonLabelShort}>
                {shortLabel(level.id, level.label)}
              </span>
              <span className={styles.ribbonLabelFull}>{level.label}</span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={styles.ribbonCaption}>
        One wave for each of AMP’s {summary.objectives} objectives, colored by
        strand, in order from Kindergarten through Precalculus.
      </figcaption>
    </figure>
  );
}

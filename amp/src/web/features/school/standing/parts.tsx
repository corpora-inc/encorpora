import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { StandingCurve } from "../../../../schools/standing-contracts";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { intervalWords, plain, signed } from "./format";
import styles from "./Standing.module.css";

/** "Grades behind" and "Grades ahead" under an axis. */
export function AxisEnds() {
  return (
    <div className={styles.ends} aria-hidden="true">
      <span>Grades behind their own</span>
      <span>Grades ahead</span>
    </div>
  );
}

/** The numbers a curve is read by: n, median with where it sits, mean, sd. */
export function CurveFacts({
  curve,
  label,
  children,
}: {
  curve: StandingCurve;
  label: string;
  /** More tiles, after the four. */
  children?: ReactNode;
}) {
  return (
    <StatRow label={label}>
      <StatTile
        value={curve.n.toLocaleString("en-US")}
        label={curve.n === 1 ? "student" : "students"}
      />
      <StatTile
        value={curve.median === null ? "—" : signed(curve.median)}
        label="median"
        detail={curve.middle ? `95%: ${intervalWords(curve.middle)}` : undefined}
      />
      <StatTile
        value={curve.mean === null ? "—" : signed(curve.mean)}
        label="mean"
      />
      <StatTile value={curve.sd === null ? "—" : plain(curve.sd)} label="sd" />
      {children}
    </StatRow>
  );
}

/** How many students' curves are still wide, said once and quietly. */
export function SettlingNote({
  curve,
  settleAt,
}: {
  curve: StandingCurve;
  settleAt: number;
}) {
  if (!curve.settling) return null;
  return (
    <p className={styles.settling}>
      {curve.settling === curve.n
        ? `All ${curve.n.toLocaleString("en-US")}`
        : `${curve.settling.toLocaleString("en-US")} of ${curve.n.toLocaleString("en-US")}`}{" "}
      have fewer than {settleAt} answers, so their curves are still wide.
    </p>
  );
}

/** The chart's numbers as a table, closed until asked for. */
export function TableDisclosure({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.disclosure}>
      <summary>Show as a table</summary>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}

/** Behind, within and ahead as rows of a table: each student's curve counted
 * where its mass falls. */
export function ShareRows({ curve }: { curve: StandingCurve }) {
  const share = (value: number) =>
    curve.n ? `${Math.round((value / curve.n) * 100)}%` : "—";
  return (
    <>
      <tr>
        <th scope="row">More than half a grade behind</th>
        <td>{plain(curve.behind)}</td>
        <td>{share(curve.behind)}</td>
      </tr>
      <tr>
        <th scope="row">Within half a grade</th>
        <td>{plain(curve.within)}</td>
        <td>{share(curve.within)}</td>
      </tr>
      <tr>
        <th scope="row">More than half a grade ahead</th>
        <td>{plain(curve.ahead)}</td>
        <td>{share(curve.ahead)}</td>
      </tr>
    </>
  );
}

/** Up one level of the drill. */
export function UpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to="/$" params={{ _splat: to }} className={styles.up}>
      <span aria-hidden="true">‹</span> {children}
    </Link>
  );
}

/** One sentence for a screen reader, the same facts the chart shows. */
export const curveSentence = (curve: StandingCurve) =>
  curve.median === null
    ? "No students yet."
    : `${curve.n} students. Median ${signed(curve.median)} grades from their own${
        curve.middle ? `, 95% range ${intervalWords(curve.middle)}` : ""
      }; mean ${signed(curve.mean!)}, sd ${plain(curve.sd!)}. About ${Math.round(
        (curve.within / Math.max(1, curve.n)) * 100,
      )}% within half a grade of their own. The table under the chart has the numbers.`;

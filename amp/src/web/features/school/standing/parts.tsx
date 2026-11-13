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
      <span>Grades behind</span>
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
        detail={
          curve.middle ? `95%: ${intervalWords(curve.middle)}` : undefined
        }
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

/** Up one level of the drill. */
export function UpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to="/$" params={{ _splat: to }} className={styles.up}>
      <span aria-hidden="true">‹</span> {children}
    </Link>
  );
}

/** The chart in words, for a screen reader: every fact it shows, and with
 * `settleAt`, how many of its students are still settling. */
export const curveSentence = (curve: StandingCurve, settleAt?: number) => {
  if (curve.median === null) return "No students yet.";
  const share = (value: number) =>
    `${Math.round((value / Math.max(1, curve.n)) * 100)}%`;
  return `${curve.n} students. Median ${signed(curve.median)} grades from their own${
    curve.middle ? `, 95% range ${intervalWords(curve.middle)}` : ""
  }; mean ${signed(curve.mean!)}, sd ${plain(curve.sd!)}. About ${share(curve.within)} within half a grade of their own, ${share(curve.behind)} more than half a grade behind and ${share(curve.ahead)} more than half a grade ahead.${
    settleAt && curve.settling
      ? ` ${curve.settling} with fewer than ${settleAt} answers.`
      : ""
  }`;
};

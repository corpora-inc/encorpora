import { Link, useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { closeTo } from "../../../lib/return-to";
import { Button, buttonClass } from "../../../ui/Button";
import { appReturn } from "../../spaces/returns";
import styles from "./Setup.module.css";

/** One step of a first run (docs/design/ia.md): where it sits in the setup,
 * its title, its content, and Back and the step's action at the foot. The
 * reason the action waits keeps its line beneath it, so nothing moves. A
 * setup of one step shows no progress: there is nowhere else to be. */
export function StepFrame({
  steps,
  index,
  title,
  titleId,
  lede,
  children,
  next,
  hint = "",
  hintLines = 1,
  back,
}: {
  steps: readonly { id: string; label: string }[];
  index: number;
  title: string;
  titleId?: string;
  lede?: ReactNode;
  children: ReactNode;
  next?: ReactNode;
  hint?: string;
  /** Lines the reason keeps from the start, so a longer one moves nothing. */
  hintLines?: 1 | 2;
  back: string;
}) {
  // Adding a place from elsewhere (`?from=`): every step can give up and go
  // back there (docs/architecture/spaces.md, "Returns").
  const router = useRouter();
  const from = appReturn(
    useLocation({
      select: (location) => (location.search as Record<string, unknown>).from,
    }),
  );
  return (
    <main className={styles.page}>
      {steps.length > 1 && (
        <nav className={styles.progress} aria-label="Setup">
          <p className={styles.count}>
            Step {index + 1} of {steps.length}
          </p>
          <ol>
            {steps.map((entry, at) => (
              <li
                key={entry.id}
                data-state={at < index ? "done" : at === index ? "now" : "next"}
                aria-current={at === index ? "step" : undefined}
              >
                <span className={styles.bar} aria-hidden="true" />
                <span className={styles.stepName}>{entry.label}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1 id={titleId} className={styles.title}>
        {title}
      </h1>
      {lede && <p className={styles.lede}>{lede}</p>}
      <div className={styles.body}>{children}</div>
      <div className={styles.foot}>
        <div className={styles.actions}>
          <Link
            to={back.split("?")[0] as never}
            // The query apart from the path, so `from` stays a search key.
            search={
              Object.fromEntries(
                new URLSearchParams(back.split("?")[1] ?? ""),
              ) as never
            }
            className={buttonClass("quiet")}
          >
            Back
          </Link>
          {from && (
            <Button variant="quiet" onClick={() => closeTo(router, from)}>
              Cancel
            </Button>
          )}
          {next}
        </div>
        <p
          className={styles.hint}
          data-lines={hintLines === 2 ? 2 : undefined}
          aria-live="polite"
        >
          {hint}
        </p>
      </div>
    </main>
  );
}

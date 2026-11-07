import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import type {
  ScopeAndSequence,
  ScopeLevel,
} from "../../../schools/share-contracts";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { SCOPE_CSV, SCOPE_PDF } from "./api";
import { PublicFrame } from "./PublicFrame";
import styles from "./Scope.module.css";

const count = (value: number) => value.toLocaleString("en-US");
const plural = (value: number, one: string) =>
  `${count(value)} ${one}${value === 1 ? "" : "s"}`;
const anchor = (level: ScopeLevel) => `level-${level.id}`;

function Downloads() {
  return (
    <div className={styles.downloads}>
      <a
        href={SCOPE_PDF}
        className={buttonClass("primary", styles.download)}
        download
      >
        Download PDF
      </a>
      <a
        href={SCOPE_CSV}
        className={buttonClass("secondary", styles.download)}
        download
      >
        Download CSV
      </a>
    </div>
  );
}

function Summary({ scope }: { scope: ScopeAndSequence }) {
  return (
    <table className={styles.summary}>
      <caption className={styles.hidden}>
        Objectives and problem types by level
      </caption>
      <thead>
        <tr>
          <th scope="col">Level</th>
          <th scope="col">Objectives</th>
          <th scope="col">Problem types</th>
        </tr>
      </thead>
      <tbody>
        {scope.levels.map((level) => (
          <tr key={level.id}>
            <th scope="row">
              <a href={`#${anchor(level)}`}>{level.label}</a>
            </th>
            <td>{count(level.objectives)}</td>
            <td>{count(level.problemTypes)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">All levels</th>
          <td>{count(scope.objectives)}</td>
          <td>{count(scope.problemTypes)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Level({ level }: { level: ScopeLevel }) {
  return (
    <section
      id={anchor(level)}
      className={styles.level}
      aria-labelledby={`${anchor(level)}-title`}
    >
      <div className={styles.levelHead}>
        <h2 id={`${anchor(level)}-title`}>{level.label}</h2>
        <p>
          {plural(level.objectives, "objective")},{" "}
          {plural(level.problemTypes, "problem type")}
        </p>
      </div>
      {/* The roles stay when a phone lays these rows out as blocks. */}
      <table className={styles.objectives} role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Objective
            </th>
            <th scope="col" role="columnheader">
              Strand
            </th>
            <th scope="col" role="columnheader">
              Standards
            </th>
            <th scope="col" role="columnheader">
              Prerequisites
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {level.rows.map((row) => (
            <tr key={row.id} data-strand={row.strand} role="row">
              <th scope="row" role="rowheader">
                {row.title}
              </th>
              <td data-label="Strand" role="cell">
                <span className={styles.strand}>
                  <span className={styles.strandDot} aria-hidden="true" />
                  {row.strandLabel}
                </span>
              </td>
              <td
                role="cell"
                data-label="Standards"
                data-empty={!row.standards.length || undefined}
              >
                {row.standards.join(", ")}
              </td>
              <td
                role="cell"
                data-label="Prerequisites"
                data-empty={!row.prerequisites.length || undefined}
              >
                {row.prerequisites.join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** `/schools/scope-and-sequence`: the curriculum document, from the live
 * catalog. The page, the PDF and the CSV come from the same build. */
export function ScopeScreen() {
  const scope = useLoaderData({ from: "/schools/scope-and-sequence" });
  const router = useRouter();
  // A shared link to one level: the rows are here now, so go there.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView();
  }, []);
  return (
    <PublicFrame>
      <main className={styles.main}>
        {!scope ? (
          <div className={styles.failed}>
            <EmptyState
              title="The scope and sequence didn’t load"
              action={
                <Button
                  variant="primary"
                  onClick={() => void router.invalidate()}
                >
                  Try again
                </Button>
              }
            >
              Check your connection, then try again.
            </EmptyState>
          </div>
        ) : (
          <>
            <section className={styles.intro} aria-labelledby="scope-title">
              <div className={styles.introText}>
                <h1 id="scope-title" className={styles.title}>
                  Scope and sequence
                </h1>
                <p className={styles.lead}>{scope.lead}</p>
                <Downloads />
                <ul className={styles.points}>
                  {scope.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <Summary scope={scope} />
            </section>
            {scope.levels.map((level) => (
              <Level key={level.id} level={level} />
            ))}
            <div className={styles.end}>
              <Downloads />
            </div>
          </>
        )}
      </main>
    </PublicFrame>
  );
}

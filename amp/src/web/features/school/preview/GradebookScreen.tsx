import { useMemo, useRef, useState } from "react";
import { MathText } from "../../../MathText";
import { Avatar } from "../../../ui/Avatar";
import { Badge, type BadgeTone } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { Meter } from "../../../ui/Meter";
import { Segmented } from "../../../ui/Segmented";
import { Sheet } from "../../../ui/Sheet";
import { Stepper } from "../../../ui/Stepper";
import { Toast } from "../../../ui/Toast";
import {
  classInfo,
  closedFinal,
  componentsFor,
  evidenceFor,
  studentById,
  students,
  suggestionFor,
  terms,
  type Components,
  type ProblemResult,
  type Student,
  type Term,
  type TermId,
} from "./fixture";
import { PreviewFrame } from "./PreviewFrame";
import { usePreviewSearch } from "./search";
import { usePreview } from "./store";
import styles from "./Preview.module.css";

const componentNames: { id: keyof Components; label: string }[] = [
  { id: "course", label: "Course progress" },
  { id: "growth", label: "Growth" },
  { id: "practice", label: "Practice" },
  { id: "retention", label: "Retention" },
];
const results: Record<ProblemResult, { label: string; tone: BadgeTone }> = {
  correct: { label: "Correct", tone: "success" },
  hint: { label: "With a hint", tone: "info" },
  missed: { label: "Missed", tone: "danger" },
};

function Suggested({ student, term }: { student: Student; term: TermId }) {
  const target = usePreview((state) => state.target);
  const suggestion = suggestionFor(student, target, term);
  if (!suggestion)
    return <span className={styles.notEnough}>Not enough work yet</span>;
  return (
    <span className={styles.suggested}>
      <strong>{suggestion.letters}</strong>, {suggestion.percent}
    </span>
  );
}

function FinalField({ student, term }: { student: Student; term: Term }) {
  const value = usePreview((state) => state.finals[student.id] ?? "");
  const setFinal = usePreview((state) => state.setFinal);
  if (term.state === "closed")
    return (
      <span className={styles.finalFrozen}>{closedFinal(student) || "—"}</span>
    );
  return (
    <input
      className={styles.finalInput}
      type="text"
      value={value}
      maxLength={8}
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      aria-label={`Final grade for ${student.name}`}
      onChange={(event) => setFinal(student.id, event.target.value)}
    />
  );
}

function ComponentMeter({
  student,
  term,
  id,
  label,
}: {
  student: Student;
  term: TermId;
  id: keyof Components;
  label: string;
}) {
  const target = usePreview((state) => state.target);
  if (student.notEnoughWork)
    return (
      <span className={styles.noScore} aria-label={`${label}: not yet`}>
        —
      </span>
    );
  return (
    <Meter
      value={componentsFor(student, target, term)[id]}
      label={`${label} for ${student.name}`}
    />
  );
}

function Evidence({ student, term }: { student: Student; term: Term }) {
  const target = usePreview((state) => state.target);
  const evidence = evidenceFor(student, target, term.id);
  return (
    <div className={styles.evidence}>
      <div className={styles.verdict}>
        <div className={styles.verdictPart}>
          <div className={styles.fieldLabel}>Suggested</div>
          <div className={styles.verdictValue}>
            <Suggested student={student} term={term.id} />
          </div>
        </div>
        <div className={styles.verdictFinal}>
          <div className={styles.fieldLabel} aria-hidden="true">
            Final
          </div>
          <FinalField student={student} term={term} />
        </div>
      </div>
      <section>
        <h3>Why this range</h3>
        <dl className={styles.lines}>
          {evidence.lines.map((line) => (
            <div key={line.label} className={styles.line}>
              <dt>{line.label}</dt>
              <dd className={styles.lineMeter}>
                {line.value === null ? (
                  <span className={styles.noScore}>—</span>
                ) : (
                  <Meter value={line.value} label={line.label} />
                )}
              </dd>
              <dd className={styles.lineText}>{line.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Objectives gained</h3>
        <ul className={styles.objectives}>
          {evidence.objectives.map((objective) => (
            <li key={objective.text} data-strand={objective.strand}>
              <span className={styles.when}>{objective.date}</span>
              <span className={styles.strandDot} aria-hidden="true" />
              <span>{objective.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Problems</h3>
        <ul className={styles.problems}>
          {evidence.problems.map((problem) => (
            <li key={problem.prompt}>
              <span className={styles.when}>{problem.date}</span>
              <span className={styles.problem}>
                <span className={styles.prompt}>
                  <MathText text={problem.prompt} />
                </span>
                <span className={styles.answered}>
                  Answered <MathText text={problem.answer} />
                </span>
              </span>
              <Badge tone={results[problem.result].tone}>
                {results[problem.result].label}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Downloads the term as one column to blend with the rest of the grade. */
function exportCsv(term: Term, target: number) {
  const finals = usePreview.getState().finals;
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const lines = [
    ["Student", "Suggested", "Percent", "Final"].map(quote).join(","),
    ...students.map((student) => {
      const suggestion = suggestionFor(student, target, term.id);
      return [
        student.name,
        suggestion?.letters ?? "Not enough work yet",
        suggestion?.percent ?? "",
        term.state === "closed"
          ? closedFinal(student)
          : (finals[student.id] ?? ""),
      ]
        .map(quote)
        .join(",");
    }),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/csv" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `grade-5-math-${term.name.toLowerCase().replace(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** A class's term: a suggested range and four components per student, and a
 * final grade the teacher decides. Every row opens to its evidence. */
export function GradebookScreen() {
  const [search, set] = usePreviewSearch();
  const target = usePreview((state) => state.target);
  const setTarget = usePreview((state) => state.setTarget);
  const entered = usePreview(
    (state) => students.filter((s) => state.finals[s.id]?.trim()).length,
  );
  const [message, setMessage] = useState("");
  const term = terms.find((entry) => entry.id === search.term)!;
  const open = studentById(search.student);
  const openStudent = (student: Student) => set({ student: student.id });
  // Who the sheet showed last, once the URL has already moved on.
  const lastOpen = useRef(search.student);
  if (search.student) lastOpen.current = search.student;
  const columns = useMemo<DataGridColumn<Student>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: 150,
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
        cell: (student) => (
          <button
            type="button"
            className={styles.student}
            data-student={student.id}
            onClick={() => openStudent(student)}
          >
            <Avatar name={student.name} size="small" />
            <span>{student.name}</span>
          </button>
        ),
      },
      {
        id: "suggested",
        header: "Suggested",
        width: 140,
        firstSort: "descending",
        compare: (a, b) =>
          (suggestionFor(a, usePreview.getState().target, term.id)?.low ?? -1) -
          (suggestionFor(b, usePreview.getState().target, term.id)?.low ?? -1),
        cell: (student) => <Suggested student={student} term={term.id} />,
      },
      ...componentNames.map(({ id, label }): DataGridColumn<Student> => ({
        id,
        header: label,
        width: 85,
        firstSort: "descending",
        compare: (a, b) => {
          const at = usePreview.getState().target;
          return (
            componentsFor(a, at, term.id)[id] -
            componentsFor(b, at, term.id)[id]
          );
        },
        cell: (student) => (
          <ComponentMeter
            student={student}
            term={term.id}
            id={id}
            label={label}
          />
        ),
      })),
      {
        id: "final",
        header: "Final",
        width: 90,
        cell: (student) => <FinalField student={student} term={term} />,
      },
    ],
    [term.id],
  );
  const card = (student: Student) => (
    <div className={styles.gradeCard}>
      <div className={styles.gradeCardTop}>
        <button
          type="button"
          className={styles.student}
          data-student={student.id}
          onClick={() => openStudent(student)}
        >
          <Avatar name={student.name} size="small" />
          <span>{student.name}</span>
        </button>
        <div className={styles.gradeCardFinal}>
          <span aria-hidden="true">Final</span>
          <FinalField student={student} term={term} />
        </div>
      </div>
      <div className={styles.gradeCardSuggested}>
        <Suggested student={student} term={term.id} />
      </div>
      {!student.notEnoughWork && (
        <dl className={styles.gradeCardMeters}>
          {componentNames.map(({ id, label }) => (
            <div key={id}>
              <dt>{label}</dt>
              <dd>
                <ComponentMeter
                  student={student}
                  term={term.id}
                  id={id}
                  label={label}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
  return (
    <PreviewFrame tab="gradebook">
      <div className={styles.gradePage}>
        <div className={styles.gradeHead}>
          <div className={styles.gradeTitle}>
            <h1>{term.name} grades</h1>
            <p>{term.dates}</p>
          </div>
          <div className={styles.gradeControls}>
            <div className={styles.term}>
              <Segmented<TermId>
                compact
                dense
                label="Term"
                value={term.id}
                options={terms.map((entry) => ({
                  value: entry.id,
                  label: entry.label,
                }))}
                onChange={(value) => set({ term: value })}
              />
            </div>
            {/* A term with nothing to export holds the space, so the switcher
                never moves between terms. */}
            <div
              className={styles.export}
              style={{
                visibility: term.state === "upcoming" ? "hidden" : undefined,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  exportCsv(term, target);
                  setMessage(`${term.name} exported as a CSV.`);
                }}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
        {term.state === "upcoming" ? (
          <EmptyState title={`${term.name} starts ${term.starts}`}>
            Suggested ranges appear here once students have work in this term.
          </EmptyState>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.toolbarMain}>
                {term.state === "open" ? (
                  <Stepper
                    label="Weekly target"
                    value={target}
                    min={15}
                    max={180}
                    step={15}
                    format={(minutes) => `${minutes} min`}
                    onChange={setTarget}
                  />
                ) : (
                  <Badge>Closed</Badge>
                )}
              </div>
              <span className={styles.count}>
                {term.state === "open"
                  ? `${entered} of ${students.length} final grades entered`
                  : "Grades in a closed term are frozen."}
              </span>
            </div>
            <DataGrid
              label={`${term.name} grades`}
              columns={columns}
              rows={students}
              rowKey={(student) => student.id}
              sort={
                search.sort ?? { column: "student", direction: "ascending" }
              }
              onSortChange={(next) =>
                set(
                  { sort: `${next.column}:${next.direction}` },
                  { replace: true },
                )
              }
              onRowActivate={openStudent}
              rowHeight={52}
              rules={false}
              cardEstimate={200}
              card={card}
            />
          </>
        )}
      </div>
      <Sheet
        open={!!open}
        onOpenChange={(next) => {
          if (!next) set({ student: undefined });
        }}
        title={open?.name ?? ""}
        description={`${classInfo.name}, ${term.name}`}
        lead={open ? <Avatar name={open.name} size="large" /> : undefined}
        returnFocus={() =>
          document.querySelector<HTMLElement>(
            `[data-student="${lastOpen.current}"]`,
          )
        }
      >
        {open && <Evidence student={open} term={term} />}
      </Sheet>
      <Toast tone="status" message={message} onDismiss={() => setMessage("")} />
    </PreviewFrame>
  );
}

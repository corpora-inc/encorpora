import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { create } from "zustand";
import {
  ROSTER_CHUNK,
  type ApplyResult,
  type PlanResult,
  type RosterSource,
} from "../../../schools/setup-contracts";
import {
  csvRows,
  fieldKeys,
  fieldLabels,
  guessMapping,
  mappingHasName,
  distinctNamedId,
  namedStudentId,
  readTable,
  type FieldKey,
  type Mapping,
  type Table,
} from "../../../schools/sources/csv";
import {
  rosterRowSchema,
  splitName,
  type RosterIssue,
  type RosterRow,
  type SourceResult,
} from "../../../schools/sources/rows";
import type { OneRosterFiles } from "../../../schools/sources/oneroster";
import type { RosterSheet } from "../../../schools/sources/excel";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Badge, type BadgeTone } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../ui/DataGrid";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { StatRow, StatTile } from "../../ui/StatTile";
import { TextField } from "../../ui/TextField";
import {
  classesOptions,
  currentSession,
  licenseOptions,
  orgOptions,
  refreshSchool,
  school,
} from "./api";
import { OrgFrame } from "./OrgFrame";
import { ClassFrame } from "./classes/ClassFrame";
import { useFlash } from "./classes/flash";
import type { ReactNode } from "react";
import { GradePicker, PageHead, gradeLabel } from "./parts";
import { classPath, orgPath } from "./paths";
import styles from "./Import.module.css";

type Draft = {
  orgId: string;
  classId?: string;
  fileName: string;
  source: RosterSource;
  table?: Table;
  mapping?: Mapping;
  /** Null until the person types: then the class screen's own default. */
  fallbackClass: string | null;
  files?: OneRosterFiles;
  schools?: { sourcedId: string; name: string }[];
  schoolId?: string;
  result?: SourceResult;
  /** What the dry run said, by line. */
  plan: Map<number, PlanResult>;
  resolutions: Record<string, "same" | "new">;
  applied?: ApplyResult[];
  invited?: number;
};
/** Memory only: a roster file is children's names, and never rests on a device. */
const useImport = create<{
  draft: Draft | null;
  set: (draft: Draft | null) => void;
  patch: (change: Partial<Draft>) => void;
}>((set) => ({
  draft: null,
  set: (draft) => set({ draft }),
  patch: (change) =>
    set((state) => ({
      draft: state.draft ? { ...state.draft, ...change } : null,
    })),
}));

type Step = "source" | "map" | "review" | "done";
const STEPS: readonly Step[] = ["source", "map", "review", "done"];

const failureText = (failure: unknown, fallback: string) =>
  failure instanceof AppError ? failure.message : fallback;
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
const fullName = (row: { givenName?: string; familyName?: string }) =>
  [row.givenName, row.familyName].filter(Boolean).join(" ");

/* Step one: anything a school might have. */
function SourceStep({
  orgId,
  classScope,
  checking,
  onLoaded,
}: {
  orgId: string;
  /** A teacher adding students to their class: names, Excel or CSV. */
  classScope: boolean;
  /** The rows are being checked against the roster. */
  checking: boolean;
  onLoaded: (draft: Draft) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workbook, setWorkbook] = useState<{
    fileName: string;
    sheets: RosterSheet[];
  } | null>(null);
  const [sheetName, setSheetName] = useState("");
  useLoggedError(error);
  const fromTable = (table: Table, fileName: string) => {
    if (!table.rows.length) {
      setError(
        "That has no rows to read. Check that it’s the roster, with one student per row.",
      );
      return;
    }
    onLoaded({
      orgId,
      fileName,
      source: "csv",
      table,
      mapping: guessMapping(table),
      fallbackClass: null,
      plan: new Map(),
      resolutions: {},
    });
  };
  const fromText = (text: string, fileName: string) =>
    fromTable(readTable(text), fileName);
  const readFile = async (file: File) => {
    setBusy(true);
    setError("");
    setWorkbook(null);
    try {
      if (file.size > 10 * 1024 * 1024) {
        setError("Choose a roster file smaller than 10 MB.");
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.xlsx$/i.test(file.name)) {
        const { readExcelRoster } =
          await import("../../../schools/sources/excel");
        const sheets = await readExcelRoster(bytes);
        if (!sheets.length) setError("That workbook has no roster rows.");
        else if (sheets.length === 1) fromTable(sheets[0]!.table, file.name);
        else {
          setWorkbook({ fileName: file.name, sheets });
          setSheetName(sheets[0]!.name);
        }
        return;
      }
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
        const { isOneRoster, oneRosterSchools, readOneRosterZip } =
          await import("../../../schools/sources/oneroster");
        const files = readOneRosterZip(bytes);
        if (!isOneRoster(files)) {
          setError(
            "That ZIP isn’t a OneRoster export: it needs users.csv, classes.csv and enrollments.csv. A spreadsheet saved as CSV also works.",
          );
          return;
        }
        const schools = oneRosterSchools(files);
        onLoaded({
          orgId,
          fileName: file.name,
          source: "oneroster",
          files,
          schools,
          schoolId: schools.length === 1 ? schools[0]!.sourcedId : undefined,
          fallbackClass: null,
          plan: new Map(),
          resolutions: {},
        });
        return;
      }
      const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
      const text = new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(bytes);
      if (text.startsWith("{") || /\u0000/.test(text.slice(0, 500))) {
        setError(
          "That file can’t be read as a roster. In your spreadsheet, choose Save As, then CSV.",
        );
        return;
      }
      fromText(text, file.name);
    } catch (failure) {
      console.error("Roster file could not be read", failure);
      setError("That file can’t be read. Try Excel or CSV, or paste the rows.");
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };
  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  };
  return (
    <div className={styles.source}>
      <div
        className={styles.drop}
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className={styles.dropMark}>
          <path d="M14 6h15l9 9v27H14V6Zm15 0v9h9M20 26h12M20 32h12M20 20h4" />
        </svg>
        {workbook ? (
          <>
            <h2>{workbook.fileName}</h2>
            <p>{plural(workbook.sheets.length, "sheet")}</p>
          </>
        ) : (
          <>
            <h2>Drop your roster here</h2>
            <p>{classScope ? "Excel or CSV" : "Excel, CSV or OneRoster"}</p>
          </>
        )}
        <input
          ref={fileInput}
          className={styles.fileInput}
          type="file"
          tabIndex={-1}
          aria-label="Choose a roster file"
          accept=".xlsx,.csv,.tsv,.txt,.zip,text/csv,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onPick}
        />
        <Button
          variant={workbook ? "secondary" : "primary"}
          aria-busy={busy}
          disabled={busy || checking}
          onClick={() => fileInput.current?.click()}
        >
          {workbook ? "Choose another file" : "Choose a file"}
        </Button>
      </div>
      {workbook && (
        <div className={styles.paste}>
          <span className={styles.pasteLabel} aria-hidden="true">
            Sheet
          </span>
          <Select
            aria-label="Sheet"
            value={sheetName}
            onValueChange={setSheetName}
          >
            {workbook.sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} ·{" "}
                {plural(
                  sheet.table.rows.length,
                  classScope ? "student" : "row",
                )}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            className={styles.pasteAction}
            aria-busy={checking}
            disabled={checking}
            onClick={() => {
              const selected = workbook.sheets.find(
                (sheet) => sheet.name === sheetName,
              );
              if (selected)
                fromTable(
                  selected.table,
                  `${workbook.fileName} · ${selected.name}`,
                );
            }}
          >
            Use this sheet
          </Button>
        </div>
      )}
      {!workbook && (
        <div className={styles.paste}>
          <label className={styles.pasteLabel} htmlFor="roster-paste">
            {classScope ? "Or paste names" : "Or paste from a spreadsheet"}
          </label>
          <textarea
            id="roster-paste"
            className={styles.pasteBox}
            rows={7}
            value={paste}
            placeholder={
              classScope
                ? "Ana Ruiz\nNoor Haddad\nKai Varga"
                : "Name\tGrade\tClass\nAna Ruiz\t5\tPeriod 1\nNoor Haddad\t5\tPeriod 1"
            }
            onChange={(event) => setPaste(event.target.value)}
          />
          <Button
            variant="secondary"
            className={styles.pasteAction}
            aria-busy={checking && !workbook}
            disabled={!paste.trim() || checking}
            onClick={() => fromText(paste, "Pasted rows")}
          >
            {classScope ? "Add these names" : "Use these rows"}
          </Button>
        </div>
      )}
      <p className={styles.error} role={error ? "alert" : undefined}>
        {error}
      </p>
      {!classScope && (
        <p className={styles.footnote}>
          Nothing is saved until you’ve seen every change and chosen Apply.
        </p>
      )}
    </div>
  );
}

/* Step two: what each column is. */
function MapStep({
  draft,
  defaultClass,
  onBack,
  onContinue,
}: {
  draft: Draft;
  defaultClass: string;
  onBack: () => void;
  onContinue: () => Promise<void>;
}) {
  const patch = useImport((state) => state.patch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const go = () => {
    setBusy(true);
    setError("");
    void onContinue()
      .catch((failure) =>
        setError(failureText(failure, "The check didn’t finish. Try again.")),
      )
      .finally(() => setBusy(false));
  };
  if (draft.source === "oneroster") {
    const schools = draft.schools ?? [];
    return (
      <div className={styles.map}>
        <p className={styles.mapLead}>
          {draft.fileName} is a OneRoster export, so its columns are already
          known.
        </p>
        {schools.length > 1 && (
          <div className={styles.schoolPick}>
            <span className={styles.fieldLabel}>
              This file covers {schools.length} schools. Which is this one?
            </span>
            <Select
              aria-label="School in this file"
              value={draft.schoolId ?? ""}
              onValueChange={(schoolId) => patch({ schoolId })}
            >
              <option value="">Choose a school</option>
              {schools.map((entry) => (
                <option key={entry.sourcedId} value={entry.sourcedId}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <p className={styles.error} role={error ? "alert" : undefined}>
          {error}
        </p>
        <div className={styles.actions}>
          <Button variant="quiet" align="start" onClick={onBack}>
            Back
          </Button>
          <Button
            variant="primary"
            aria-busy={busy}
            disabled={busy || (schools.length > 1 && !draft.schoolId)}
            onClick={go}
          >
            Check for changes
          </Button>
        </div>
      </div>
    );
  }
  const table = draft.table!;
  const mapping = draft.mapping!;
  const named = mappingHasName(mapping);
  const hasClass = Object.values(mapping).includes("class");
  const setField = (index: number, field: FieldKey) => {
    const next: Mapping = { ...mapping };
    // A field belongs to one column: choosing it here releases the other.
    if (field !== "ignore")
      for (const [other, value] of Object.entries(next))
        if (value === field) next[Number(other)] = "ignore";
    next[index] = field;
    patch({ mapping: next });
  };
  const sample = (index: number) =>
    table.rows
      .map((row) => row[index]?.trim())
      .filter(Boolean)
      .slice(0, 3);
  return (
    <div className={styles.map}>
      <p className={styles.mapLead}>
        {plural(table.rows.length, "row")} in {draft.fileName}. Check what each
        column holds.
      </p>
      <ul className={styles.columns}>
        {table.headers.map((header, index) => (
          <li
            key={index}
            data-ignored={mapping[index] === "ignore" || undefined}
          >
            <div className={styles.columnSource}>
              <strong>{header}</strong>
              <span>{sample(index).join(", ") || "Empty"}</span>
            </div>
            <Select
              aria-label={`What ${header} holds`}
              value={mapping[index] ?? "ignore"}
              onValueChange={(field) => setField(index, field as FieldKey)}
            >
              {fieldKeys.map((field) => (
                <option key={field} value={field}>
                  {fieldLabels[field]}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      {!hasClass && !draft.classId && (
        <div className={styles.fallback}>
          <TextField
            label="This file has no class column. Put everyone in"
            placeholder="Class name"
            maxLength={100}
            value={draft.fallbackClass ?? defaultClass}
            onChange={(event) => patch({ fallbackClass: event.target.value })}
          />
        </div>
      )}
      <p className={styles.error} role={!named || error ? "alert" : undefined}>
        {!named
          ? "Choose which column holds student names to continue."
          : error}
      </p>
      <div className={styles.actions}>
        <Button variant="quiet" align="start" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          aria-busy={busy}
          disabled={busy || !named}
          onClick={go}
        >
          Check for changes
        </Button>
      </div>
    </div>
  );
}

/* Step three: the dry run. */
type Bucket = "new" | "changed" | "unchanged" | "attention";
const bucketOf = (plan: PlanResult | undefined): Bucket =>
  !plan
    ? "attention"
    : plan.status === "held"
      ? "attention"
      : plan.status === "new"
        ? "new"
        : plan.status === "changed"
          ? "changed"
          : "unchanged";
const bucketLabels: Record<Bucket, [string, BadgeTone]> = {
  new: ["New", "info"],
  changed: ["Updated", "neutral"],
  unchanged: ["No change", "neutral"],
  attention: ["Needs attention", "warning"],
};

const issueText: Record<RosterIssue["code"], (value: string) => string> = {
  missing_name: () => "No name on this row.",
  source_conflict: (value) =>
    `${value} Correct the OneRoster export and import again.`,
  unsupported_role: (value) => `Skipped: ${value}`,
  name_too_long: (value) => `“${value.slice(0, 40)}…” is too long for a name.`,
  unknown_grade: (value) => `“${value}” isn’t a grade AMP knows.`,
  invalid_email: (value) => `“${value}” isn’t an email address.`,
  conflicting_identity: (value) => `Student ID ${value} has two names.`,
  ambiguous_identity: () =>
    "Two students share this name. Add a Student ID to each.",
};

function FixMissingName({
  issue,
  onFix,
  onSkip,
}: {
  issue: RosterIssue;
  onFix: (row: RosterRow) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className={styles.fixInline}
      onSubmit={(event) => {
        event.preventDefault();
        const typed = name.trim();
        if (!typed) return;
        const parts = splitName(typed);
        const sourcedId =
          issue.row.sourcedId ||
          namedStudentId(
            parts.givenName,
            parts.familyName,
            issue.row.classes[0]?.name,
          );
        onFix(
          rosterRowSchema.parse({
            ...issue.row,
            ...parts,
            sourcedId,
          }),
        );
      }}
    >
      <TextField
        label={`Name for row ${issue.line}`}
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />
      <Button variant="secondary" type="submit" disabled={!name.trim()}>
        Add name
      </Button>
      <Button variant="quiet" type="button" onClick={onSkip}>
        Skip row
      </Button>
    </form>
  );
}

function AttentionRow({
  draft,
  issue,
  row,
  plan,
  onFixRow,
  onSkipIssue,
  onReplaceIssue,
}: {
  draft: Draft;
  issue?: RosterIssue;
  row?: RosterRow;
  plan?: PlanResult;
  onFixRow: (row: RosterRow) => void;
  onSkipIssue: () => void;
  onReplaceIssue: (row: RosterRow) => void;
}) {
  const patch = useImport((state) => state.patch);
  const line = issue?.line ?? row?.line ?? 0;
  const decided = draft.resolutions[String(line)];
  const name = fullName(row ?? issue?.row ?? {}) || "No name";
  return (
    <li
      className={styles.attention}
      data-resolved={decided ? "true" : undefined}
    >
      <div className={styles.attentionWhat}>
        <span className={styles.attentionLine}>Row {line}</span>
        <strong>{name}</strong>
        <span>
          {plan?.status === "held"
            ? plan.reason === "outside_class"
              ? "This student needs a school administrator to add them to this class."
              : plan.reason === "ambiguous_match"
                ? "Matches more than one student."
                : plan.reason === "name_changed"
                  ? `This ID belongs to ${plan.existing} on your roster, under a different name.`
                  : `${plan.existing} is already on your roster, without this ID.`
            : issue
              ? issueText[issue.code](issue.value)
              : ""}
        </span>
      </div>
      <div className={styles.attentionFix}>
        {plan?.reason === "outside_class" ? null : plan?.reason ===
          "ambiguous_match" ? (
          <Button
            variant="secondary"
            onClick={() =>
              patch({ resolutions: { ...draft.resolutions, [line]: "new" } })
            }
          >
            {decided === "new"
              ? "Marked as a different student"
              : "Different student"}
          </Button>
        ) : plan?.status === "held" ? (
          <Segmented
            label={`What to do with ${name}`}
            compact
            dense
            value={decided ?? null}
            onChange={(choice) =>
              patch({
                resolutions: { ...draft.resolutions, [line]: choice },
              })
            }
            options={[
              {
                value: "same",
                label:
                  plan.reason === "name_changed"
                    ? "Same student"
                    : "Same student",
              },
              { value: "new", label: "Different student" },
            ]}
          />
        ) : issue?.code === "ambiguous_identity" ? (
          // Two children with one name: each comes in as their own student
          // (a names list has no Student ID to tell them apart), and is never
          // taken for their namesake.
          <Button
            variant="secondary"
            onClick={() => {
              patch({ resolutions: { ...draft.resolutions, [line]: "new" } });
              onFixRow(
                rosterRowSchema.parse({
                  // The parser's working keys aren't part of a row.
                  ...Object.fromEntries(
                    Object.entries(issue.row).filter(
                      ([key]) => key !== "classKeys",
                    ),
                  ),
                  sourcedId: distinctNamedId(
                    issue.row.sourcedId ||
                      namedStudentId(
                        issue.row.givenName ?? "",
                        issue.row.familyName,
                        issue.row.classes[0]?.name,
                      ),
                    issue.line,
                  ),
                }),
              );
            }}
          >
            Add as a different student
          </Button>
        ) : issue?.code === "unknown_grade" && row ? (
          <GradePicker
            label="Grade"
            value={row.gradeLevel ?? null}
            onChange={(gradeLevel) =>
              onReplaceIssue({
                ...row,
                ...(gradeLevel === null ? {} : { gradeLevel }),
              })
            }
          />
        ) : issue?.code === "invalid_email" ? (
          <span className={styles.attentionNote}>
            Comes in without an email.
          </span>
        ) : issue &&
          (issue.code === "missing_name" || issue.code === "name_too_long") ? (
          <FixMissingName issue={issue} onFix={onFixRow} onSkip={onSkipIssue} />
        ) : null}
      </div>
    </li>
  );
}

const CHUNK_RETRIES = 3;
async function withRetries<T>(work: () => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (failure) {
      if (
        attempt >= CHUNK_RETRIES ||
        !(failure instanceof AppError) ||
        !failure.retry
      )
        throw failure;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}
function chunks<T>(rows: readonly T[]) {
  const out: T[][] = [];
  for (let start = 0; start < rows.length; start += ROSTER_CHUNK)
    out.push(rows.slice(start, start + ROSTER_CHUNK));
  return out;
}

function ReviewStep({
  draft,
  orgId,
  show,
  onShow,
  onBack,
  onDone,
}: {
  draft: Draft;
  orgId: string;
  show: Bucket | "all";
  onShow: (show: Bucket | "all") => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const session = currentSession();
  const patch = useImport((state) => state.patch);
  // A teacher adding students to their own class: one class, students only.
  const classScope = !!draft.classId;
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    failed: string | null;
    results: ApplyResult[];
    invited: number;
    nextChunk: number;
  } | null>(null);
  const [recheck, setRecheck] = useState(false);
  useLoggedError(progress?.failed ?? "");
  const result = draft.result!;
  const rows = result.rows;
  const students = rows.filter((row) => row.role === "student");
  const teachers = rows.filter((row) => row.role !== "student");
  const classes = new Set(
    rows.flatMap((row) => row.classes.map((klass) => klass.sourcedId)),
  );
  const planFor = (row: RosterRow) => draft.plan.get(row.line);
  const counts = { new: 0, changed: 0, unchanged: 0, attention: 0 };
  for (const row of rows) counts[bucketOf(planFor(row))]++;
  const issues = result.issues;
  const blocked = issues.filter(
    (issue) =>
      issue.code === "missing_name" ||
      issue.code === "name_too_long" ||
      issue.code === "ambiguous_identity" ||
      issue.code === "conflicting_identity" ||
      issue.code === "source_conflict",
  );
  const soft = issues.filter(
    (issue) =>
      issue.code === "unknown_grade" ||
      issue.code === "invalid_email" ||
      issue.code === "unsupported_role",
  );
  const held = rows.filter((row) => planFor(row)?.status === "held");
  const unresolved = held.filter((row) => !draft.resolutions[String(row.line)]);
  const attention = blocked.length + soft.length + held.length;
  const total = rows.length + blocked.length;
  const newTeachers = teachers.filter((row) => planFor(row)?.status === "new");
  const toWrite = rows.filter((row) => {
    const plan = planFor(row);
    return (
      plan?.status === "new" ||
      plan?.status === "changed" ||
      (plan?.status === "held" && draft.resolutions[String(row.line)])
    );
  });
  const replaceRow = async (next: RosterRow, dropIssue: RosterIssue) => {
    patch({
      result: {
        ...result,
        rows: [...rows.filter((row) => row.line !== next.line), next],
        issues: issues.filter((issue) => issue !== dropIssue),
      },
    });
    setRecheck(true);
    try {
      const [planned] = await school.plan(
        session,
        orgId,
        draft.source,
        [next],
        draft.classId,
      );
      if (planned) {
        const plan = new Map(useImport.getState().draft?.plan);
        plan.set(next.line, planned);
        patch({ plan });
      }
    } catch (failure) {
      console.error("A fixed row could not be checked", failure);
    } finally {
      setRecheck(false);
    }
  };
  const apply = async (
    from: number,
    carried: ApplyResult[],
    invitedSoFar: number,
  ) => {
    const parts = chunks(toWrite);
    const results = [...carried];
    let invited = invitedSoFar;
    setProgress({
      done: results.length,
      total: toWrite.length,
      failed: null,
      results,
      invited,
      nextChunk: from,
    });
    for (let index = from; index < parts.length; index++) {
      try {
        const answer = await withRetries(() =>
          school.apply(
            session,
            orgId,
            draft.source,
            parts[index]!,
            draft.resolutions,
            draft.classId,
          ),
        );
        results.push(...answer.results);
        invited += answer.invited;
        setProgress({
          done: results.length,
          total: toWrite.length,
          failed: null,
          results,
          invited,
          nextChunk: index + 1,
        });
      } catch (failure) {
        setProgress({
          done: results.length,
          total: toWrite.length,
          failed: failureText(
            failure,
            "The connection dropped. Everything so far is saved.",
          ),
          results,
          invited,
          nextChunk: index,
        });
        return;
      }
    }
    patch({ applied: results, invited });
    await refreshSchool(session);
    onDone();
  };
  const running = progress && !progress.failed;
  const share = (count: number) => (total ? `${(count / total) * 100}%` : "0%");
  const grid: DataGridColumn<RosterRow>[] = [
    {
      id: "name",
      header: "Name",
      width: 200,
      compare: (a, b) => fullName(a).localeCompare(fullName(b), "en"),
      cell: (row) => fullName(row),
    },
    ...(classScope
      ? []
      : ([
          {
            id: "role",
            header: "Role",
            width: 90,
            cell: (row) => (row.role === "student" ? "Student" : "Teacher"),
          },
        ] satisfies DataGridColumn<RosterRow>[])),
    {
      id: "grade",
      header: "Grade",
      width: 70,
      cell: (row) => (row.role === "student" ? gradeLabel(row.gradeLevel) : ""),
    },
    ...(classScope
      ? []
      : ([
          {
            id: "classes",
            header: "Classes",
            width: 220,
            cell: (row) => row.classes.map((klass) => klass.name).join(", "),
          },
        ] satisfies DataGridColumn<RosterRow>[])),
    {
      id: "status",
      header: "Result",
      width: 150,
      cell: (row) => {
        const bucket = bucketOf(planFor(row));
        const changes = planFor(row)?.changes;
        return (
          <span className={styles.result}>
            <Badge tone={bucketLabels[bucket][1]}>
              {bucketLabels[bucket][0]}
            </Badge>
            {changes?.length ? (
              <span className={styles.resultDetail}>{changes.join(", ")}</span>
            ) : null}
          </span>
        );
      },
    },
  ];
  const shownRows =
    show === "all"
      ? rows
      : rows.filter((row) => bucketOf(planFor(row)) === show);
  const headline = classScope
    ? counts.new
      ? plural(counts.new, "new student")
      : "No new students"
    : [
        plural(students.length, "student"),
        plural(classes.size, "class", "classes"),
        plural(teachers.length, "teacher"),
      ].join(", ");
  const summary = (
    classScope
      ? [
          ...(counts.changed
            ? [`${counts.changed.toLocaleString("en-US")} updated`]
            : []),
          ...(counts.unchanged
            ? [`${counts.unchanged.toLocaleString("en-US")} already here`]
            : []),
          // The rows to look at are counted once, in their own heading.
        ]
      : [
          `${counts.new.toLocaleString("en-US")} new`,
          ...(counts.changed
            ? [`${counts.changed.toLocaleString("en-US")} updated`]
            : []),
          `${counts.unchanged.toLocaleString("en-US")} unchanged`,
          `${attention.toLocaleString("en-US")} ${attention === 1 ? "needs" : "need"} attention`,
        ]
  ).join(", ");
  // Filters only where the rows differ: all new needs no filter.
  const filters = counts.changed + counts.unchanged + counts.attention > 0;
  return (
    <div className={styles.review}>
      <header className={styles.diff}>
        <h1 className={styles.diffHeadline}>
          {classScope ? headline : `${headline}.`}
        </h1>
        {summary && <p className={styles.diffSummary}>{summary}.</p>}
        {(!classScope || filters) && (
          <div
            className={styles.diffBar}
            role="img"
            aria-label={summary || headline}
            data-empty={total ? undefined : "true"}
          >
            <span data-kind="new" style={{ width: share(counts.new) }} />
            <span
              data-kind="changed"
              style={{ width: share(counts.changed) }}
            />
            <span
              data-kind="unchanged"
              style={{ width: share(counts.unchanged) }}
            />
            <span
              data-kind="attention"
              style={{ width: share(blocked.length + counts.attention) }}
            />
          </div>
        )}
        {(result.skipped > 0 || result.inactive > 0) && (
          <p className={styles.diffNote}>
            {result.skipped > 0 &&
              `Left out ${plural(result.skipped, "person", "people")} who aren’t students or teachers. `}
            {result.inactive > 0 &&
              `Left out ${plural(result.inactive, "row")} marked inactive.`}
          </p>
        )}
      </header>
      {attention > 0 && (
        <section className={styles.attentionList}>
          <h2>{plural(attention, "row")} to look at</h2>
          <ul>
            {[
              ...blocked.map((issue) => ({
                line: issue.line,
                node: (
                  <AttentionRow
                    key={`b${issue.line}`}
                    draft={draft}
                    issue={issue}
                    onFixRow={(row) => void replaceRow(row, issue)}
                    onSkipIssue={() =>
                      patch({
                        result: {
                          ...result,
                          issues: issues.filter((entry) => entry !== issue),
                        },
                      })
                    }
                    onReplaceIssue={() => undefined}
                  />
                ),
              })),
              ...held.map((row) => ({
                line: row.line,
                node: (
                  <AttentionRow
                    key={`h${row.line}`}
                    draft={draft}
                    row={row}
                    plan={planFor(row)}
                    onFixRow={() => undefined}
                    onSkipIssue={() => undefined}
                    onReplaceIssue={() => undefined}
                  />
                ),
              })),
              ...soft.map((issue) => ({
                line: issue.line,
                node: (
                  <AttentionRow
                    key={`s${issue.line}${issue.code}`}
                    draft={draft}
                    issue={issue}
                    row={rows.find((entry) => entry.line === issue.line)}
                    onFixRow={() => undefined}
                    onSkipIssue={() => undefined}
                    onReplaceIssue={(next) => void replaceRow(next, issue)}
                  />
                ),
              })),
            ]
              .sort((a, b) => a.line - b.line)
              .map((entry) => entry.node)}
          </ul>
        </section>
      )}
      <section className={styles.preview}>
        <div className={styles.previewHead}>
          <h2>{classScope ? "Students" : "Every row"}</h2>
          {filters && (
            <Segmented
              label="Show"
              compact
              dense
              value={show}
              onChange={onShow}
              options={[
                {
                  value: "all",
                  label: `All ${rows.length.toLocaleString("en-US")}`,
                },
                {
                  value: "new",
                  label: `New ${counts.new.toLocaleString("en-US")}`,
                },
                ...(counts.changed
                  ? [
                      {
                        value: "changed" as const,
                        label: `Updated ${counts.changed.toLocaleString("en-US")}`,
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
        {shownRows.length ? (
          <DataGrid
            label="Roster changes"
            columns={grid}
            rows={shownRows}
            rowKey={(row) => `${row.line}-${row.sourcedId}`}
            cardLayout="row"
            cardEstimate={72}
            card={(row) => {
              const bucket = bucketOf(planFor(row));
              return (
                <div className={styles.rowCard}>
                  <span className={styles.rowCardText}>
                    <strong>{fullName(row)}</strong>
                    <span>
                      {[
                        row.role === "student" ? "" : "Teacher",
                        row.role === "student" && row.gradeLevel !== undefined
                          ? `Grade ${gradeLabel(row.gradeLevel)}`
                          : "",
                        classScope
                          ? ""
                          : row.classes.map((klass) => klass.name).join(", "),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                  <Badge tone={bucketLabels[bucket][1]}>
                    {bucketLabels[bucket][0]}
                  </Badge>
                </div>
              );
            }}
          />
        ) : (
          <p className={styles.quietLine}>Nothing in this group.</p>
        )}
      </section>
      <footer className={styles.applyBar}>
        <div className={styles.applyInner}>
          {progress ? (
            <div className={styles.progress}>
              <div className={styles.progressLine}>
                <span>
                  {progress.failed
                    ? progress.failed
                    : `Saving ${Math.min(progress.done + 1, progress.total).toLocaleString("en-US")} of ${progress.total.toLocaleString("en-US")}`}
                </span>
                {progress.failed && (
                  <span className={styles.progressKept}>
                    {plural(progress.done, "row")} saved so far.
                  </span>
                )}
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Saving the roster"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                data-failed={progress.failed ? "true" : undefined}
              >
                <span
                  style={{
                    width: progress.total
                      ? `${(progress.done / progress.total) * 100}%`
                      : "100%",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className={styles.applyText}>
              {classScope &&
              toWrite.length === counts.new ? null : toWrite.length ? (
                <>
                  <strong>
                    {[
                      counts.new - newTeachers.length > 0
                        ? `Adds ${plural(counts.new - newTeachers.length, "student")}`
                        : "",
                      counts.changed
                        ? `updates ${plural(counts.changed, "person", "people")}`
                        : "",
                      newTeachers.length
                        ? `invites ${plural(newTeachers.length, "teacher")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ")
                      .replace(/^./, (char) => char.toUpperCase()) ||
                      `Applies ${plural(toWrite.length, "decision")}`}
                    .
                  </strong>
                  {!classScope && <span> Importing never removes anyone.</span>}
                </>
              ) : (
                <strong>
                  {unresolved.length
                    ? "Decide the rows above, or leave them for later."
                    : "Your roster already matches this file."}
                </strong>
              )}
            </div>
          )}
          <div className={styles.applyActions}>
            {!running && (
              <Button variant="quiet" onClick={onBack}>
                Back
              </Button>
            )}
            {progress?.failed ? (
              <Button
                variant="primary"
                onClick={() =>
                  void apply(
                    progress.nextChunk,
                    progress.results,
                    progress.invited,
                  )
                }
              >
                Try again
              </Button>
            ) : toWrite.length ? (
              <Button
                variant="primary"
                aria-busy={!!running}
                disabled={!!running || recheck}
                onClick={() => void apply(0, [], 0)}
              >
                {classScope && toWrite.length === counts.new
                  ? `Add ${plural(toWrite.length, "student")}`
                  : "Apply changes"}
              </Button>
            ) : (
              <StudentsLink orgId={orgId} classId={draft.classId} />
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Back to the students this import was for: the class's, or the school's. */
function StudentsLink({
  orgId,
  classId,
  primary = true,
}: {
  orgId: string;
  classId?: string;
  primary?: boolean;
}) {
  const look = buttonClass(primary ? "primary" : "secondary");
  return classId ? (
    <Link
      to="/school/$org/classes/$class/roster"
      params={{ org: orgId, class: classId }}
      className={look}
    >
      See students
    </Link>
  ) : (
    <Link
      to="/$"
      params={{ _splat: orgPath(orgId, "students") }}
      className={look}
    >
      See students
    </Link>
  );
}

function DoneStep({
  draft,
  orgId,
  onAgain,
}: {
  draft: Draft;
  orgId: string;
  onAgain: () => void;
}) {
  const session = currentSession();
  const applied = draft.applied ?? [];
  const license = useQuery({
    ...licenseOptions(session, orgId),
    enabled: !draft.classId,
  }).data;
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
  const count = (status: ApplyResult["status"]) =>
    applied.filter((row) => row.status === status).length;
  const roles = new Map(
    (draft.result?.rows ?? []).map((row) => [row.line, row.role]),
  );
  const addedStudents = applied.filter(
    (row) => row.status === "created" && roles.get(row.line) === "student",
  ).length;
  const addedStaff = count("created") - addedStudents;
  const headline = addedStudents
    ? `${plural(addedStudents, "student")} added${addedStaff ? `, ${plural(addedStaff, "teacher")} invited` : ""}.`
    : `${plural(count("updated"), "change")} saved.`;
  const waiting = applied.filter((row) => row.seated === false).length;
  const failed = applied.filter((row) => row.status === "failed");
  const firstClass = draft.classId
    ? classes.find((klass) => klass.id === draft.classId)
    : classes[0];
  return (
    <div className={styles.done}>
      <h1 className={styles.diffHeadline}>{headline}</h1>
      <StatRow label="Result">
        <StatTile
          label="students added"
          value={addedStudents.toLocaleString("en-US")}
        />
        <StatTile
          label="updated"
          value={count("updated").toLocaleString("en-US")}
        />
        <StatTile
          label="invited"
          value={(draft.invited ?? 0).toLocaleString("en-US")}
        />
        {license && (
          <StatTile
            label="seats left"
            value={license.available.toLocaleString("en-US")}
          />
        )}
      </StatRow>
      {waiting > 0 && !draft.classId && (
        <p className={styles.doneNote}>
          <Badge tone="warning">
            {plural(waiting, "student")} {waiting === 1 ? "needs" : "need"} a
            seat
          </Badge>{" "}
          They’re on the roster and get a seat when more are added.
        </p>
      )}
      {failed.length > 0 && (
        <p className={styles.doneNote} role="alert">
          {plural(failed.length, "row")} didn’t save (
          {failed
            .slice(0, 6)
            .map((row) => `row ${row.line}`)
            .join(", ")}
          {failed.length > 6 ? ", and more" : ""}). Applying this file again
          retries only those.
        </p>
      )}
      <div className={styles.doneActions}>
        <StudentsLink orgId={orgId} classId={draft.classId} />
        {firstClass && (
          <Link
            to="/$"
            params={{ _splat: classPath(orgId, firstClass.id) }}
            className={buttonClass("secondary")}
          >
            Open {firstClass.name}
          </Link>
        )}
        {waiting > 0 && !draft.classId && (
          <Link
            to="/$"
            params={{ _splat: orgPath(orgId, "license") }}
            className={buttonClass("secondary")}
          >
            Request more seats
          </Link>
        )}
        <Button variant="quiet" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </div>
  );
}

const STEP_TITLES: Record<Step, string> = {
  source: "Import a roster",
  map: "Check the columns",
  review: "Review changes",
  done: "Import finished",
};

/** The import: drop, check, see every change, apply. Each step has a URL; the
 * file itself stays in memory, so a reload starts again from the drop. */
export function ImportScreen() {
  const { org: orgId, class: classId } = useParams({ strict: false }) as {
    org: string;
    class?: string;
  };
  const search = useSearch({ strict: false }) as {
    step?: unknown;
    show?: unknown;
  };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
  const [checking, setChecking] = useState(false);
  const showFlash = useFlash((state) => state.show);
  const stored = useImport((state) => state.draft);
  const setDraft = useImport((state) => state.set);
  const patch = useImport((state) => state.patch);
  const draft =
    stored?.orgId === orgId && stored.classId === classId ? stored : null;
  const asked = STEPS.find((step) => step === search.step) ?? "source";
  const step: Step = !draft
    ? "source"
    : asked === "review" && !draft.result
      ? "map"
      : asked === "done" && !draft.applied
        ? "review"
        : asked;
  const goTo = (next: Step, replace = false) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        step: next === "source" ? undefined : next,
        show: undefined,
      })) as never,
      replace,
    });
  useEffect(() => {
    if (step !== asked) goTo(step, true);
  }, [step, asked]);
  const showAsked = ["new", "changed", "unchanged", "attention"].find(
    (value) => value === search.show,
  ) as Bucket | undefined;
  const defaultClass = classId
    ? (classes.find((klass) => klass.id === classId)?.name ?? "My class")
    : org?.solo
      ? (classes[0]?.name ?? "My class")
      : (classes[0]?.name ?? "");
  const check = async () => {
    const current = useImport.getState().draft!;
    let result: SourceResult;
    if (current.source === "oneroster") {
      const { oneRosterRows } =
        await import("../../../schools/sources/oneroster");
      result = oneRosterRows(current.files!, {
        ...(current.schoolId ? { schoolSourcedId: current.schoolId } : {}),
      });
    } else {
      result = csvRows(current.table!, current.mapping!, {
        fallbackClass: current.fallbackClass ?? defaultClass,
      });
    }
    // A class import adds students to this class only; the server binds
    // each row to the class, so rows keep the identities the file gave them.
    if (classId)
      result = {
        ...result,
        rows: result.rows.filter((row) => row.role === "student"),
        skipped:
          result.skipped +
          result.rows.filter((row) => row.role !== "student").length,
      };
    const rows = result.rows;
    const plan = new Map<number, PlanResult>();
    for (const part of chunks(rows))
      for (const entry of await withRetries(() =>
        school.plan(session, orgId, current.source, part, classId),
      ))
        plan.set(entry.line, entry);
    patch({ result, plan, resolutions: {}, applied: undefined });
    goTo("review");
  };
  const frame = (children: ReactNode) =>
    classId ? (
      <ClassFrame org={orgId} classId={classId} loading={false} tab="roster">
        {children}
      </ClassFrame>
    ) : (
      <OrgFrame
        orgId={orgId}
        nav="import"
        title="Import"
        crumbs={[{ label: "Import" }]}
      >
        {children}
      </OrgFrame>
    );
  if (
    org &&
    !org.can?.includes("roster.import") &&
    !(classId && org.teaches?.includes(classId))
  )
    return frame(
      <EmptyState
        title="Your school’s admin handles imports"
        action={
          <StudentsLink orgId={orgId} classId={classId} primary={false} />
        }
      >
        You can add students to your own classes one at a time.
      </EmptyState>,
    );
  /** A teacher's paste or file whose columns are plain goes straight to the
   * students it adds; the columns stay one Back away. */
  const loaded = async (next: Draft) => {
    setDraft({
      ...next,
      ...(classId ? { classId, fallbackClass: defaultClass } : {}),
    });
    if (
      !classId ||
      next.source !== "csv" ||
      !mappingHasName(next.mapping!) ||
      next.table?.headers.some(
        (_, index) =>
          (!next.mapping?.[index] || next.mapping[index] === "ignore") &&
          next.table!.rows.some((row) => row[index]?.trim()),
      )
    ) {
      goTo("map");
      return;
    }
    setChecking(true);
    try {
      await check();
    } catch (failure) {
      console.error("The pasted students couldn’t be checked", failure);
      goTo("map");
    } finally {
      setChecking(false);
    }
  };
  /** A class's students are added: back to Students, which says so. */
  const added = () => {
    const count = (useImport.getState().draft?.applied ?? []).filter(
      (row) => row.status === "created",
    ).length;
    showFlash(count ? `${plural(count, "student")} added` : "Students updated");
    void navigate({
      to: "/school/$org/classes/$class/roster",
      params: { org: orgId, class: classId! },
      replace: true,
    }).then(() => setDraft(null));
  };
  return frame(
    <div className={styles.page} data-step={step}>
      {(step === "source" || step === "map") && (
        <PageHead
          title={
            classId && step === "source" ? "Add students" : STEP_TITLES[step]
          }
          detail={
            step === "source" && !classId
              ? "Students, classes and teachers, all from one file."
              : undefined
          }
        />
      )}
      {step === "source" && (
        <SourceStep
          orgId={orgId}
          classScope={!!classId}
          checking={checking}
          onLoaded={(next) => void loaded(next)}
        />
      )}
      {step === "map" && draft && (
        <MapStep
          draft={draft}
          defaultClass={defaultClass}
          onBack={() => {
            setDraft(null);
            goTo("source");
          }}
          onContinue={check}
        />
      )}
      {step === "review" && draft && (
        <ReviewStep
          draft={draft}
          orgId={orgId}
          show={showAsked ?? "all"}
          onShow={(show) =>
            void navigate({
              to: ".",
              search: ((previous: Record<string, unknown>) => ({
                ...previous,
                show: show === "all" ? undefined : show,
              })) as never,
              replace: true,
              resetScroll: false,
            })
          }
          onBack={() => goTo("map")}
          onDone={() => (classId ? added() : goTo("done", true))}
        />
      )}
      {step === "done" && draft && (
        <DoneStep
          draft={draft}
          orgId={orgId}
          onAgain={() => {
            setDraft(null);
            goTo("source");
          }}
        />
      )}
    </div>,
  );
}

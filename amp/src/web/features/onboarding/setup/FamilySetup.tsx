import { spaceWords } from "../../spaces/words";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { create } from "zustand";
import { z } from "zod";
import type { SignedInMe } from "../../../../account/contracts";
import {
  CHILD_NAME_MAX,
  childNameProblem,
  NICKNAME_MAX,
  PARENT_ENTRY_LINE,
} from "../../../../learning/nickname";
import { studentGrantResource } from "../../../../schools/contracts";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";
import { invalidateAccount, meOptions } from "../../../lib/query";
import { chosenPlan } from "../../../lib/pending-trial";
import { Button, buttonClass } from "../../../ui/Button";
import { YearField } from "../../../ui/YearField";
import { QueryBlock } from "../../../ui/QueryBlock";
import { RowButton, RowList } from "../../../ui/RowList";
import { JoinClass } from "../../school/join/JoinClass";
import { TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { approvalsOptions } from "../../family-approval/api";
import { presenceOptions } from "../../school/classes/api";
import { useFinishSignIn } from "../../school/join/api";
import { useStartPlace } from "../starter-api";
import { saveProfile } from "../../family/api";
import { StepFrame } from "./StepFrame";
import styles from "./Setup.module.css";

/* A parent's or a tutor's first run (docs/product-model.md): a few calm steps,
   each its own URL. A parent: their name (when we don't have it yet), their
   kids, then who practices first, straight into that child's first problem.
   Their own devices and a second parent wait, optional, on Today and People.
   A tutor's in-flight setup keeps its steps. */

export type SetupKind = "parent" | "tutor";
type Step = { id: string; label: string };
const NAME_STEP: Step = { id: "name", label: "Your name" };
const STEPS = {
  parent: [
    { id: "", label: "Your kids" },
    { id: "ready", label: "First practice" },
  ],
  tutor: [
    { id: "", label: "Your students" },
    { id: "join", label: "How they join" },
    { id: "ready", label: "Start" },
  ],
} as const satisfies Record<SetupKind, readonly Step[]>;

/** This tab asked the parent's name in this setup: the step stays in the
 * list once it's answered, so the steps never shift under them. */
const askedKey = (accountId: string) => `amp.setup.name.${accountId}`;
function askedName(accountId: string) {
  try {
    return sessionStorage.getItem(askedKey(accountId)) === "1";
  } catch {
    return false;
  }
}
function markAskedName(accountId: string) {
  try {
    sessionStorage.setItem(askedKey(accountId), "1");
  } catch (error) {
    console.warn("The setup's steps couldn't be kept in this tab", error);
  }
}

/** The steps of this setup: a parent without a name on file answers it
 * first (R12), and it stays listed for the rest of this setup. */
export function setupSteps(
  kind: SetupKind,
  me: Pick<SignedInMe, "account">,
  asked = false,
): readonly Step[] {
  if (kind !== "parent") return STEPS[kind];
  return asked || !me.account.givenName?.trim()
    ? [NAME_STEP, ...STEPS.parent]
    : STEPS.parent;
}
export const setupStepIds = (kind: SetupKind): readonly string[] =>
  kind === "parent"
    ? [NAME_STEP.id, ...STEPS.parent.map((step) => step.id)]
    : STEPS[kind].map((step) => step.id);
const stepUrl = (kind: SetupKind, id: string) =>
  id ? `/start/${kind}/${id}` : `/start/${kind}`;
const todayUrl = (place: { orgId: string; classId: string }) =>
  `/school/${place.orgId}/classes/${place.classId}/today`;
/** A family's Today: its own address, the landing alias for theirs. */
const FAMILY_TODAY = "/family";

/** Rows a parent or tutor is adding, kept in this tab's memory per account,
 * so Back, Forward and a refresh of the step keep what was typed. */
type Draft = {
  owner: string | null;
  rows: { name: string; year: string }[];
  /** New names for children already in the class, by learner. */
  renames: Record<string, string>;
  /** Corrected birth years for children already in the class, by learner. */
  years: Record<string, string>;
};
const useDraft = create<
  Draft & { set: (owner: string, change: Partial<Draft>) => void }
>((set) => ({
  owner: null,
  rows: [],
  renames: {},
  years: {},
  set: (owner, change) =>
    set((state) =>
      state.owner === owner
        ? change
        : { owner, rows: [], renames: {}, years: {}, ...change },
    ),
}));

export function FamilySetup({
  session,
  kind,
  step,
}: {
  session: AuthSession;
  kind: SetupKind;
  step: string;
}) {
  const me = useQuery(meOptions(session)).data;
  // A parent's setup from before (how they practice, a second parent): its
  // links in flight open who practices first; both stay on Today and People.
  if (kind === "parent" && (step === "practice" || step === "second-parent"))
    return <Navigate to={stepUrl(kind, "ready") as never} replace />;
  const known = setupStepIds(kind).includes(step);
  if (!known) return <Navigate to={stepUrl(kind, "") as never} replace />;
  if (!me?.signedIn)
    return (
      <StepFrame
        steps={kind === "parent" ? [] : STEPS[kind]}
        index={0}
        title={
          step === "name"
            ? NAME_STEP.label
            : step === ""
              ? kind === "parent"
                ? "Add your kids"
                : "Your students"
              : ""
        }
        back="/start"
      >
        <div className={styles.loading} aria-busy="true" />
      </StepFrame>
    );
  const steps = setupSteps(
    kind,
    me,
    kind === "parent" && askedName(session.accountId),
  );
  const index = steps.findIndex((entry) => entry.id === step);
  // The name step, once the name is on file and this setup never asked it.
  if (index < 0) return <Navigate to={stepUrl(kind, "") as never} replace />;
  if (steps[0]!.id === "name" && step !== "name") {
    // A parent without a name answers it before anything else.
    if (!me.account.givenName?.trim())
      return <Navigate to={stepUrl(kind, "name") as never} replace />;
  }
  if (step === "name") markAskedName(session.accountId);
  const first = steps.findIndex((entry) => entry.id === "");
  // Every step after the children needs the family step one makes.
  if (index > first && !me.familyClass)
    return <Navigate to={stepUrl(kind, "") as never} replace />;
  const props = { session, me, kind, index, steps };
  if (step === "name") return <NameStep {...props} />;
  if (step === "")
    return kind === "parent" ? (
      <ChildrenStep {...props} />
    ) : (
      <StudentsStep {...props} />
    );
  if (step === "join") return <JoinStep {...props} />;
  return <ReadyStep {...props} />;
}

type StepProps = {
  session: AuthSession;
  me: SignedInMe;
  kind: SetupKind;
  index: number;
  steps: readonly Step[];
};
/** The address of the step after this one. */
const nextUrl = ({ kind, index, steps }: StepProps) =>
  stepUrl(kind, steps[index + 1]!.id);

/** One step of a parent's or tutor's setup, in the shared step frame. */
function Frame({
  steps,
  kind,
  index,
  back = index === 0 ? "/start" : stepUrl(kind, steps[index - 1]!.id),
  ...rest
}: Omit<Parameters<typeof StepFrame>[0], "back"> & {
  kind: SetupKind;
  back?: string;
}) {
  return <StepFrame steps={steps} index={index} back={back} {...rest} />;
}

const why = (failure: unknown, fallback: string) => {
  console.error(fallback, failure);
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
};

const NAME_MAX = 100;
/** A parent's own name, once (R12): it's what another parent, an approval
 * or an invitation shows, never "Parent". Kept in Account after. */
function NameStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  const navigate = useNavigate();
  // A name given at sign-up comes in as the starting text, never saved
  // unasked.
  const [first = "", ...rest] = (me.account.displayName ?? "")
    .trim()
    .split(/\s+/);
  const [given, setGiven] = useState(me.account.givenName ?? first);
  const [family, setFamily] = useState(
    me.account.familyName ?? rest.join(" "),
  );
  const [asked, setAsked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const missing = !given.trim() || !family.trim();
  const next = async () => {
    setAsked(true);
    if (missing || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveProfile(session, {
        givenName: given.trim(),
        familyName: family.trim(),
      });
      await navigate({ href: nextUrl(props) });
    } catch (failure) {
      setError(why(failure, "Your name didn’t save. Try again."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Frame
      steps={steps}
      kind={kind}
      index={index}
      title="Your name"
      lede="Invitations and anything you share show it."
      next={
        <Button
          variant="primary"
          type="submit"
          form="setup-name"
          aria-busy={saving || undefined}
          disabled={saving}
        >
          Next
        </Button>
      }
    >
      <form
        id="setup-name"
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void next();
        }}
      >
        <TextField
          label="First name"
          autoComplete="given-name"
          value={given}
          maxLength={NAME_MAX}
          error={asked && !given.trim() ? "Enter your first name." : ""}
          disabled={saving}
          autoFocus
          onChange={(event) => setGiven(event.target.value)}
        />
        <TextField
          label="Last name"
          autoComplete="family-name"
          value={family}
          maxLength={NAME_MAX}
          error={
            asked && given.trim() && !family.trim()
              ? "Enter your last name."
              : ""
          }
          disabled={saving}
          onChange={(event) => setFamily(event.target.value)}
        />
      </form>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** Step one for a parent: each child's name (optional) and birth year,
 * adding or removing rows. Children already in the class are there too, and
 * their names can change here. */
function ChildrenStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  const navigate = useNavigate();
  const start = useStartPlace(session);
  const draft = useDraft();
  const mine = draft.owner === session.accountId;
  const existing = me.learners;
  const rows = mine
    ? draft.rows
    : existing.length
      ? []
      : [{ name: "", year: "" }];
  const renames = mine ? draft.renames : {};
  const years = mine ? draft.years : {};
  const yearOf = (child: (typeof existing)[number]) =>
    years[child.id] ?? (child.birthYear ? String(child.birthYear) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = existing.length + rows.length;
  const label = (at: number) => `Child ${at + 1}`;
  const nameOf = (child: (typeof existing)[number]) =>
    renames[child.id] ?? (child.defaultName ? "" : child.name);
  // What's in the way is said at its own field: a name's problem under the
  // name, a missing year under the year once Next is asked for.
  let hint = "";
  let invalid = -1;
  const names = [...existing.map(nameOf), ...rows.map((row) => row.name)];
  for (const [at, name] of names.entries()) {
    const problem = childNameProblem(name);
    if (problem) {
      hint = problem;
      invalid = at;
      break;
    }
  }
  const missingYear = rows.some((row) => !row.year);
  const [asked, setAsked] = useState(false);
  const setRows = (next: Draft["rows"]) =>
    draft.set(session.accountId, { rows: next, renames, years });
  const next = async () => {
    if (missingYear) return setAsked(true);
    if (hint || saving) return;
    setSaving(true);
    setError("");
    try {
      for (const child of existing) {
        const name = renames[child.id]?.trim();
        const current = child.defaultName ? "" : child.name;
        if (name === undefined || name === current) continue;
        await request(
          `/family/learners/${encodeURIComponent(child.id)}/rename`,
          z.unknown(),
          { token: session.token, body: { name } },
        );
      }
      // A year corrected here (Q-56): the child's start and class grade
      // follow, and their answers stay.
      for (const child of existing) {
        const year = years[child.id];
        if (!year || Number(year) === child.birthYear) continue;
        await request(
          `/family/learners/${encodeURIComponent(child.id)}/birth-year`,
          z.unknown(),
          { token: session.token, body: { birthYear: Number(year) } },
        );
      }
      if (Object.keys(years).length) void invalidateAccount(session.accountId);
      if (rows.length || !me.familyClass) {
        const year = new Date().getFullYear();
        // The starter's answer is the family's whole count: the children
        // already here, then the new ones.
        const made = await start.mutateAsync({
          as: "parent",
          children: [
            ...existing.map((child) => ({
              birthYear: Number(yearOf(child)) || year - 8,
            })),
            ...rows.map((row) => ({
              birthYear: Number(row.year),
              ...(row.name.trim() ? { name: row.name.trim() } : {}),
            })),
          ],
        });
        // A plan chosen on the pitch before signing up opens for the first
        // child; setup's next steps wait on Today.
        const plan = chosenPlan();
        if (plan && made.learnerId) {
          draft.set(session.accountId, { rows: [], renames: {}, years: {} });
          await navigate({
            to: "/continue/$learnerId",
            params: { learnerId: made.learnerId },
            search: { interval: plan },
          });
          return;
        }
      }
      draft.set(session.accountId, { rows: [], renames: {}, years: {} });
      await navigate({ href: nextUrl(props) });
    } catch (failure) {
      setError(
        why(failure, "That didn’t save. Check your connection and try again."),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Frame
      steps={steps}
      kind={kind}
      index={index}
      title="Add your kids"
      lede="The birth year sets where each child starts."
      next={
        <Button
          variant="primary"
          aria-busy={saving || undefined}
          data-waiting={missingYear || !!hint || undefined}
          disabled={saving}
          onClick={() => void next()}
        >
          Next
        </Button>
      }
    >
      <People
        nameNote={hint}
        missingYear={asked}
        field={{
          label: "Name",
          placeholder: "First name or nickname",
          max: CHILD_NAME_MAX,
        }}
        invalid={invalid}
        disabled={saving}
        rows={[
          ...existing.map((child, at) => ({
            key: child.id,
            label: label(at),
            name: nameOf(child),
            year: yearOf(child),
            fixed: true,
            onName: (name: string) =>
              draft.set(session.accountId, {
                rows,
                years,
                renames: { ...renames, [child.id]: name },
              }),
            onYear: (value: string) =>
              draft.set(session.accountId, {
                rows,
                renames,
                years: { ...years, [child.id]: value },
              }),
          })),
          ...rows.map((row, at) => ({
            key: `new-${at}`,
            label: label(existing.length + at),
            name: row.name,
            year: row.year,
            onName: (name: string) =>
              setRows(rows.map((r, i) => (i === at ? { ...r, name } : r))),
            onYear: (year: string) =>
              setRows(rows.map((r, i) => (i === at ? { ...r, year } : r))),
            onRemove:
              total > 1
                ? () => setRows(rows.filter((_, i) => i !== at))
                : undefined,
          })),
        ]}
        add={
          total < 6
            ? {
                label: "Add a child",
                onAdd: () => setRows([...rows, { name: "", year: "" }]),
              }
            : null
        }
      />
      <p className={styles.basis}>{PARENT_ENTRY_LINE}</p>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** Step one for a tutor: each student's nickname or initials and birth year.
 * Their own parent names them later, by a link from Today. */
function StudentsStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  const navigate = useNavigate();
  const start = useStartPlace(session);
  const draft = useDraft();
  const mine = draft.owner === session.accountId;
  const created = !!me.familyClass;
  const approvals = useQuery({
    ...approvalsOptions(session),
    enabled: created,
  });
  const rows = mine ? draft.rows : created ? [] : [{ name: "", year: "" }];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setRows = (next: Draft["rows"]) =>
    draft.set(session.accountId, { rows: next });
  let hint = "";
  let invalid = -1;
  for (const [at, row] of rows.entries()) {
    const problem = childNameProblem(row.name, NICKNAME_MAX);
    if (problem) {
      hint = problem;
      invalid = at;
      break;
    }
  }
  const missingYear = rows.some((row) => !row.year);
  const [asked, setAsked] = useState(false);
  const next = async () => {
    if (missingYear) return setAsked(true);
    if (hint || saving) return;
    setSaving(true);
    setError("");
    try {
      // Students join once, when the class is made; later ones come by
      // their parent's link from Today.
      if (!created)
        await start.mutateAsync({
          as: "tutor",
          students: rows.map((row) => ({
            birthYear: Number(row.year),
            ...(row.name.trim() ? { nickname: row.name.trim() } : {}),
          })),
        });
      draft.set(session.accountId, { rows: [] });
      await navigate({ href: nextUrl(props) });
    } catch (failure) {
      setError(
        why(failure, "That didn’t save. Check your connection and try again."),
      );
    } finally {
      setSaving(false);
    }
  };
  const students = (approvals.data ?? []).filter(
    (row) => row.status !== "expired",
  );
  return (
    <Frame
      steps={steps}
      kind={kind}
      index={index}
      title="Your students"
      lede={
        created
          ? "Your class is made. Children from other families join it by their parent’s approval, from Today."
          : "Each student’s own parent adds their name through a link you send."
      }
      next={
        <Button
          variant="primary"
          aria-busy={saving || undefined}
          data-waiting={missingYear || !!hint || undefined}
          disabled={saving}
          onClick={() => void next()}
        >
          {created || rows.length ? "Next" : "Skip for now"}
        </Button>
      }
    >
      {created ? (
        students.length > 0 && (
          <ul className={styles.list}>
            {students.map((row) => (
              <li key={row.id}>{row.name}</li>
            ))}
          </ul>
        )
      ) : (
        <People
          nameNote={hint}
          missingYear={asked}
          field={{
            label: "Nickname or initials",
            placeholder: "Optional",
            max: NICKNAME_MAX,
          }}
          invalid={invalid}
          disabled={saving}
          rows={rows.map((row, at) => ({
            key: `new-${at}`,
            label: `Student ${at + 1}`,
            name: row.name,
            year: row.year,
            onName: (name: string) =>
              setRows(rows.map((r, i) => (i === at ? { ...r, name } : r))),
            onYear: (year: string) =>
              setRows(rows.map((r, i) => (i === at ? { ...r, year } : r))),
            onRemove: () => setRows(rows.filter((_, i) => i !== at)),
          }))}
          add={
            rows.length < 30
              ? {
                  label: "Add a student",
                  onAdd: () => setRows([...rows, { name: "", year: "" }]),
                }
              : null
          }
        />
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

type Row = {
  key: string;
  label: string;
  name: string;
  year: string;
  /** Already in the class: the row stays (no Remove). Its year shows, and
   * can be corrected when the row takes `onYear`. */
  fixed?: boolean;
  onName: (name: string) => void;
  onYear?: (year: string) => void;
  onRemove?: () => void;
};

/** Each child: a name field whose placeholder is what they go by if it stays
 * blank ("Child 2"), a birth year in the shared field style that opens the
 * year tiles, and, for a new row, Remove. One line from 560 px, under column
 * labels; stacked with its own labels on a phone. A row that still needs its
 * year says so at that field, once Next is asked for. */
function People({
  field,
  rows,
  invalid,
  nameNote,
  missingYear,
  disabled,
  add,
}: {
  field: { label: string; placeholder: string; max: number };
  rows: Row[];
  invalid: number;
  /** The invalid name's problem, said under it. */
  nameNote: string;
  /** Show "Choose a year" at each row without one. */
  missingYear: boolean;
  disabled: boolean;
  add: { label: string; onAdd: () => void } | null;
}) {
  const id = useId();
  return (
    <div className={styles.people}>
      {rows.length > 0 && (
        <div className={styles.columns} aria-hidden="true">
          <span>{field.label}</span>
          <span>Birth year</span>
          <span />
        </div>
      )}
      <ol className={styles.rows}>
        {rows.map((row, at) => {
          const needsYear = missingYear && !row.fixed && !row.year;
          const nameId = `${id}-${row.key}`;
          // Named by what the parent typed, else the row's own name.
          const remove = row.onRemove && (
            <RemoveRow
              label={`Remove ${row.name.trim() || row.label}`}
              disabled={disabled}
              onRemove={row.onRemove}
            />
          );
          return (
            <li key={row.key} className={styles.person}>
              <div className={styles.cell}>
                {/* On a phone, Remove sits on the name's label line, at the
                    field's right edge: part of the child, not of the field. */}
                <span className={styles.cellHead}>
                  <label htmlFor={nameId} className={styles.cellLabel}>
                    {field.label}
                  </label>
                  {remove && (
                    <span className={styles.headRemove}>{remove}</span>
                  )}
                </span>
                <input
                  id={nameId}
                  className={styles.nameInput}
                  value={row.name}
                  placeholder={row.label}
                  maxLength={field.max}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  aria-invalid={invalid === at || undefined}
                  aria-label={`${field.label}, ${row.label} (${field.placeholder.toLowerCase()})`}
                  disabled={disabled}
                  onChange={(event) => row.onName(event.target.value)}
                />
                <span className={styles.cellNote} aria-live="polite">
                  {invalid === at ? nameNote : ""}
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.cellLabel} aria-hidden="true">
                  Birth year
                </span>
                {row.fixed && !row.onYear ? (
                  <span className={styles.fixedYear}>{row.year || "—"}</span>
                ) : (
                  <YearField
                    label={`Birth year, ${row.label}`}
                    placeholder="Choose"
                    value={row.year}
                    disabled={disabled}
                    invalid={needsYear}
                    onChange={(value) => row.onYear?.(value)}
                  />
                )}
                <span className={styles.cellNote} aria-live="polite">
                  {needsYear ? "Choose a year" : ""}
                </span>
              </div>
              <span className={styles.removeCell}>{remove}</span>
            </li>
          );
        })}
      </ol>
      {add && (
        <Button
          type="button"
          variant="secondary"
          className={styles.addRow}
          disabled={disabled}
          onClick={add.onAdd}
        >
          {add.label}
        </Button>
      )}
    </div>
  );
}

/** A row's Remove: a muted mark with a full-size target. */
function RemoveRow({
  label,
  disabled,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.remove}
      aria-label={label}
      disabled={disabled}
      onClick={onRemove}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m4 4 8 8m0-8-8 8" />
      </svg>
    </button>
  );
}

/** How the children practice: handed this device, or on their own with the
 * class code and three pictures. Cards print a QR for each child. */
function JoinStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  const place = me.familyClass!;
  const presence = useQuery(
    presenceOptions(session, { org: place.orgId, class: place.classId }),
  );
  const first = me.learners[0]?.name;
  const parent = kind === "parent";
  return (
    <Frame
      steps={steps}
      kind={kind}
      index={index}
      title={parent ? "How they practice" : "How they join"}
      next={
        <Link
          to={nextUrl(props) as never}
          className={buttonClass("primary")}
        >
          Next
        </Link>
      }
    >
      <div className={styles.ways}>
        {parent && (
          <section className={styles.way} aria-labelledby="way-here">
            <svg
              viewBox="0 0 24 24"
              className={styles.wayIcon}
              aria-hidden="true"
            >
              <path d="M7 3h10v18H7zM11 18h2" />
            </svg>
            <h2 id="way-here">On this device</h2>
            <p>
              Hand them your phone or tablet. On Today, tap “Let{" "}
              {first ?? "your child"} practice here”. When they sign out, it’s
              yours again.
            </p>
          </section>
        )}
        <section className={styles.way} aria-labelledby="join-class">
          <QueryBlock
            query={presence}
            what="The class code"
            className={styles.joinWait}
          >
            {(data) => (
              <JoinClass
                code={data.class.joinCode}
                place={{ org: place.orgId, class: place.classId }}
                words={spaceWords(parent ? "family" : "classroom")}
              />
            )}
          </QueryBlock>
        </section>
      </div>
      {!parent && (
        <p className={styles.note}>
          Each student’s own parent approves by a link you send from Today
          (“Send to their parent”). They add the child’s name there.
        </p>
      )}
    </Frame>
  );
}

/** The last step: who practices first, each child a large choice that
 * starts their first problem on this device (the parent's view returns when
 * they sign out), or Today for later. A tutor's in-flight setup ends on its
 * class's Today. */
function ReadyStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  const finish = useFinishSignIn();
  const place = me.familyClass!;
  const parent = kind === "parent";
  const children = parent ? me.learners : [];
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = parent ? FAMILY_TODAY : todayUrl(place);
  const begin = async (learnerId: string) => {
    if (starting) return;
    setStarting(learnerId);
    try {
      const grant = await request(
        `/family/learners/${learnerId}/practice-here`,
        studentGrantResource,
        { token: session.token, body: {} },
      );
      await finish(grant, true, today);
    } catch (failure) {
      setError(why(failure, "Practice didn’t start. Try again in a moment."));
      setStarting(null);
    }
  };
  const ready = children.filter((child) => child.entitlement.active);
  const toToday = (
    <Link
      to={today as never}
      className={buttonClass(parent && ready.length ? "secondary" : "primary")}
    >
      Go to Today
    </Link>
  );
  if (parent && children.length > 0)
    return (
      <Frame
        steps={steps}
        kind={kind}
        index={index}
        title="Who’s practicing first?"
        lede="Hand them this device. When they sign out, it’s yours again."
        next={toToday}
      >
        <RowList label="Your kids">
          {children.map((child) => (
            <RowButton
              key={child.id}
              title={child.name}
              meta={
                child.entitlement.active
                  ? child.birthYear
                    ? `Born ${child.birthYear}`
                    : undefined
                  : "Needs access first, from Today"
              }
              busy={starting === child.id}
              // A child without access can't start here; Today says why.
              disabled={
                !child.entitlement.active ||
                (starting !== null && starting !== child.id)
              }
              data-practice-here={child.id}
              onClick={() => void begin(child.id)}
            />
          ))}
        </RowList>
        <Toast message={error} onDismiss={() => setError("")} />
      </Frame>
    );
  return (
    <Frame
      steps={steps}
      kind={kind}
      index={index}
      title={parent ? "Your family is ready" : "Your class is ready"}
      lede={
        parent
          ? "Today shows each child, this week, and what’s next."
          : "Today shows each child, what they’re working on, and who needs you."
      }
      next={toToday}
    >
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

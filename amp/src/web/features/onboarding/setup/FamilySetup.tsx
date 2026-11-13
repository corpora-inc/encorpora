import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
import { Loading } from "../../../ui/Loading";
import { JoinClass } from "../../school/join/JoinClass";
import { TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { approvalsOptions } from "../../family-approval/api";
import { presenceOptions } from "../../school/classes/api";
import { useFinishSignIn } from "../../school/join/api";
import {
  secondParent,
  secondParentFailure,
  secondParentOptions,
} from "../../second-parent/api";
import { useStartPlace } from "../starter-api";
import { StepFrame } from "./StepFrame";
import styles from "./Setup.module.css";

/* A parent's or a tutor's first run (docs/product-model.md): a few calm steps,
   each its own URL, from "I'm a parent" to the first child's first problem.
   Step one makes the class; the rest show how the children practice and what
   comes next, so Today opens with the children already in it. */

export type SetupKind = "parent" | "tutor";
const STEPS = {
  parent: [
    { id: "", label: "Your children" },
    { id: "practice", label: "How they practice" },
    { id: "second-parent", label: "A second parent" },
    { id: "ready", label: "Start" },
  ],
  tutor: [
    { id: "", label: "Your students" },
    { id: "join", label: "How they join" },
    { id: "ready", label: "Start" },
  ],
} as const;
export const setupStepIds = (kind: SetupKind): readonly string[] =>
  STEPS[kind].map((step) => step.id);
const stepUrl = (kind: SetupKind, id: string) =>
  id ? `/start/${kind}/${id}` : `/start/${kind}`;
const todayUrl = (place: { orgId: string; classId: string }) =>
  `/school/${place.orgId}/classes/${place.classId}/today`;

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
  const index = STEPS[kind].findIndex((entry) => entry.id === step);
  if (index < 0) return <Navigate to={stepUrl(kind, "") as never} replace />;
  if (!me?.signedIn)
    return (
      <Frame kind={kind} index={index} title={STEPS[kind][index]!.label}>
        <div className={styles.loading} aria-busy="true" />
      </Frame>
    );
  // Every later step needs the class step one makes.
  if (index > 0 && !me.familyClass)
    return <Navigate to={stepUrl(kind, "") as never} replace />;
  const props = { session, me, kind, index };
  if (index === 0)
    return kind === "parent" ? (
      <ChildrenStep {...props} />
    ) : (
      <StudentsStep {...props} />
    );
  const id = STEPS[kind][index]!.id;
  if (id === "practice" || id === "join") return <JoinStep {...props} />;
  if (id === "second-parent") return <SecondParentStep {...props} />;
  return <ReadyStep {...props} />;
}

type StepProps = {
  session: AuthSession;
  me: SignedInMe;
  kind: SetupKind;
  index: number;
};

/** One step of a parent's or tutor's setup, in the shared step frame. */
function Frame({
  kind,
  index,
  back = index === 0 ? "/start" : stepUrl(kind, STEPS[kind][index - 1]!.id),
  ...rest
}: Omit<Parameters<typeof StepFrame>[0], "steps" | "back"> & {
  kind: SetupKind;
  back?: string;
}) {
  return <StepFrame steps={STEPS[kind]} index={index} back={back} {...rest} />;
}

const why = (failure: unknown, fallback: string) => {
  console.error(fallback, failure);
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
};

/** Step one for a parent: each child's name (optional) and birth year,
 * adding or removing rows. Children already in the class are there too, and
 * their names can change here. */
function ChildrenStep({ session, me, kind, index }: StepProps) {
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
      await navigate({ href: stepUrl(kind, STEPS[kind][index + 1]!.id) });
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
      kind={kind}
      index={index}
      title="Your children"
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
function StudentsStep({ session, me, kind, index }: StepProps) {
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
      await navigate({ href: stepUrl(kind, STEPS[kind][index + 1]!.id) });
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
          return (
            <li key={row.key} className={styles.person}>
              <label className={styles.cell}>
                <span className={styles.cellLabel}>{field.label}</span>
                <input
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
              </label>
              <div className={styles.cell}>
                <span className={styles.cellLabel} aria-hidden="true">
                  Birth year
                </span>
                {row.fixed && !row.onYear ? (
                  <span className={styles.fixedYear}>{row.year || "—"}</span>
                ) : (
                  <YearField
                    label={`Birth year, ${row.label}`}
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
              <span className={styles.removeCell}>
                {row.onRemove && (
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${row.label}`}
                    disabled={disabled}
                    onClick={row.onRemove}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="m4 4 8 8m0-8-8 8" />
                    </svg>
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {add && (
        <Button
          type="button"
          variant="quiet"
          align="start"
          disabled={disabled}
          onClick={add.onAdd}
        >
          {add.label}
        </Button>
      )}
    </div>
  );
}

/** How the children practice: handed this device, or on their own with the
 * class code and three pictures. Cards print a QR for each child. */
function JoinStep({ session, me, kind, index }: StepProps) {
  const place = me.familyClass!;
  const presence = useQuery(
    presenceOptions(session, { org: place.orgId, class: place.classId }),
  );
  const code = presence.data?.class.joinCode;
  const first = me.learners[0]?.name;
  const parent = kind === "parent";
  return (
    <Frame
      kind={kind}
      index={index}
      title={parent ? "How they practice" : "How they join"}
      next={
        <Link
          to={stepUrl(kind, STEPS[kind][index + 1]!.id) as never}
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
          {code ? (
            <JoinClass
              code={code}
              place={{ org: place.orgId, class: place.classId }}
              family={parent}
            />
          ) : (
            <Loading />
          )}
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

/** Optional: the family's second parent, by email, or later from Family. */
function SecondParentStep({ session, kind, index }: StepProps) {
  const navigate = useNavigate();
  const current = useQuery(secondParentOptions(session));
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const following = stepUrl(kind, STEPS[kind][index + 1]!.id);
  const invited = current.data;
  const send = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      return setProblem("Enter their email address.");
    setBusy(true);
    try {
      await secondParent.invite(session, address);
      await navigate({ href: following });
    } catch (failure) {
      console.error("The invitation didn’t send", failure);
      setProblem(
        secondParentFailure(failure, "The invitation didn’t send. Try again."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      kind={kind}
      index={index}
      title="A second parent"
      lede="The other parent teaches the class with you, sees each child’s progress, and practices free."
      next={
        invited ? (
          <Link to={following as never} className={buttonClass("primary")}>
            Next
          </Link>
        ) : (
          <>
            <Link to={following as never} className={buttonClass("secondary")}>
              Later
            </Link>
            <Button
              variant="primary"
              type="submit"
              form="setup-second-parent"
              aria-busy={busy || undefined}
              disabled={busy}
            >
              Send invitation
            </Button>
          </>
        )
      }
    >
      {current.isPending ? (
        <div className={styles.loading} aria-busy="true" />
      ) : invited ? (
        <p className={styles.done}>
          {invited.status === "active"
            ? `${invited.name ?? "They"} joined your family.`
            : `Invitation sent to ${invited.emailHint}.`}
        </p>
      ) : (
        <form
          id="setup-second-parent"
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <TextField
            label="Their email"
            type="email"
            autoComplete="off"
            value={email}
            maxLength={254}
            error={problem}
            onChange={(event) => {
              setEmail(event.target.value);
              setProblem("");
            }}
          />
        </form>
      )}
    </Frame>
  );
}

/** The last step: the first child's first problem, right here, or Today. */
function ReadyStep({ session, me, kind, index }: StepProps) {
  const finish = useFinishSignIn();
  const place = me.familyClass!;
  const first = kind === "parent" ? me.learners[0] : undefined;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const today = todayUrl(place);
  const begin = async () => {
    if (!first || starting) return;
    setStarting(true);
    try {
      const grant = await request(
        `/family/learners/${first.id}/practice-here`,
        studentGrantResource,
        { token: session.token, body: {} },
      );
      await finish(grant, true, today);
    } catch (failure) {
      setError(why(failure, "Practice didn’t start. Try again in a moment."));
      setStarting(false);
    }
  };
  const canStart = !!first?.entitlement.active;
  return (
    <Frame
      kind={kind}
      index={index}
      title={canStart ? `${first!.name} is ready` : "Your class is ready"}
      lede={
        canStart
          ? `Hand ${first!.name} this device for their first problem, or open Today to see everyone.`
          : "Today shows each child, what they’re working on, and who needs you."
      }
      next={
        canStart ? (
          <>
            <Link to={today as never} className={buttonClass("secondary")}>
              Go to Today
            </Link>
            <Button
              variant="primary"
              aria-busy={starting || undefined}
              disabled={starting}
              onClick={() => void begin()}
            >
              Start {first!.name}’s first problem
            </Button>
          </>
        ) : (
          <Link to={today as never} className={buttonClass("primary")}>
            Go to Today
          </Link>
        )
      }
    >
      {kind === "parent" && me.learners.length > 0 && (
        <ul className={styles.list}>
          {me.learners.map((child) => (
            <li key={child.id}>
              <strong>{child.name}</strong>
              {child.birthYear ? <span>Born {child.birthYear}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

import { spaceWords } from "../../spaces/words";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState, type ReactNode } from "react";
import { create } from "zustand";
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
import { flush } from "../../../lib/analytics";
import { AppError } from "../../../lib/AppError";
import { invalidateAccount, meOptions, queryClient } from "../../../lib/query";
import { chosenPlan } from "../../../lib/pending-trial";
import { Button, buttonClass } from "../../../ui/Button";
import { YearField } from "../../../ui/YearField";
import { QueryBlock } from "../../../ui/QueryBlock";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { RowButton, RowList } from "../../../ui/RowList";
import { JoinClass } from "../../school/join/JoinClass";
import { Toast } from "../../../ui/Toast";
import { approvalsOptions } from "../../family-approval/api";
import { presenceOptions } from "../../school/classes/api";
import { finishingSignIn, useFinishSignIn } from "../../school/join/api";
import { useFinishSetup, useStartPlace } from "../starter-api";
import { setupOf } from "../guard";
import {
  setupSavesSettled,
  useAddKid,
  useKidYear,
  useRemoveKid,
  useRenameKid,
} from "./kids-api";
import { familyPlacesOptions } from "../../family/api";
import { DevicesSheet } from "../../family/Devices";
import { useFamilyPlaceOf } from "../../family/FamilyFrame";
import { StepFrame } from "./StepFrame";
import { setupStep } from "../activation";
import { RETIRED_STEPS, SETUP_STEPS, type SetupKind, type Step } from "./steps";
import styles from "./Setup.module.css";

/* A parent's or a tutor's first run (docs/product-model.md): a few calm steps,
   each its own URL. A parent: their kids, then who practices first, straight
   into that child's first problem; one child goes straight there. Nothing the
   law or a platform requires comes between (the restricted basis needs only
   the child's birth year: docs/parent-consent.md). Their name, their own
   devices and a second parent wait, optional, in Account, Today and People.
   A tutor's in-flight setup keeps its steps. */

export type { SetupKind } from "./steps";
const STEPS = SETUP_STEPS;

/** The steps of this setup. A parent's name is never one of them: it is
 * asked where it is shown, in Account. */
export function setupSteps(
  kind: SetupKind,
  _me?: Pick<SignedInMe, "account">,
): readonly Step[] {
  return STEPS[kind];
}
/** Every step id a setup's address may name; an old name-step link
 * (`/start/parent/name`) resolves to the setup's first step. */
export const setupStepIds = (kind: SetupKind): readonly string[] => [
  ...(kind === "parent" ? ["name"] : []),
  ...STEPS[kind].map((step) => step.id),
];
/** A step's address: the path names the step, and nothing else rides
 * along (no query string). */
export const stepUrl = (kind: SetupKind, id: string) =>
  id ? `/start/${kind}/${id}` : `/start/${kind}`;
const todayUrl = (place: { orgId: string; classId: string }) =>
  `/school/${place.orgId}/classes/${place.classId}/today`;
/** A family's Today, at its own address (a family's id is its org's). */
const familyToday = (place: { orgId: string }) => `/family/${place.orgId}`;

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

/** One step of a parent's or a tutor's setup. The URL is the step; the
 * route guard (`routeFor`) already sent any other address where it belongs,
 * so this only draws the step it names. */
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
  // The handoff remounts setup with the child's session before navigating to
  // practice. That child's /me has no familyClass; it is not an incomplete
  // parent setup and must not draw over the pending practice navigation.
  if (finishingSignIn()) return <LoadingScreen />;
  const index = Math.max(
    0,
    STEPS[kind].findIndex((entry) => entry.id === step),
  );
  if (!me?.signedIn)
    return (
      <StepFrame
        steps={STEPS[kind]}
        index={index}
        title={
          index === 0
            ? kind === "parent"
              ? "Add your kids"
              : "Your students"
            : ""
        }
        href={(id) => stepUrl(kind, id)}
      >
        <div className={styles.loading} aria-busy="true" />
      </StepFrame>
    );
  const steps = setupSteps(kind, me);
  const props = { session, me, kind, index, steps };
  if (index === 0)
    return kind === "parent" ? (
      <ChildrenStep {...props} />
    ) : (
      <StudentsStep {...props} />
    );
  if (steps[index]!.id === "join") return <JoinStep {...props} />;
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
export const nextUrl = ({ kind, index, steps }: StepProps) =>
  stepUrl(kind, steps[index + 1]!.id);

/** One step of a parent's or tutor's setup, in the shared step frame. */
function Frame({
  kind,
  ...rest
}: Omit<Parameters<typeof StepFrame>[0], "href"> & { kind: SetupKind }) {
  // A done step is a link to its own address, in the stepper.
  return <StepFrame href={(id) => stepUrl(kind, id)} {...rest} />;
}

const why = (failure: unknown, fallback: string) => {
  console.error(fallback, failure);
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
};

/** Each setup screen, measured once per tab: shown, by persona
 * (docs/engagement-measurement.md#activation-milestones). The persona is
 * also recorded by the server, once. */
const SETUP_EVENT_STEP = {
  parent: { "": "kids", ready: "ready", join: "join" },
  tutor: { "": "students", ready: "ready", join: "join" },
} as const;
const eventStep = (kind: SetupKind, steps: readonly Step[], index: number) =>
  SETUP_EVENT_STEP[kind][
    steps[index]!.id as keyof (typeof SETUP_EVENT_STEP)[SetupKind]
  ];
function useSetupView({ kind, steps, index }: StepProps) {
  const step = eventStep(kind, steps, index);
  useEffect(() => setupStep(step, "view", kind), [kind, step]);
}
const setupDone = ({ kind, steps, index }: StepProps) =>
  setupStep(eventStep(kind, steps, index), "complete", kind);

/** Hands this device to a child: their first problem opens here, and the
 * parent's view returns when they sign out. Setup's last step is done then,
 * and measured before the hand-off: a child's session measures nothing. */
function usePracticeHere(
  session: AuthSession,
  kind: SetupKind,
  /** Where the device returns when the child is done: known only once the
   * family exists, so read when the handoff starts. */
  today: () => Promise<string>,
) {
  const finish = useFinishSignIn();
  return async (learnerId: string) => {
    const grant = await request(
      `/family/learners/${learnerId}/practice-here`,
      studentGrantResource,
      { token: session.token, body: {} },
    );
    setupStep("ready", "complete", kind);
    flush(true);
    await finish(grant, true, await today(), undefined, learnerId);
  };
}

/** A saved child's Remove shows only where it will work: nothing yet in
 * their name, and another saved child stays (the family keeps one). */
export const canRemoveSaved = (
  child: { removable?: true },
  saved: number,
): boolean => !!child.removable && saved > 1;

/** A row being added: not a child until its birth year is chosen, when it is
 * saved. `id` is the child it became, until `/me` lists them. */
type FreshRow = { key: number; name: string; year: string; id?: string };

/** Step one for a parent: each child's name (optional) and birth year. The
 * kids are the server's, read from `/me`; every edit is a mutation, so Back,
 * Forward, a refresh and every other screen show the same kids. A new row
 * becomes a child when its year is chosen; a name is saved when its field is
 * left (and at Next); a year at once; Remove takes a child with nothing yet
 * in their name back out. What is typed but not yet saved is this screen's
 * own input, never a copy of the kids. */
function ChildrenStep(props: StepProps) {
  const { session, me, kind, index, steps } = props;
  useSetupView(props);
  const navigate = useNavigate();
  const practiceHere = usePracticeHere(session, kind, async () => {
    const fresh = await queryClient.fetchQuery({
      ...meOptions(session),
      staleTime: 0,
    });
    return fresh.signedIn && fresh.familyClass
      ? familyToday(fresh.familyClass)
      : "/";
  });
  const addKid = useAddKid(session);
  const renameKid = useRenameKid(session);
  const kidYear = useKidYear(session);
  const removeKid = useRemoveKid(session);
  const saved = me.learners;
  // Names typed into saved kids' fields, until saved.
  const [names, setNames] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<FreshRow[]>([]);
  const [saving, setSaving] = useState<Record<number, true>>({});
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [asked, setAsked] = useState(false);
  // A new row stays until `/me` lists the child it became: never shown twice,
  // never missing in between.
  const adding = fresh.filter(
    (row) => !row.id || !saved.some((child) => child.id === row.id),
  );
  // A family with no child yet starts with one empty row (key 0, so typing
  // into it keeps its field).
  const rows: FreshRow[] =
    adding.length || saved.length ? adding : [{ key: 0, name: "", year: "" }];
  const total = saved.length + rows.length;
  const nameOf = (child: (typeof saved)[number]) =>
    names[child.id] ?? (child.defaultName ? "" : child.name);
  let hint = "";
  let invalid = -1;
  for (const [at, name] of [
    ...saved.map(nameOf),
    ...rows.map((row) => row.name),
  ].entries()) {
    const problem = childNameProblem(name);
    if (problem) {
      hint = problem;
      invalid = at;
      break;
    }
  }
  // A row with a name and no year, or no child at all, still needs a year.
  // A row whose year is chosen is a child already, saved or being saved.
  const missingYear =
    (!saved.length && !rows.some((row) => row.year)) ||
    rows.some((row) => row.name.trim() && !row.year);
  const fail = (failure: unknown, fallback: string) =>
    setError(why(failure, fallback));
  const edit = (key: number, change: Partial<FreshRow>) =>
    setFresh((current) => {
      const base = current.length ? current : rows;
      return base.map((row) => (row.key === key ? { ...row, ...change } : row));
    });
  // Saved when its year is chosen; the first child also makes the family,
  // so the answer is recorded first (a parent sent here by a link).
  const create = async (row: FreshRow, year: string) => {
    edit(row.key, { year });
    if (childNameProblem(row.name)) return false;
    setSaving((current) => ({ ...current, [row.key]: true }));
    setError("");
    try {
      const setup = setupOf(me);
      const child = await addKid.mutateAsync({
        name: row.name,
        birthYear: Number(year),
        ...(!setup.done && setup.persona !== kind ? { answer: kind } : {}),
      });
      edit(row.key, { id: child.id });
      await invalidateAccount(session.accountId);
      return true;
    } catch (failure) {
      fail(failure, "That child wasn’t saved. Choose the year again.");
      edit(row.key, { year: "" });
      return false;
    } finally {
      setSaving(({ [row.key]: _, ...rest }) => rest);
    }
  };
  const commitName = async (child: (typeof saved)[number]) => {
    const name = names[child.id];
    if (name === undefined) return;
    const current = child.defaultName ? "" : child.name;
    if (name.trim() === current || childNameProblem(name)) return;
    await renameKid.mutateAsync({ id: child.id, name });
    setNames(({ [child.id]: _, ...rest }) => rest);
  };
  const next = async () => {
    if (missingYear) return setAsked(true);
    if (hint || leaving) return;
    // A tap while a save is in flight is never refused: Next shows it is
    // working, waits for the saves in the Query cache, then goes on. If one
    // failed, its own message is up and the step stays.
    setLeaving(true);
    setError("");
    try {
      // Rows already being saved finish on their own; a row whose year was
      // chosen while its name still needed fixing is saved now.
      const unsaved = rows.filter(
        (row) => row.year && !row.id && !saving[row.key],
      );
      if (!(await setupSavesSettled(queryClient, session))) return;
      for (const child of saved) await commitName(child);
      for (const row of unsaved) if (!(await create(row, row.year))) return;
      // The kids as they are now, every save included.
      const latest = await queryClient.fetchQuery({
        ...meOptions(session),
        staleTime: 0,
      });
      const kids = latest.signedIn ? latest.learners : saved;
      setupDone(props);
      // A plan chosen on the pitch before signing up opens for the first
      // child; setup's next steps wait on Today.
      const plan = chosenPlan();
      const first = kids[0]!;
      if (plan) {
        await navigate({
          to: "/continue/$learnerId",
          params: { learnerId: first.id },
          search: { interval: plan },
        });
        return;
      }
      // One child practices first by default: their first problem opens
      // now, with no "Who's practicing first?" to answer. If it can't (no
      // access yet), that step says why.
      if (kids.length === 1 && !setupOf(me).done) {
        try {
          await practiceHere(first.id);
          return;
        } catch (failure) {
          console.error("The first child's practice didn't open", failure);
        }
      }
      await navigate({ to: nextUrl(props) as never });
    } catch (failure) {
      fail(failure, "That didn’t save. Check your connection and try again.");
    } finally {
      setLeaving(false);
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
          aria-busy={leaving || undefined}
          data-waiting={missingYear || !!hint || undefined}
          disabled={leaving}
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
        disabled={leaving}
        rows={[
          ...saved.map((child, at) => ({
            key: child.id,
            // A child who goes by their number keeps that number.
            label: child.defaultName ? child.name : `Child ${at + 1}`,
            name: nameOf(child),
            year: child.birthYear ? String(child.birthYear) : "",
            fixed: true,
            onName: (name: string) =>
              setNames((current) => ({ ...current, [child.id]: name })),
            onCommit: () =>
              void commitName(child).catch((failure) =>
                fail(failure, "That name didn’t save. Try again."),
              ),
            onYear: (value: string) =>
              kidYear.mutate(
                { id: child.id, birthYear: Number(value) },
                {
                  onError: (failure) =>
                    fail(failure, "That year didn’t save. Choose it again."),
                },
              ),
            onRemove: canRemoveSaved(child, saved.length)
              ? () =>
                  removeKid.mutate(child.id, {
                    onError: (failure) =>
                      fail(failure, "That child wasn’t removed. Try again."),
                  })
              : undefined,
          })),
          ...rows.map((row, at) => ({
            key: `new-${row.key}`,
            label: `Child ${saved.length + at + 1}`,
            name: row.name,
            year: row.year,
            busy: !!saving[row.key],
            onName: (name: string) => edit(row.key, { name }),
            onYear: (year: string) => void create(row, year),
            onRemove:
              total > 1
                ? () =>
                    setFresh(adding.filter((other) => other.key !== row.key))
                : undefined,
          })),
        ]}
        add={
          total < 6
            ? {
                label: "Add a child",
                onAdd: () =>
                  setFresh([...rows, { key: Date.now(), name: "", year: "" }]),
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
  useSetupView(props);
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
      setupDone(props);
      draft.set(session.accountId, { rows: [] });
      await navigate({ to: nextUrl(props) as never });
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
  /** Already saved: Remove only when the row takes `onRemove`. Its year
   * shows, and can be corrected when the row takes `onYear`. */
  fixed?: boolean;
  onName: (name: string) => void;
  /** The name field was left: save what was typed. */
  onCommit?: () => void;
  onYear?: (year: string) => void;
  onRemove?: () => void;
  /** This row is being saved. */
  busy?: boolean;
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
              disabled={disabled || !!row.busy}
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
                  disabled={disabled || row.busy}
                  onChange={(event) => row.onName(event.target.value)}
                  onBlur={row.onCommit}
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
                    label={`Birth year, ${row.name.trim() || row.label}`}
                    earlier
                    placeholder="Choose"
                    value={row.year}
                    disabled={disabled || row.busy}
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
  useSetupView(props);
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
          onClick={() => setupDone(props)}
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
            {(data) =>
              // A family's class always has its code (no practice gate).
              data.class.joinCode && (
                <JoinClass
                  code={data.class.joinCode}
                  place={{ org: place.orgId, class: place.classId }}
                  words={spaceWords(parent ? "family" : "classroom")}
                />
              )
            }
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
  useSetupView(props);
  const place = me.familyClass!;
  const parent = kind === "parent";
  const children = parent ? me.learners : [];
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [devices, setDevices] = useSearchFlag("devices");
  const today = parent ? familyToday(place) : todayUrl(place);
  const practiceHere = usePracticeHere(session, kind, async () => today);
  const begin = async (learnerId: string) => {
    if (starting) return;
    setStarting(learnerId);
    try {
      await practiceHere(learnerId);
    } catch (failure) {
      setError(why(failure, "Practice didn’t start. Try again in a moment."));
      setStarting(null);
    }
  };
  const ready = children.filter((child) => child.entitlement.active);
  // Going to Today ends the first run (`me.setup`); a failure to record that
  // is logged and never keeps anyone here.
  const navigate = useNavigate();
  const finish = useFinishSetup(session);
  const [leaving, setLeaving] = useState(false);
  const toToday = (
    <Button
      variant={parent && ready.length ? "secondary" : "primary"}
      aria-busy={leaving || undefined}
      disabled={leaving}
      onClick={async () => {
        setLeaving(true);
        setupDone(props);
        try {
          await finish.mutateAsync(kind);
        } catch (failure) {
          console.error("The first run wasn't marked done", failure);
        }
        await navigate({ to: today as never });
      }}
    >
      Go to Today
    </Button>
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
        {/* The shortcut to the children's own devices: the same sheet as
            Today's, ready before any practice. */}
        <RowList label="Other ways to practice">
          <RowButton
            title="On their own devices"
            data-own-devices=""
            onClick={() => setDevices(true)}
          />
        </RowList>
        <SetupDevices
          session={session}
          place={place}
          open={devices}
          onOpenChange={setDevices}
        />
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

/** A boolean address key (`?devices=1`): an opened sheet is a history
 * entry, so Back closes it and a refresh keeps it open. */
function useSearchFlag(key: string) {
  const navigate = useNavigate();
  const on = useLocation({
    select: (location) => {
      const value = (location.search as Record<string, unknown>)[key];
      return value === 1 || value === "1";
    },
  });
  const set = (open: boolean) =>
    void navigate({
      to: ".",
      search: ((current: Record<string, unknown>) => {
        const next = { ...current };
        if (open) next[key] = 1;
        else delete next[key];
        return next;
      }) as never,
      replace: !open,
    });
  return [on, set] as const;
}

/** "Their own devices" from setup: the family's own sheet, for the family
 * this parent holds. */
function SetupDevices({
  session,
  place,
  open,
  onOpenChange,
}: {
  session: AuthSession;
  place: { orgId: string; classId: string; className: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const places = useQuery(familyPlacesOptions(session));
  const family =
    places.data?.families.find((entry) => entry.role === "holder")?.familyId ??
    "";
  const found = useFamilyPlaceOf(family);
  return (
    <DevicesSheet
      place={{
        ...found,
        own: found.own ?? {
          id: place.classId,
          org: place.orgId,
          name: place.className,
        },
      }}
      classId={place.classId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

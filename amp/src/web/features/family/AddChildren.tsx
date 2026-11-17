import { useQuery } from "@tanstack/react-query";
import { useSession, useSessionOrNull } from "../../lib/session";
import { useEffect, useRef, useState } from "react";
import type { SignedInMe } from "../../../account/contracts";
import {
  CHILD_NAME_MAX,
  childNameProblem,
  PARENT_ENTRY_LINE,
} from "../../../learning/nickname";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { invalidateAccount, meOptions, queryClient } from "../../lib/query";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { Toast } from "../../ui/Toast";
import type { Persona } from "../onboarding/activation";
import {
  setupSavesSettled,
  useAddKid,
  useKidYear,
  useRemoveKid,
  useRenameKid,
} from "../onboarding/setup/kids-api";
import { People, type Row } from "../onboarding/setup/PeopleRows";
import setup from "../onboarding/setup/Setup.module.css";
import styles from "./Family.module.css";

/*
 * Adding a family's children (docs/product-model.md): a row each, a name
 * (optional) and a birth year. A row becomes a child when its year is
 * chosen; a name is saved when its field is left; a child with nothing yet
 * in their name can be taken back out. Every save is one of the shared
 * mutations (onboarding/setup/kids-api), which invalidate the account, so
 * `/me`, the family, Today and Settings all show the change. No route
 * knowledge: setup's first step and the sheet over a family's screens both
 * compose it.
 */

/** A saved child's Remove shows only where it will work: nothing yet in
 * their name, and another saved child stays (the family keeps one). */
export const canRemoveSaved = (
  child: { removable?: true },
  saved: number,
): boolean => !!child.removable && saved > 1;

/** A row being added: not a child until its birth year is chosen, when it is
 * saved. `id` is the child it became, until `/me` lists them. */
type FreshRow = { key: number; name: string; year: string; id?: string };

const why = (failure: unknown, fallback: string) => {
  console.error(fallback, failure);
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
};

/**
 * The rows and their saves. `saved`: the family's children show as rows
 * too (setup's step), else only the rows being added (the sheet). `answer`:
 * the first run's answer, recorded with the first child when it makes the
 * family.
 */
export function useChildrenEditor(
  session: AuthSession,
  me: SignedInMe,
  options: { saved: boolean; answer?: Persona },
) {
  const addKid = useAddKid(session);
  const renameKid = useRenameKid(session);
  const kidYear = useKidYear(session);
  const removeKid = useRemoveKid(session);
  const saved = options.saved ? me.learners : [];
  const known = me.learners;
  // Names typed into saved kids' fields, until saved.
  const [names, setNames] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<FreshRow[]>([]);
  const [saving, setSaving] = useState<Record<number, true>>({});
  const [error, setError] = useState("");
  // A new row stays until `/me` lists the child it became: never shown twice,
  // never missing in between. In the sheet, the child it became stays a
  // row, saved, so the parent sees it was.
  const adding = fresh.filter(
    (row) =>
      !row.id || !options.saved || !known.some((child) => child.id === row.id),
  );
  // Nothing yet to add: one empty row (key 0, so typing into it keeps its
  // field).
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
  const missingYear =
    (!saved.length && !rows.some((row) => row.year)) ||
    rows.some((row) => row.name.trim() && !row.year);
  const reportFailure = (failure: unknown, fallback: string) =>
    setError(why(failure, fallback));
  const edit = (key: number, change: Partial<FreshRow>) =>
    setFresh((current) => {
      const base = current.length ? current : rows;
      return base.map((row) => (row.key === key ? { ...row, ...change } : row));
    });
  const create = async (row: FreshRow, year: string) => {
    edit(row.key, { year });
    if (childNameProblem(row.name)) return false;
    setSaving((current) => ({ ...current, [row.key]: true }));
    setError("");
    try {
      const child = await addKid.mutateAsync({
        name: row.name,
        birthYear: Number(year),
        ...(options.answer ? { answer: options.answer } : {}),
      });
      edit(row.key, { id: child.id });
      await invalidateAccount(session.accountId);
      return true;
    } catch (failure) {
      reportFailure(failure, "That child wasn’t saved. Choose the year again.");
      edit(row.key, { year: "" });
      return false;
    } finally {
      setSaving(({ [row.key]: _, ...rest }) => rest);
    }
  };
  /** A typed name worth saving: changed, and a name AMP takes. */
  const renameOf = (child: (typeof known)[number], name?: string) => {
    if (name === undefined) return undefined;
    const current = child.defaultName ? "" : child.name;
    return name.trim() === current || childNameProblem(name) ? undefined : name;
  };
  const commitName = async (child: (typeof known)[number]) => {
    const name = renameOf(child, names[child.id]);
    if (name === undefined) return;
    await renameKid.mutateAsync({ id: child.id, name });
    setNames(({ [child.id]: _, ...rest }) => rest);
  };
  // A name typed and not yet saved is saved when the screen goes, as when
  // its field is left: Back, Forward or a link leave no field behind.
  const unsaved = useRef(() => {});
  unsaved.current = () => {
    for (const child of known) {
      const name = renameOf(child, names[child.id]);
      if (name !== undefined)
        renameKid.mutate(
          { id: child.id, name },
          {
            onError: (failure) =>
              console.error("A name typed before leaving didn’t save", failure),
          },
        );
    }
  };
  useEffect(() => () => unsaved.current(), []);
  /** Every row saved: waits for saves in flight (a tap is never refused
   * while one finishes), then saves names typed and rows whose year was
   * chosen while their name still needed fixing. False if one failed (its
   * own message is up). */
  const settle = async () => {
    const unsaved = rows.filter(
      (row) => row.year && !row.id && !saving[row.key],
    );
    if (!(await setupSavesSettled(queryClient, session))) return false;
    for (const child of saved) await commitName(child);
    for (const row of unsaved) if (!(await create(row, row.year))) return false;
    return true;
  };
  let pending = 0;
  const people: Row[] = [
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
          reportFailure(failure, "That name didn’t save. Try again."),
        ),
      onYear: (value: string) =>
        kidYear.mutate(
          { id: child.id, birthYear: Number(value) },
          {
            onError: (failure) =>
              reportFailure(failure, "That year didn’t save. Choose it again."),
          },
        ),
      onRemove: canRemoveSaved(child, saved.length)
        ? () =>
            removeKid.mutate(child.id, {
              onError: (failure) =>
                reportFailure(failure, "That child wasn’t removed. Try again."),
            })
        : undefined,
    })),
    ...rows.map((row) => {
      const became = row.id
        ? known.find((child) => child.id === row.id)
        : undefined;
      // What they go by if the name stays blank: a saved child's own
      // ("Child 3"), else the number they will take.
      if (!became) pending++;
      return {
        key: `new-${row.key}`,
        label: became ? became.name : `Child ${known.length + pending}`,
        name: row.name,
        year: row.year,
        busy: !!saving[row.key],
        // Saved in the sheet: its year stays as chosen; a name is a rename.
        ...(became
          ? {
              fixed: true,
              onName: (name: string) => {
                edit(row.key, { name });
                setNames((current) => ({ ...current, [became.id]: name }));
              },
              onCommit: () =>
                void commitName(became).catch((failure) =>
                  reportFailure(failure, "That name didn’t save. Try again."),
                ),
              onRemove: became.removable
                ? () =>
                    removeKid.mutate(became.id, {
                      onSuccess: () =>
                        setFresh((current) =>
                          (current.length ? current : rows).filter(
                            (other) => other.key !== row.key,
                          ),
                        ),
                      onError: (failure) =>
                        reportFailure(
                          failure,
                          "That child wasn’t removed. Try again.",
                        ),
                    })
                : undefined,
            }
          : {
              onName: (name: string) => edit(row.key, { name }),
              onYear: (year: string) => void create(row, year),
              onRemove:
                total > 1
                  ? () =>
                      setFresh(adding.filter((other) => other.key !== row.key))
                  : undefined,
            }),
      };
    }),
  ];
  return {
    people,
    hint,
    invalid,
    missingYear,
    total,
    error,
    setError,
    settle,
    add: () => setFresh([...rows, { key: Date.now(), name: "", year: "" }]),
  };
}
export type ChildrenEditor = ReturnType<typeof useChildrenEditor>;

/** The rows, their add, the basis line and their errors: the capability,
 * drawn wherever it is composed. */
export function AddChildren({
  editor,
  asked,
  disabled,
}: {
  editor: ChildrenEditor;
  /** Show "Choose a year" at each row without one (a finish was asked). */
  asked: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <People
        nameNote={editor.hint}
        missingYear={asked}
        field={{
          label: "Name",
          placeholder: "First name or nickname",
          max: CHILD_NAME_MAX,
        }}
        invalid={editor.invalid}
        disabled={disabled}
        rows={editor.people}
        add={
          editor.total < 6 ? { label: "Add a child", onAdd: editor.add } : null
        }
      />
      <p className={setup.basis}>{PARENT_ENTRY_LINE}</p>
      <Toast message={editor.error} onDismiss={() => editor.setError("")} />
    </>
  );
}

/**
 * "Add a child", over the screen it was asked from (a family's Settings,
 * Today, Progress): the same rows as setup's first step. Done saves what is
 * left and closes; ✕ closes. The children it saved are already in the
 * family (the account's invalidation), so the screen behind shows them.
 * No address of its own: closing is the same screen, where it was.
 */
export function AddChildrenSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useSessionOrNull();
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a child">
      {/* Mounted while open only: each opening starts with one empty row. */}
      {open && session && me?.signedIn ? (
        <AddChildrenBody me={me} onDone={() => onOpenChange(false)} />
      ) : null}
    </Sheet>
  );
}

function AddChildrenBody({
  me,
  onDone,
}: {
  me: SignedInMe;
  onDone: () => void;
}) {
  // Signed in: the sheet opens this only then.
  const session = useSession();
  const editor = useChildrenEditor(session, me, { saved: false });
  const [asked, setAsked] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const done = async () => {
    // Nothing typed: nothing to save.
    const typed = editor.people.some((row) => row.name.trim() || row.year);
    if (!typed) return onDone();
    if (editor.missingYear) return setAsked(true);
    if (editor.hint) return;
    setFinishing(true);
    try {
      if (await editor.settle()) onDone();
    } finally {
      setFinishing(false);
    }
  };
  return (
    <div className={styles.addChildren} data-add-children="">
      <AddChildren editor={editor} asked={asked} disabled={finishing} />
      <div className={styles.formActions}>
        <Button
          variant="primary"
          aria-busy={finishing || undefined}
          disabled={finishing}
          onClick={() => void done()}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

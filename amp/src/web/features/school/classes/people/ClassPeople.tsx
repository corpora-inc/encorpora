import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { ApprovalRowResource } from "../../../../../family/approval-contracts";
import type { AuthSession } from "../../../../auth";
import { useLoggedError } from "../../../../feedback";
import { Button } from "../../../../ui/Button";
import { Toast } from "../../../../ui/Toast";
import { approvalsOptions } from "../../../family-approval/api";
import {
  SecondParentInviteSheet,
  SecondParentRow,
} from "../../../second-parent/SecondParent";
import { secondParentOptions } from "../../../second-parent/api";
import { CoTeacherInviteSheet, CoTeacherRows } from "../CoTeachers";
import { staffOptions } from "../../api";
import { Loading } from "../../../../ui/Loading";
import family from "../Family.module.css";
import {
  OtherFamilyAccessSheet,
  OtherFamilyAddSheet,
  OtherFamilyRow,
} from "../OtherFamilies";
import styles from "./People.module.css";

type Open =
  | { kind: "second-parent" }
  | { kind: "co-teacher" }
  | { kind: "other-family"; personId?: string; name?: string }
  | { kind: "access"; row: ApprovalRowResource };

/** "+ Add …": a quiet action at the foot of a list. */
function AddAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3v10M3 8h10" />
      </svg>
      {children}
    </button>
  );
}

/** A labelled list of people with its one way to add another. */
function PeopleList({
  id,
  title,
  lead,
  rows,
  actions,
}: {
  id: string;
  title: string;
  /** What belongs here, while nobody does yet. */
  lead?: string;
  rows: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className={styles.list} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
      <ul className={`${family.children} ${styles.rows}`}>{rows}</ul>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}

/** The family's other people, for its account holder (docs/families.md):
 * grown-ups who teach the class with them (the second parent, co-teachers)
 * and children from other families, each with where they stand and the way
 * to add one. They live with the children on People, not on Today. */
export function ClassPeople({
  session,
  orgId,
  classId,
}: {
  session: AuthSession;
  orgId: string;
  classId: string;
}) {
  const second = useQuery(secondParentOptions(session));
  const others = useQuery(approvalsOptions(session));
  // The co-teachers' rows read the class's staff (CoTeacherRows).
  const staff = useQuery(staffOptions(session, orgId));
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState("");
  useLoggedError(error);
  const close = () => setOpen(null);
  const rows = others.data ?? [];
  const grownUps = !!second.data;
  // Each list's rows, lead and actions depend on what loads; drawn before it
  // has, the actions would move as rows and leads arrive. One wait instead.
  if (second.isPending || others.isPending || staff.isPending)
    return (
      <div className={styles.people}>
        <Loading>Loading the class’s people</Loading>
      </div>
    );
  return (
    <div className={styles.people}>
      <div className={styles.lists}>
        <PeopleList
          id="people-grown-ups"
          title="Grown-ups"
          lead={
            second.isSuccess && !grownUps
              ? "A second parent or a co-teacher sees the class and can let a child practice on their device."
              : undefined
          }
          rows={
            <>
              {second.isError && (
                <ListFailed
                  what="The second parent"
                  onRetry={() => void second.refetch()}
                />
              )}
              {second.data && (
                <SecondParentRow
                  session={session}
                  parent={second.data}
                  onError={setError}
                />
              )}
              <CoTeacherRows
                session={session}
                orgId={orgId}
                onError={setError}
              />
            </>
          }
          actions={
            <>
              {/* One second parent per family: once invited, the row is it. */}
              {second.isSuccess && !second.data && (
                <AddAction onClick={() => setOpen({ kind: "second-parent" })}>
                  Add a second parent
                </AddAction>
              )}
              <AddAction onClick={() => setOpen({ kind: "co-teacher" })}>
                Invite a co-teacher
              </AddAction>
            </>
          }
        />
        <PeopleList
          id="people-other-families"
          title="From other families"
          lead={
            others.isSuccess && !rows.length
              ? "A child from another family joins once their parent approves by email."
              : undefined
          }
          rows={[
            others.isError && (
              <ListFailed
                key="failed"
                what="Children from other families"
                onRetry={() => void others.refetch()}
              />
            ),
            ...rows.map((row) => (
              <OtherFamilyRow
                key={row.id}
                row={row}
                session={session}
                onAccess={() => setOpen({ kind: "access", row })}
                onSend={() =>
                  setOpen({
                    kind: "other-family",
                    personId: row.personId,
                    name: row.name,
                  })
                }
                onError={setError}
              />
            )),
          ]}
          actions={
            <AddAction onClick={() => setOpen({ kind: "other-family" })}>
              Add a child from another family
            </AddAction>
          }
        />
      </div>
      {open?.kind === "second-parent" && (
        <SecondParentInviteSheet session={session} onClose={close} />
      )}
      {open?.kind === "co-teacher" && (
        <CoTeacherInviteSheet
          session={session}
          orgId={orgId}
          classId={classId}
          onClose={close}
        />
      )}
      {open?.kind === "other-family" && (
        <OtherFamilyAddSheet
          session={session}
          rows={rows}
          student={open.personId ? open : undefined}
          onClose={close}
        />
      )}
      {open?.kind === "access" && (
        <OtherFamilyAccessSheet row={open.row} onClose={close} />
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}

/** A list that didn't load says so in its place, with the way to try again;
 * the rest of the page stays. */
function ListFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <li className={styles.failed}>
      <span role="alert">{what} didn’t load.</span>
      <Button variant="quiet" onClick={onRetry}>
        Try again
      </Button>
    </li>
  );
}

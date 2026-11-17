import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Toast } from "../../ui/Toast";
import { approvalsOptions } from "../family-approval/api";
import {
  CoTeacherInviteSheet,
  CoTeacherRows,
} from "../school/classes/CoTeachers";
import {
  OtherFamilyAccessSheet,
  OtherFamilyAddSheet,
  OtherFamilyRow,
} from "../school/classes/OtherFamilies";
import { lastPracticed } from "../school/classes/today/ChildRow";
import rowStyles from "../school/classes/Family.module.css";
import people from "../school/classes/people/People.module.css";
import type { ApprovalRowResource } from "../../../family/approval-contracts";
import { familyTeachingOptions } from "./api";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

/** "+ Add …": a quiet action at the foot of a list, as on a class's
 * People. */
export function AddAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={people.add} onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3v10M3 8h10" />
      </svg>
      {children}
    </button>
  );
}

type Open =
  | { kind: "co-teacher" }
  | { kind: "other-family"; personId?: string; name?: string }
  | { kind: "access"; row: ApprovalRowResource };

/**
 * A tutoring group (`/family/<family>/group`): a family's class that also
 * holds other families' children, as a teaching place of its own. The whole
 * group in a classroom's words, with each other family's approval, and the
 * co-teachers. Its children are never mixed into the family's own screens.
 */
export function TutoringGroupScreen() {
  const place = useFamilyPlace();
  const { data, session, family } = place;
  const group = !!data?.teachingPlace;
  const teaching = useQuery({
    ...familyTeachingOptions(session, family),
    enabled: group,
  });
  const can = teaching.data?.capabilities;
  const others = useQuery({
    ...approvalsOptions(session),
    enabled: !!can?.readApprovals,
  });
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState("");
  const close = () => setOpen(null);
  if (data && !group)
    return (
      <FamilyFrame place={place}>
        <EmptyState
          title="There’s no tutoring group here"
          action={
            <Link
              to="/$"
              params={{ _splat: familyHref(family) }}
              className={buttonClass("primary")}
            >
              Open Today
            </Link>
          }
        >
          A tutoring group appears when a child from another family joins with
          their parent’s approval.
        </EmptyState>
      </FamilyFrame>
    );
  const t = teaching.data;
  const rows = others.data ?? [];
  return (
    <FamilyFrame place={place} loading={group && teaching.isPending}>
      {t ? (
        <div className={styles.page} data-tutoring-group="">
          <header className={styles.head}>
            <h1>{t.class.name}</h1>
          </header>
          {/* One list: each student once, another family's child with where
              their parent's approval stands and its one action. */}
          <section className={people.list} aria-labelledby="group-students">
            <h2 id="group-students" className={people.title}>
              Students
            </h2>
            <ul className={`${rowStyles.children} ${people.rows}`}>
              {others.isError && (
                <li>
                  <span role="alert">Approvals didn’t load. </span>
                  <Button variant="quiet" onClick={() => void others.refetch()}>
                    Try again
                  </Button>
                </li>
              )}
              {t.students.map((student) => {
                const row = rows.find((entry) => entry.personId === student.id);
                return row ? (
                  <OtherFamilyRow
                    offerTalk={false}
                    key={student.id}
                    row={row}
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
                ) : (
                  <li key={student.id} className={rowStyles.child}>
                    <span className={rowStyles.who}>
                      <span className={rowStyles.name}>{student.name}</span>
                      <span className={rowStyles.access}>
                        {student.lastActive
                          ? `${student.weekMinutes} min this week · last practiced ${lastPracticed(student.lastActive, t.today.date)}`
                          : "Not started"}
                      </span>
                    </span>
                  </li>
                );
              })}
              {/* Invited, not yet in the group. */}
              {rows
                .filter(
                  (row) =>
                    !t.students.some((student) => student.id === row.personId),
                )
                .map((row) => (
                  <OtherFamilyRow
                    offerTalk={false}
                    key={row.id}
                    row={row}
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
                ))}
            </ul>
            {can?.manageApprovals && (
              <div className={people.actions}>
                <AddAction onClick={() => setOpen({ kind: "other-family" })}>
                  Add a child from another family
                </AddAction>
              </div>
            )}
          </section>
          {can?.readStaff && (
            <section className={people.list} aria-labelledby="group-teachers">
              <h2 id="group-teachers" className={people.title}>
                Co-teachers
              </h2>
              <ul className={`${rowStyles.children} ${people.rows}`}>
                <CoTeacherRows
                  orgId={t?.class.orgId ?? family}
                  onError={setError}
                />
              </ul>
              {can.manageStaff && (
                <div className={people.actions}>
                  <AddAction onClick={() => setOpen({ kind: "co-teacher" })}>
                    Invite a co-teacher
                  </AddAction>
                </div>
              )}
            </section>
          )}
          {open?.kind === "co-teacher" && (
            <CoTeacherInviteSheet
              orgId={t?.class.orgId ?? family}
              classId={t.class.id}
              onClose={close}
            />
          )}
          {open?.kind === "other-family" && (
            <OtherFamilyAddSheet
              rows={rows}
              student={open.personId ? open : undefined}
              onClose={close}
            />
          )}
          {open?.kind === "access" && (
            <OtherFamilyAccessSheet row={open.row} onClose={close} />
          )}
        </div>
      ) : teaching.isError ? (
        <EmptyState
          title="The tutoring group didn’t load"
          action={
            <Button variant="primary" onClick={() => void teaching.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : null}
      <Toast message={error} onDismiss={() => setError("")} />
    </FamilyFrame>
  );
}

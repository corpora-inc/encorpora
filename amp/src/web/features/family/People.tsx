import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { formatDay } from "../../../schools/calendar";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { RowLink, RowList } from "../../ui/RowList";
import { ScreenTitle } from "../../ui/ScreenTitle";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { approvalsOptions } from "../family-approval/api";
import { calendarOptions, orgOptions } from "../school/api";
import { EditSheet } from "../school/CalendarScreen";
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
import { secondParentOptions } from "../second-parent/api";
import {
  SecondParentInviteSheet,
  SecondParentRow,
} from "../second-parent/SecondParent";
import type { ApprovalRowResource } from "../../../family/approval-contracts";
import { familyTeachingOptions, saveProfile } from "./api";
import { AddKidsSheet } from "./AddKids";
import { DevicesSheet } from "./Devices";
import {
  FamilyFrame,
  familyHref,
  useFamilyPlace,
  type FamilyPlace,
} from "./FamilyFrame";
import styles from "./Family.module.css";

/** A boolean address key (`?devices=1`), and the way to set it: an opened
 * sheet is a history entry, so Back closes it. */
function useFlag(key: string) {
  const navigate = useNavigate();
  const on = useRouterState({
    select: (state) => {
      const value = (state.location.search as Record<string, unknown>)[key];
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

/** "+ Add …": a quiet action at the foot of a list, as on a class's
 * People. */
function AddAction({
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

/**
 * The adult's own name, as the other parent, an approving parent and an
 * invitation show it. Asked once, quietly, where it's missing.
 */
function YourName({ place }: { place: FamilyPlace }) {
  const { me, session } = place;
  const account = me?.account;
  const known = account?.displayName ?? null;
  const [editing, setEditing] = useState(false);
  const [given, setGiven] = useState(account?.givenName ?? "");
  const [family, setFamily] = useState(account?.familyName ?? "");
  const [errors, setErrors] = useState<{ given?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const start = () => {
    // A name from before given and family names were asked: split it once.
    const [first = "", ...rest] = (known ?? "").split(" ");
    setGiven(account?.givenName ?? first);
    setFamily(account?.familyName ?? rest.join(" "));
    setErrors({});
    setEditing(true);
  };
  const save = async () => {
    const first = given.trim();
    if (!first) return setErrors({ given: "Enter your first name." });
    setBusy(true);
    try {
      await saveProfile(session, {
        givenName: first,
        familyName: family.trim() || null,
      });
      setEditing(false);
      setNotice("Your name is saved.");
    } catch (failure) {
      console.error("The adult’s name didn’t save", failure);
      setError("Your name didn’t save. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.setting} data-your-name={known ? "" : "missing"}>
      {editing ? (
        <form
          className={styles.form}
          style={{ gridColumn: "1 / -1" }}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField
            label="First name"
            autoComplete="given-name"
            value={given}
            maxLength={100}
            error={errors.given}
            autoFocus
            disabled={busy}
            onChange={(event) => {
              setGiven(event.target.value);
              setErrors({});
            }}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            value={family}
            maxLength={100}
            disabled={busy}
            onChange={(event) => setFamily(event.target.value)}
          />
          <div className={styles.formActions}>
            <Button
              variant="primary"
              disabled={busy}
              aria-busy={busy || undefined}
            >
              Save name
            </Button>
            <Button
              variant="quiet"
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.settingText}>
            <dt>{known ?? "Your name"}</dt>
            <dd>
              {known
                ? "You. Other parents see this name."
                : "Other parents see it when you invite them."}
            </dd>
          </div>
          <div className={styles.settingAction}>
            <Button variant="secondary" onClick={start}>
              {known ? "Change" : "Add your name"}
            </Button>
          </div>
        </>
      )}
      <Toast
        message={notice || error}
        onDismiss={() => (setNotice(""), setError(""))}
      />
    </div>
  );
}

/** The holder's side of People: the second parent, invited, waiting or
 * there, with the one action that works now. */
function SecondParentSection({ place }: { place: FamilyPlace }) {
  const { session, data } = place;
  const manage = !!data?.capabilities.manageSecondParent;
  const invite = !!data?.capabilities.inviteSecondParent;
  const second = useQuery({ ...secondParentOptions(session), enabled: manage });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  if (!manage && !invite) return null;
  return (
    <section className={people.list} aria-labelledby="people-second">
      <h2 id="people-second" className={people.title}>
        Second parent
      </h2>
      {second.isSuccess && !second.data && (
        <p className={people.lead}>
          The other parent sees each child’s progress, lets them practice here
          and practices free.
        </p>
      )}
      <ul className={`${rowStyles.children} ${people.rows}`}>
        {second.isPending && manage ? (
          <li className={`amp-skeleton ${rowStyles.reserve}`} aria-busy="true">
            <span />
          </li>
        ) : second.isError ? (
          <li>
            <span role="alert">The second parent didn’t load. </span>
            <Button variant="quiet" onClick={() => void second.refetch()}>
              Try again
            </Button>
          </li>
        ) : second.data ? (
          <SecondParentRow
            session={session}
            parent={second.data}
            onError={setError}
          />
        ) : null}
      </ul>
      {invite && second.isSuccess && !second.data && (
        <div className={people.actions}>
          <AddAction onClick={() => setInviting(true)}>
            Add a second parent
          </AddAction>
        </div>
      )}
      {inviting && (
        <SecondParentInviteSheet
          session={session}
          onClose={() => setInviting(false)}
        />
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}

/**
 * People (`/family/<family>/people`): the family's parents. The account
 * holder's own name and the second parent, invited or there. A second parent
 * reads what she can do here and what the holder looks after. Never a roster,
 * a class code or a co-teacher: children are on Today, their own devices are
 * a sheet.
 */
export function FamilyPeopleScreen() {
  const place = useFamilyPlace();
  const { data, me, family } = place;
  const [devices, setDevices] = useFlag("devices");
  const manageDevices = !!data?.children.some(
    (child) => child.capabilities.manageDevices,
  );
  const second = data?.role === "second-parent";
  const ownPractice = !!me?.adultPractice?.learner;
  const startPractice = !ownPractice && me?.adultPractice?.eligible === true;
  return (
    <FamilyFrame place={place} narrow>
      {data && (
        <div className={styles.page} data-family-people="">
          <ScreenTitle>People</ScreenTitle>
          <section className={people.list} aria-labelledby="people-you">
            <h2 id="people-you" className={people.title}>
              You
            </h2>
            <dl className={styles.settings}>
              <YourName place={place} />
            </dl>
          </section>
          {second ? (
            <section className={people.list} aria-labelledby="people-family">
              <h2 id="people-family" className={people.title}>
                In {data.displayName}
              </h2>
              <dl className={styles.settings}>
                <div className={styles.setting}>
                  <div className={styles.settingText}>
                    <dt>Each child’s progress</dt>
                    <dd>Their levels, their weeks and their work, on Today</dd>
                  </div>
                  <div className={styles.settingAction}>
                    <Link
                      to="/$"
                      params={{ _splat: familyHref(family) }}
                      className={buttonClass("secondary")}
                    >
                      Today
                    </Link>
                  </div>
                </div>
                <div className={styles.setting}>
                  <div className={styles.settingText}>
                    <dt>Practice on this device</dt>
                    <dd>
                      {data.children[0]
                        ? `“Let ${data.children[0].name} practice here” on Today starts them here`
                        : "Each child starts from Today"}
                    </dd>
                  </div>
                </div>
                {(ownPractice || startPractice) && (
                  <div className={styles.setting}>
                    <div className={styles.settingText}>
                      <dt>Your own practice</dt>
                      <dd>Free for you, with the family’s plan</dd>
                    </div>
                    <div className={styles.settingAction}>
                      <Link
                        to="/$"
                        params={{ _splat: ownPractice ? "me" : "me/start" }}
                        className={buttonClass("secondary")}
                      >
                        {ownPractice ? "Open" : "Start"}
                      </Link>
                    </div>
                  </div>
                )}
              </dl>
              <p className={styles.footnote}>
                The parent who invited you buys access, names the children,
                gives consent and can delete their data.
              </p>
            </section>
          ) : (
            <SecondParentSection place={place} />
          )}
          {place.own && manageDevices && (
            <DevicesSheet
              place={place}
              classId={place.own.id}
              open={devices}
              onOpenChange={setDevices}
            />
          )}
        </div>
      )}
    </FamilyFrame>
  );
}

/** The family's school year: its dates, and changing them. No terms or
 * grading periods: a family's records run the whole year. */
function SchoolYear({ place }: { place: FamilyPlace }) {
  const { session, family } = place;
  const org = useQuery({
    ...orgOptions(session, family),
    enabled: !!place.own,
  });
  const calendar = useQuery({
    ...calendarOptions(session, family),
    enabled: !!place.own && !!org.data?.can?.includes("calendar.read"),
  });
  const [editing, setEditing] = useState(false);
  const year = calendar.data?.find((entry) => entry.kind === "year");
  if (!place.own || !org.data?.can?.includes("calendar.read")) return null;
  const canEdit = !!org.data.can.includes("calendar.write");
  return (
    <section className={styles.section} aria-labelledby="family-year">
      <h2 id="family-year">School year</h2>
      <dl className={styles.settings}>
        <div className={styles.setting}>
          <div className={styles.settingText}>
            <dt>{year?.name ?? " "}</dt>
            <dd>
              {year
                ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
                : calendar.isError
                  ? "The year didn’t load."
                  : " "}
            </dd>
          </div>
          <div className={styles.settingAction}>
            {calendar.isError ? (
              <Button
                variant="secondary"
                onClick={() => void calendar.refetch()}
              >
                Try again
              </Button>
            ) : (
              canEdit &&
              year && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Change dates
                </Button>
              )
            )}
          </div>
        </div>
      </dl>
      <p className={styles.footnote}>
        Report cards and the time records count from the first day.
      </p>
      {editing && year && (
        <EditSheet
          orgId={family}
          session={year}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}

/**
 * The family's Settings (`/family/<family>/settings`): only what belongs to
 * this family. Its children, each opening their page and settings; adding
 * one; its school year. Sign-in, billing and privacy are the whole account's,
 * and say so.
 */
export function FamilySettingsScreen() {
  const place = useFamilyPlace();
  const { data, me, session } = place;
  const navigate = useNavigate();
  const [adding, setAdding] = useFlag("add");
  const children = data?.children ?? [];
  const add = !!data?.capabilities.addChildren;
  const consented = me?.consent.status === "active";
  return (
    <FamilyFrame place={place} narrow>
      {data && (
        <div className={styles.page} data-family-settings="">
          <header className={styles.head}>
            <ScreenTitle>Settings</ScreenTitle>
            <p className={styles.sub}>For {data.displayName}.</p>
          </header>
          <section className={styles.section} aria-labelledby="family-children">
            <div className={styles.sectionHead}>
              <h2 id="family-children">Children</h2>
              {add && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    consented
                      ? setAdding(true)
                      : void navigate({ to: "/start/parent" as never })
                  }
                >
                  Add a child
                </Button>
              )}
            </div>
            {children.length ? (
              <RowList label="Children">
                {children.map((child) => (
                  <RowLink
                    key={child.id}
                    title={child.name}
                    meta={
                      child.birthYear
                        ? `Born ${child.birthYear}`
                        : "Birth year not set"
                    }
                    to={familyHref(place.family, `kids/${child.id}`)}
                    data-settings-child={child.id}
                  />
                ))}
              </RowList>
            ) : (
              <p className={styles.footnote}>No children yet.</p>
            )}
          </section>
          <SchoolYear place={place} />
          <section className={styles.section} aria-labelledby="family-account">
            <h2 id="family-account">Your account</h2>
            <p className={styles.footnote}>
              These cover everything you do in AMP, not only this family.
            </p>
            <RowList label="Your account">
              {data.capabilities.manageBilling && (
                <RowLink
                  title="Billing"
                  meta="Plans, payments and receipts"
                  to="account/billing"
                />
              )}
              <RowLink
                title="Privacy"
                meta={
                  data.capabilities.manageConsent
                    ? "Consent, your data and deleting it"
                    : "Your data and deleting it"
                }
                to="account/privacy"
              />
              <RowLink
                title="Sign-in"
                meta="Your email, password and passkeys"
                to="account/security"
              />
            </RowList>
          </section>
          {add && consented && (
            <AddKidsSheet
              session={session}
              open={adding}
              onOpenChange={setAdding}
            />
          )}
        </div>
      )}
    </FamilyFrame>
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
              Back to Today
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
            <p className={styles.sub}>
              The whole group, including other families’ children
            </p>
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
                  session={session}
                  orgId={family}
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
              session={session}
              orgId={family}
              classId={t.class.id}
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

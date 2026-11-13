import { EntityLink } from "../../../nav/links";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { SMALL_CLASS } from "../../navigation/shell-frame";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { SignInRoster } from "../../../../schools/contracts";
import { Badge } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { Dialog } from "../../../ui/Dialog";
import { EmptyState } from "../../../ui/EmptyState";
import { Menu, MenuItem } from "../../../ui/Menu";
import { Toast } from "../../../ui/Toast";
import { downloadParentLinks } from "../../schools/share-api";
import { say, useLeaveOff } from "../classroom/api";
import { useClassExperience } from "../classroom/ExperienceSettings";
import { JoinClass } from "../join/JoinClass";
import {
  rosterOptions,
  useResetPictures,
  useRevokeSessions,
  useStaffSession,
} from "./api";
import { ClassFrame } from "./ClassFrame";
import { PracticeAs, useDemoOrg } from "../demo/DemoPlace";
import { meOptions } from "../../../lib/query";
import { currentSession, orgOptions } from "../api";
import { ClassPeople } from "./people/ClassPeople";
import { canAddStudents } from "../permissions";
import { classUrl } from "./teacher-shared";
import { approvalsOptions } from "../../family-approval/api";
import { secondParentOptions } from "../../second-parent/api";
import styles from "./Roster.module.css";
import { useSchoolNavigation } from "../../navigation/school-navigation";
import {
  AccessHeaderAction,
  AccessSheets,
  practiceEnded,
  useClassAccess,
} from "../pilots/ClassAccess";
import { useFlash } from "./flash";

type Row = SignInRoster["students"][number];
const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const clock = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
function lastSeen(iso: string | null) {
  if (!iso) return "Not yet";
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? `Today, ${clock.format(date)}`
    : shortDate.format(date);
}
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
function PicturesBadge({ row }: { row: Row }) {
  if (row.locked) return <Badge tone="warning">Locked for now</Badge>;
  return row.picturesSet ? (
    <Badge tone="success">Set</Badge>
  ) : (
    <Badge>Not yet</Badge>
  );
}

/** One made-up line of sign-in status, for an empty class. */
function ExampleSignIn() {
  return (
    <dl className={styles.example}>
      <div className={styles.exampleName}>
        <dt>Name</dt>
        <dd>A student</dd>
      </div>
      <div>
        <dt>Card</dt>
        <dd>Issued Sep 3</dd>
      </div>
      <div>
        <dt>Pictures</dt>
        <dd>
          <Badge tone="success">Set</Badge>
        </dd>
      </div>
      <div>
        <dt>Last seen</dt>
        <dd>Today, 9:12 AM</dd>
      </div>
    </dl>
  );
}

type Pending =
  | { kind: "links" }
  | { kind: "reset"; row: Row }
  | { kind: "revoke"; row: Row };

/** `.../roster`: every student's way in, and what a teacher can do about it. */
export function RosterScreen() {
  const params = useParams({ from: "/school/$org/classes/$class/roster" });
  const place = { org: params.org, class: params.class };
  const { start: canStart } = useSchoolNavigation({
    kind: "class",
    org: params.org,
    classId: params.class,
    active: "roster",
    board: false,
  });
  const access = useClassAccess(place);
  // Practice is over: sign-in tools lead nowhere until seats arrive.
  const ended = practiceEnded(access.view);
  const flash = useFlash((state) => state.message);
  const clearFlash = useFlash((state) => state.clear);
  const navigate = useNavigate();
  const session = useStaffSession();
  const roster = useQuery({
    ...rosterOptions(session, place),
    refetchInterval: 15_000,
  });
  const reset = useResetPictures(session, place);
  const revoke = useRevokeSessions(session, place);
  const experience = useClassExperience(session, params.class);
  const leaveOff = useLeaveOff(session, params.class);
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const data = roster.data;
  const canManage = data?.canManage ?? false;
  const leftOff = useMemo(
    () =>
      new Set(
        experience.data?.students
          ?.filter((student) => student.leftOff)
          .map((student) => student.id),
      ),
    [experience.data],
  );
  const [making, setMaking] = useState(false);
  // A demo's owner can open practice as any of its made-up students.
  const demo = useDemoOrg(params.org);
  // A family's class is its people: the children, then (for the account
  // holder) the grown-ups who teach it and children from other families.
  const account = currentSession();
  const org = useQuery({
    ...orgOptions(account, params.org),
    refetchOnMount: false,
  }).data;
  const family = org?.kind === "family";
  const me = useQuery(meOptions(account)).data;
  const holder = !!me?.signedIn && me.familyClass?.classId === params.class;
  const who = family ? "child" : "student";
  // Its lists start loading with the page; they sit at its foot, so
  // nothing moves when they arrive, and a list that fails says so in its
  // place rather than holding the page (a query refetched after an error
  // is pending again, which would loop the page through its wait).
  useQuery({ ...secondParentOptions(account), enabled: holder && family });
  useQuery({ ...approvalsOptions(account), enabled: holder && family });
  const busy = making || reset.isPending || revoke.isPending;
  const canAdd = !family && !demo && canAddStudents(org, params.class);
  const dayZero = !family && data?.students.length === 0;

  const columns = useMemo<DataGridColumn<Row>[]>(
    () => [
      {
        id: "name",
        header: family ? "Child" : "Student",
        width: 200,
        compare: (a, b) => a.name.localeCompare(b.name),
        // A student opens over the roster, which stays (nav/entities.ts).
        cell: (row) => (
          <EntityLink
            entity={{ kind: "student", id: row.id }}
            className={`${styles.student} ${styles.studentLink}`}
          >
            <span>{row.name}</span>
          </EntityLink>
        ),
      },
      {
        id: "card",
        header: "Card",
        width: 130,
        compare: (a, b) => time(a.cardIssuedAt) - time(b.cardIssuedAt),
        cell: (row) =>
          row.cardIssuedAt ? (
            `Issued ${shortDate.format(new Date(row.cardIssuedAt))}`
          ) : (
            <span className={styles.none}>No card</span>
          ),
      },
      {
        id: "pictures",
        header: "Pictures",
        width: 130,
        compare: (a, b) => Number(a.picturesSet) - Number(b.picturesSet),
        cell: (row) => <PicturesBadge row={row} />,
      },
      {
        id: "seen",
        header: "Last seen",
        width: 140,
        firstSort: "descending",
        compare: (a, b) => time(a.lastSeenAt) - time(b.lastSeenAt),
        cell: (row) =>
          row.lastSeenAt ? (
            lastSeen(row.lastSeenAt)
          ) : (
            <span className={styles.none}>Not yet</span>
          ),
      },
      ...(demo && canManage
        ? ([
            {
              id: "practice",
              header: "Student view",
              width: 150,
              cell: (row) => <PracticeAs student={row} />,
            },
          ] satisfies DataGridColumn<Row>[])
        : []),
      ...(canManage
        ? ([
            {
              id: "actions",
              header: "Actions",
              width: 120,
              align: "end",
              cell: (row) => (
                <Menu label="Manage" aria-label={`Manage ${row.name}`}>
                  <MenuItem
                    onSelect={() =>
                      void navigate({
                        to: "/school/$org/classes/$class/cards",
                        params,
                        search: { student: row.id },
                      })
                    }
                  >
                    {row.cardIssuedAt ? "Print a new card" : "Print a card"}
                  </MenuItem>
                  {row.picturesSet && (
                    <MenuItem
                      onSelect={() => setPending({ kind: "reset", row })}
                    >
                      Reset pictures
                    </MenuItem>
                  )}
                  {row.activeSessions > 0 && (
                    <MenuItem
                      onSelect={() => setPending({ kind: "revoke", row })}
                    >
                      Sign out everywhere
                    </MenuItem>
                  )}
                  {experience.data?.canEdit && (
                    <MenuItem
                      onSelect={() =>
                        leaveOff.mutate(
                          { id: row.id, leftOff: !leftOff.has(row.id) },
                          {
                            onSuccess: () =>
                              setStatus(
                                leftOff.has(row.id)
                                  ? `${row.name} is back on standings.`
                                  : `${row.name} is off standings.`,
                              ),
                            onError: (failure) =>
                              setError(
                                say(failure, "That change didn’t save."),
                              ),
                          },
                        )
                      }
                    >
                      {leftOff.has(row.id)
                        ? "Put back on standings"
                        : "Leave off standings"}
                    </MenuItem>
                  )}
                </Menu>
              ),
            },
          ] satisfies DataGridColumn<Row>[])
        : []),
    ],
    [
      canManage,
      demo,
      family,
      navigate,
      params,
      experience.data?.canEdit,
      leaveOff,
      leftOff,
    ],
  );

  async function confirm() {
    if (!pending) return;
    try {
      if (pending.kind === "links") {
        setMaking(true);
        await downloadParentLinks(session, params.class);
        setStatus("Family links downloaded. Earlier links no longer work.");
      } else if (pending.kind === "reset") {
        await reset.mutateAsync(pending.row.id);
        setStatus(
          `${pending.row.name} picks new pictures at the next sign-in.`,
        );
      } else {
        await revoke.mutateAsync(pending.row.id);
        setStatus(`${pending.row.name} is signed out on every device.`);
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMaking(false);
      setPending(null);
    }
  }

  return (
    <ClassFrame
      org={params.org}
      classId={params.class}
      className={data?.class.name}
      loading={roster.isPending}
      tab="roster"
    >
      {!data ? (
        <EmptyState title="This roster didn’t load">
          {roster.error?.message}
        </EmptyState>
      ) : (
        <div className={styles.page}>
          <header className={styles.head}>
            <div>
              <ScreenTitle>{family ? "People" : "Students"}</ScreenTitle>
              {/* A count only for a list that runs past the first screen;
                  a short one shows its own size. */}
              {data.students.length > SMALL_CLASS && (
                <p className={styles.count}>
                  {data.students.length === 1
                    ? `1 ${who}`
                    : `${data.students.length} ${family ? "children" : "students"}`}
                </p>
              )}
            </div>
            <div className={styles.actions}>
              {/* One primary slot: Start practice before the pilot, Start
                  class while it runs, Request seats after. */}
              {!family && canStart && !ended ? (
                <Link
                  to="/school/$org/classes/$class/start"
                  params={params}
                  className={buttonClass("primary")}
                >
                  Start class
                </Link>
              ) : (
                !family &&
                canManage && (
                  <AccessHeaderAction
                    view={access.view}
                    place={place}
                    pilot={access.pilot}
                  />
                )
              )}
              {canManage && data.students.length > 0 && !ended && (
                <Link
                  to="/school/$org/classes/$class/cards"
                  params={params}
                  search={{}}
                  className={buttonClass("secondary")}
                >
                  Print cards
                </Link>
              )}
              {/* A family's own class has no parent links: its parents
                  see the children's progress themselves. */}
              {data.canShare === true && data.students.length > 0 && !ended && (
                <Button
                  variant="secondary"
                  onClick={() => setPending({ kind: "links" })}
                >
                  Parent links
                </Button>
              )}
            </div>
          </header>
          {family && <h2 className={styles.sectionTitle}>Children</h2>}
          {/* Day 0 of a school class is its one step; the code waits for a
              roster, and practice that has ended takes no one in. */}
          {!dayZero && !ended && (
            <section className={styles.code} aria-label="Class code">
              <div className={styles.codeText}>
                <h2>Class code</h2>
                <p>
                  {data.class.joinLockedUntil
                    ? "Sign-in is paused after many wrong pictures. A new code opens it now."
                    : family
                      ? "Children type this at /join on a device of their own. Printed cards don’t need it."
                      : "Students type this at /join. Printed cards don’t need it."}
                </p>
              </div>
              {/* The compact form of the one Join element: the code in its one
                face, then Copy link, the board, the QR and More (New code). */}
              <JoinClass
                compact
                code={data.class.joinCode}
                place={params}
                family={family}
                boardLink={family}
                label={false}
                manage={data.canNewCode ?? canManage}
                locked={!!data.class.joinLockedUntil}
              />
            </section>
          )}
          {dayZero && canAdd ? (
            <section
              className={styles.dayZero}
              aria-labelledby="roster-day-zero"
            >
              <div className={styles.dayZeroRows} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h2 id="roster-day-zero">Add your students</h2>
              <p>Paste names, or import Excel or CSV.</p>
              <Link
                to="/school/$org/classes/$class/import"
                params={params}
                className={buttonClass("primary")}
              >
                Add students
              </Link>
            </section>
          ) : data.students.length ? (
            <DataGrid
              label={`Sign-in for ${data.class.name}`}
              columns={columns}
              rows={data.students}
              rowKey={(row) => row.id}
              rowHeight={52}
              defaultSort={{ column: "name", direction: "ascending" }}
              cardLayout="list"
              cardsSort={data.students.length > 6}
              cardEstimate={84}
              card={(row) => (
                <div className={styles.card}>
                  <EntityLink
                    entity={{ kind: "student", id: row.id }}
                    className={`${styles.cardName} ${styles.studentLink}`}
                  >
                    {row.name}
                  </EntityLink>
                  {canManage && (
                    <span className={styles.cardAction}>
                      {columns
                        .find((column) => column.id === "actions")
                        ?.cell(row)}
                    </span>
                  )}
                  <span className={styles.cardFacts}>
                    <span>
                      {row.cardIssuedAt
                        ? `Card ${shortDate.format(new Date(row.cardIssuedAt))}`
                        : "No card"}
                    </span>
                    <span className={styles.cardPictures}>
                      Pictures <PicturesBadge row={row} />
                    </span>
                    <span>
                      {row.lastSeenAt
                        ? `Seen ${lastSeen(row.lastSeenAt)}`
                        : "Not signed in yet"}
                    </span>
                  </span>
                </div>
              )}
            />
          ) : (
            <EmptyState
              title={family ? "No children yet" : "No students yet"}
              example={<ExampleSignIn />}
              action={
                family && holder ? (
                  <Link
                    to="/$"
                    params={{ _splat: "family/learners" }}
                    className={buttonClass("primary")}
                  >
                    Add a child
                  </Link>
                ) : undefined
              }
            />
          )}
          {!family && canAdd && !ended && data.students.length > 0 && (
            <Link
              to="/school/$org/classes/$class/import"
              params={params}
              className={buttonClass("quiet", styles.addMore, "start")}
            >
              Add students
            </Link>
          )}
          {family && holder && (
            <ClassPeople
              session={account}
              orgId={params.org}
              classId={params.class}
            />
          )}
        </div>
      )}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={
          pending?.kind === "links"
            ? "Download new family links?"
            : pending?.kind === "reset"
              ? `Reset pictures for ${pending.row.name}?`
              : pending?.kind === "revoke"
                ? `Sign out ${pending.row.name} everywhere?`
                : ""
        }
      >
        <div className={styles.dialog}>
          <p>
            {pending?.kind === "links"
              ? "You’ll get a CSV of each student’s name and a new read-only link, ready for your school’s mail system. Links sent before stop working."
              : pending?.kind === "reset"
                ? "New pictures get chosen at the next sign-in. Devices already signed in stay signed in."
                : "Every device signed in as this student signs out on its next step. Cards and pictures keep working."}
          </p>
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              aria-busy={busy}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {pending?.kind === "links"
                ? "Download new links"
                : pending?.kind === "reset"
                  ? "Reset pictures"
                  : "Sign out everywhere"}
            </Button>
          </div>
        </div>
      </Dialog>
      <Toast message={status} tone="status" onDismiss={() => setStatus("")} />
      <Toast message={flash} tone="status" onDismiss={clearFlash} />
      {!family && <AccessSheets place={place} />}
      <Toast message={error} onDismiss={() => setError("")} />
    </ClassFrame>
  );
}

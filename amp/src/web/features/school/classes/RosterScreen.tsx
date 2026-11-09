import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { SignInRoster } from "../../../../schools/contracts";
import { Avatar } from "../../../ui/Avatar";
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
import { CodeTiles } from "../join/CodeTiles";
import {
  rosterOptions,
  useResetPictures,
  useRevokeSessions,
  useRotateCode,
  useStaffSession,
} from "./api";
import { ClassFrame } from "./ClassFrame";
import styles from "./Roster.module.css";

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

type Pending =
  | { kind: "links" }
  | { kind: "rotate" }
  | { kind: "reset"; row: Row }
  | { kind: "revoke"; row: Row };

/** `.../roster`: every student's way in, and what a teacher can do about it. */
export function RosterScreen() {
  const params = useParams({ from: "/school/$org/classes/$class/roster" });
  const place = { org: params.org, class: params.class };
  const navigate = useNavigate();
  const session = useStaffSession();
  const roster = useQuery({
    ...rosterOptions(session, place),
    refetchInterval: 15_000,
  });
  const rotate = useRotateCode(session, place);
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
  const busy =
    making || rotate.isPending || reset.isPending || revoke.isPending;

  const columns = useMemo<DataGridColumn<Row>[]>(
    () => [
      {
        id: "name",
        header: "Student",
        width: 200,
        compare: (a, b) => a.name.localeCompare(b.name),
        cell: (row) => (
          <span className={styles.student}>
            <Avatar name={row.name} size="small" />
            <span>{row.name}</span>
          </span>
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
    [canManage, navigate, params, experience.data?.canEdit, leaveOff, leftOff],
  );

  async function confirm() {
    if (!pending) return;
    try {
      if (pending.kind === "links") {
        setMaking(true);
        await downloadParentLinks(session, params.class);
        setStatus("Family links downloaded. Earlier links no longer work.");
      } else if (pending.kind === "rotate") {
        const { joinCode } = await rotate.mutateAsync();
        setStatus(
          `The new class code is ${joinCode.slice(0, 3)}-${joinCode.slice(3)}.`,
        );
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
              <h1>Roster</h1>
              <p className={styles.count}>
                {data.students.length === 1
                  ? "1 student"
                  : `${data.students.length} students`}
              </p>
            </div>
            <div className={styles.actions}>
              <Link
                to="/school/$org/classes/$class/experience"
                params={params}
                className={buttonClass("secondary")}
              >
                Student experience
              </Link>
              <Link
                to="/school/$org/classes/$class/start"
                params={params}
                className={buttonClass("primary")}
              >
                Start class
              </Link>
              {canManage && data.students.length > 0 && (
                <Link
                  to="/school/$org/classes/$class/cards"
                  params={params}
                  search={{}}
                  className={buttonClass("secondary")}
                >
                  Print cards
                </Link>
              )}
              {canManage && data.students.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setPending({ kind: "links" })}
                >
                  Parent links
                </Button>
              )}
            </div>
          </header>
          <section className={styles.code} aria-label="Class code">
            <div className={styles.codeText}>
              <h2>Class code</h2>
              <p>
                {data.class.joinLockedUntil
                  ? "Sign-in is paused after many wrong pictures. A new code opens it now."
                  : "Students type this at /join. Printed cards don’t need it."}
              </p>
            </div>
            <span
              className={styles.tiles}
              role="img"
              aria-label={[...data.class.joinCode].join(" ")}
            >
              <CodeTiles code={data.class.joinCode} />
            </span>
            {canManage && (
              <Button
                variant={data.class.joinLockedUntil ? "primary" : "secondary"}
                onClick={() => setPending({ kind: "rotate" })}
              >
                New code
              </Button>
            )}
          </section>
          {data.students.length ? (
            <DataGrid
              label={`Sign-in for ${data.class.name}`}
              columns={columns}
              rows={data.students}
              rowKey={(row) => row.id}
              rowHeight={52}
              defaultSort={{ column: "name", direction: "ascending" }}
            />
          ) : (
            <EmptyState title="No students yet">
              Students added to this class appear here with their sign-in
              status.
            </EmptyState>
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
            : pending?.kind === "rotate"
              ? "Make a new class code?"
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
              : pending?.kind === "rotate"
                ? "The old code stops working right away. Printed cards keep working."
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
                : pending?.kind === "rotate"
                  ? "Make a new code"
                  : pending?.kind === "reset"
                    ? "Reset pictures"
                    : "Sign out everywhere"}
            </Button>
          </div>
        </div>
      </Dialog>
      <Toast message={status} tone="status" onDismiss={() => setStatus("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </ClassFrame>
  );
}

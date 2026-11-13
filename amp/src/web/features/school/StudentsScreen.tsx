import { closeSearch } from "../../lib/return-to";
import { canAddStudents } from "./permissions";
import {
  AddChildSheet,
  familyAddLabel,
  useFamilyAdd,
} from "../family-class/AddChildSheet";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentResource } from "../../../schools/contracts";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { DataGrid, type DataGridColumn } from "../../ui/DataGrid";
import { EmptyState } from "../../ui/EmptyState";
import { SearchField } from "../../ui/SearchField";
import { Select } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { Loading } from "../../ui/Loading";
import { TextField } from "../../ui/TextField";
import {
  classesOptions,
  currentSession,
  fetchStudents,
  orgOptions,
  refreshSchool,
  school,
  studentsKey,
  type StudentStatus,
} from "./api";
import { TransferSheet, useCanMove } from "./org/TransferSheet";
import { displayName } from "./ClassesScreen";
import { OrgFrame } from "./OrgFrame";
import { EntityLink } from "../../nav/links";
import { FormNote, GradePicker, PageHead, gradeLabel } from "./parts";
import { orgPath } from "./paths";
import styles from "./School.module.css";

const message = (failure: unknown, fallback: string) =>
  failure instanceof AppError ? failure.message : fallback;
const statusWords: Record<StudentStatus, string> = {
  "needs-seat": "waiting for a seat",
  "never-signed-in": "who haven’t signed in yet",
};

function StudentSheet({
  orgId,
  student,
  canTransfer,
  canRemove,
  onClose,
}: {
  orgId: string;
  student: StudentResource;
  canTransfer: boolean;
  canRemove: boolean;
  onClose: () => void;
}) {
  const [moving, setMoving] = useState(false);
  const canMove = useCanMove(student.id, canTransfer);
  const session = currentSession();
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
  const [shownName, setShownName] = useState(student.displayName ?? "");
  const [grade, setGrade] = useState(student.gradeLevel);
  const [classIds, setClassIds] = useState<string[]>(student.classIds);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const rosterName = student.familyName
    ? `${student.givenName} ${student.familyName}`
    : student.givenName;
  const changedClasses =
    classIds.length !== student.classIds.length ||
    classIds.some((id) => !student.classIds.includes(id));
  const changedDetails =
    (shownName.trim() || null) !== student.displayName ||
    grade !== student.gradeLevel;
  const save = async () => {
    setBusy("save");
    setError("");
    try {
      if (changedDetails)
        await school.updateStudent(session, orgId, student.id, {
          displayName: shownName.trim() || null,
          gradeLevel: grade,
        });
      if (changedClasses)
        await school.setStudentClasses(session, orgId, student.id, classIds);
      await refreshSchool(session);
      onClose();
    } catch (failure) {
      setError(message(failure, "Those changes didn’t save. Try again."));
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("remove");
    setError("");
    try {
      await school.removeStudent(session, orgId, student.id);
      await refreshSchool(session);
      onClose();
    } catch (failure) {
      setError(message(failure, "That student wasn’t removed. Try again."));
      setBusy(null);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={displayName(student)}
      description={
        student.identifier ? `Student ID ${student.identifier}` : undefined
      }
      lead={<Avatar name={displayName(student)} />}
    >
      <div className={styles.sheetForm}>
        {/* Their record opens over this sheet: X comes back to it. */}
        <EntityLink
          entity={{ kind: "student", id: student.id }}
          className={buttonClass("secondary")}
        >
          Open {student.givenName}’s record
        </EntityLink>
        {canMove && (
          <Button variant="secondary" onClick={() => setMoving(true)}>
            Move to another school
          </Button>
        )}
        <TextField
          label="Display name"
          placeholder={rosterName}
          value={shownName}
          maxLength={100}
          onChange={(event) => setShownName(event.target.value)}
        />
        <p className={styles.fieldHelp}>
          What the class sees. Imports never change it.
        </p>
        <GradePicker value={grade} onChange={setGrade} />
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Seat</span>
          <span className={styles.seatLine}>
            {student.seated ? (
              <Badge tone="success">Seated</Badge>
            ) : (
              <Badge tone="warning">Needs a seat</Badge>
            )}
          </span>
        </div>
        {canTransfer && classes.length > 0 && (
          <fieldset className={styles.classChecks}>
            <legend className={styles.fieldLabel}>Classes</legend>
            <p className={styles.fieldHelp}>
              To transfer, check the new class and clear the old one. Practice
              history stays with the student.
            </p>
            {classes.map((klass) => (
              <Checkbox
                key={klass.id}
                checked={classIds.includes(klass.id)}
                onChange={(checked) =>
                  setClassIds((prior) =>
                    checked
                      ? [...prior, klass.id]
                      : prior.filter((id) => id !== klass.id),
                  )
                }
              >
                {klass.name}
              </Checkbox>
            ))}
          </fieldset>
        )}
        <FormNote error={error} />
        <Button
          variant="primary"
          className={styles.sheetAction}
          aria-busy={busy === "save"}
          disabled={!!busy || (!changedDetails && !changedClasses)}
          onClick={() => void save()}
        >
          Save changes
        </Button>
        {canRemove && (
          <div className={styles.dangerZone}>
            <h3>Remove from school</h3>
            {confirming ? (
              <>
                <p>
                  This permanently deletes {displayName(student)}’s practice
                  history, levels and answers. Their seat is freed. Any final
                  grades you’ve recorded stay. It can’t be undone.
                </p>
                <div className={styles.dangerActions}>
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => setConfirming(false)}
                  >
                    Keep student
                  </Button>
                  <button
                    type="button"
                    className={styles.danger}
                    aria-busy={busy === "remove"}
                    disabled={!!busy}
                    onClick={() => void remove()}
                  >
                    Delete history and remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Frees their seat and deletes their learning data. To move them
                  to another class, use Classes above.
                </p>
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  Remove student
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {canMove && (
        <TransferSheet
          studentId={student.id}
          name={displayName(student)}
          open={moving}
          onOpenChange={setMoving}
          onMoved={() => {
            setMoving(false);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function AddStudentSheet({
  orgId,
  open,
  wholeSchool,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  wholeSchool: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
  const mine = wholeSchool
    ? classes
    : classes.filter((klass) => org?.teaches?.includes(klass.id));
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [classId, setClassId] = useState(
    wholeSchool ? "" : (mine[0]?.id ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [givenError, setGivenError] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  const submit = async () => {
    if (!given.trim()) {
      setGivenError("Enter a first name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await school.addStudent(session, orgId, {
        givenName: given.trim(),
        ...(family.trim() ? { familyName: family.trim() } : {}),
        ...(grade !== null ? { gradeLevel: grade } : {}),
        ...(classId ? { classId } : {}),
      });
      await refreshSchool(session);
      setGiven("");
      setFamily("");
      onOpenChange(false);
    } catch (failure) {
      setError(message(failure, "That student didn’t save. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a student">
      <form
        className={styles.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="First name"
          value={given}
          autoComplete="off"
          maxLength={100}
          error={givenError}
          onChange={(event) => {
            setGiven(event.target.value);
            setGivenError("");
          }}
        />
        <TextField
          label="Last name, if they have one"
          value={family}
          autoComplete="off"
          maxLength={100}
          onChange={(event) => setFamily(event.target.value)}
        />
        <GradePicker value={grade} onChange={setGrade} />
        {mine.length > 0 && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Class</span>
            <Select
              aria-label="Class"
              value={classId}
              onValueChange={setClassId}
            >
              {wholeSchool && <option value="">No class yet</option>}
              {mine.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          className={styles.sheetAction}
          aria-busy={busy}
          disabled={busy}
        >
          Add student
        </Button>
      </form>
    </Sheet>
  );
}

/** The roster: search it, open anyone, add one. Everyone is in the grid, loaded
 * a page at a time behind it, so a big school still sorts and scrolls whole. */
export function StudentsScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const search = useSearch({ strict: false }) as {
    q?: unknown;
    student?: unknown;
    add?: unknown;
    status?: unknown;
    move?: unknown;
  };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
  const typed = typeof search.q === "string" ? search.q.slice(0, 80) : "";
  const [needle, setNeedle] = useState(typed.trim());
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(typed.trim()), 180);
    return () => clearTimeout(timer);
  }, [typed]);
  const status: StudentStatus | undefined =
    search.status === "needs-seat" || search.status === "never-signed-in"
      ? search.status
      : undefined;
  const query = useInfiniteQuery({
    queryKey: studentsKey(session, orgId, needle, status),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchStudents(session, orgId, needle, pageParam, signal, status),
    getNextPageParam: (last) => last.nextOffset,
    placeholderData: keepPreviousData,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.students) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? 0;
  const seated = rows.filter((row) => row.seated).length;
  const classNames = useMemo(
    () => new Map(classes.map((klass) => [klass.id, klass.name])),
    [classes],
  );
  const router = useRouter();
  const setSearch = (patch: Record<string, unknown>, replace = false) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
      replace,
      resetScroll: false,
    });
  const columns: DataGridColumn<StudentResource>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Student",
        width: 220,
        compare: (a, b) => displayName(a).localeCompare(displayName(b), "en"),
        cell: (row) => (
          <span className={styles.person}>
            <Avatar name={displayName(row)} size="small" />
            <span>{displayName(row)}</span>
          </span>
        ),
      },
      {
        id: "grade",
        header: "Grade",
        width: 70,
        compare: (a, b) => (a.gradeLevel ?? -1) - (b.gradeLevel ?? -1),
        cell: (row) => gradeLabel(row.gradeLevel),
      },
      {
        id: "classes",
        header: "Classes",
        width: 220,
        cell: (row) =>
          row.classIds
            .map((id) => classNames.get(id))
            .filter(Boolean)
            .join(", ") || "None",
      },
      ...(rows.some((row) => row.identifier)
        ? [
            {
              id: "id",
              header: "Student ID",
              width: 110,
              cell: (row: StudentResource) => row.identifier ?? "",
            },
          ]
        : []),
      {
        id: "seat",
        header: "Seat",
        width: 130,
        compare: (a, b) => Number(a.seated) - Number(b.seated),
        cell: (row) =>
          row.seated ? (
            <Badge tone="success">Seated</Badge>
          ) : (
            <Badge tone="warning">Needs a seat</Badge>
          ),
      },
    ],
    [classNames, rows],
  );
  const can = org?.can ?? [];
  const canAdd = canAddStudents(org);
  // A family's class adds a child (or a tutor's student) its own way.
  const familyAdd = useFamilyAdd(session, org);
  const open = rows.find((row) => row.id === search.student);
  const adding = search.add === 1 || search.add === "1";
  const opener = useRef<HTMLDivElement>(null);
  const echoed = needle.length > 24 ? `${needle.slice(0, 24)}…` : needle;
  return (
    <OrgFrame orgId={orgId} nav="students" title="Students">
      <PageHead
        title="Students"
        detail={
          query.isPending
            ? " "
            : status
              ? `${total.toLocaleString("en-US")} ${total === 1 ? "student" : "students"} ${statusWords[status]}`
              : needle
                ? `${total} ${total === 1 ? "match" : "matches"}`
                : `${total} ${total === 1 ? "student" : "students"}${total ? `, ${total - seated === 0 ? "all" : seated} with seats` : ""}`
        }
      />
      <div className={styles.toolbar} ref={opener}>
        <SearchField
          label="Search students"
          placeholder="Name or student ID"
          value={typed}
          onChange={(value) => setSearch({ q: value || undefined }, true)}
        />
        {status && (
          <Button
            variant="quiet"
            align="start"
            onClick={() => setSearch({ status: undefined })}
          >
            Show everyone
          </Button>
        )}
      </div>
      {query.isError && !rows.length ? (
        <EmptyState
          title="The roster didn’t load"
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <Loading>Loading students</Loading>
      ) : rows.length ? (
        <DataGrid
          label="Students"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          defaultSort={{ column: "name", direction: "ascending" }}
          onRowActivate={(row) => setSearch({ student: row.id })}
          action={
            canAdd || familyAdd ? (
              <Button variant="primary" onClick={() => setSearch({ add: 1 })}>
                {familyAdd ? familyAddLabel(familyAdd) : "Add student"}
              </Button>
            ) : undefined
          }
          cardLayout="row"
          cardEstimate={72}
          card={(row) => (
            <button
              type="button"
              className={styles.studentCard}
              onClick={() => setSearch({ student: row.id })}
            >
              <Avatar name={displayName(row)} size="small" />
              <span className={styles.studentCardText}>
                <strong>{displayName(row)}</strong>
                <span>
                  {[
                    row.gradeLevel === null
                      ? ""
                      : `Grade ${gradeLabel(row.gradeLevel)}`,
                    row.classIds
                      .map((id) => classNames.get(id))
                      .filter(Boolean)
                      .join(", "),
                  ]
                    .filter(Boolean)
                    .join(", ") || "No class yet"}
                </span>
              </span>
              {row.seated ? (
                <Badge tone="success">Seated</Badge>
              ) : (
                <Badge tone="warning">Needs a seat</Badge>
              )}
            </button>
          )}
        />
      ) : needle ? (
        <EmptyState
          title={`No student matches “${echoed}”`}
          action={
            canAdd || familyAdd ? (
              <Button variant="secondary" onClick={() => setSearch({ add: 1 })}>
                {familyAdd ? familyAddLabel(familyAdd) : "Add student"}
              </Button>
            ) : undefined
          }
        >
          Check the spelling, or clear the search to see everyone.
        </EmptyState>
      ) : (
        <EmptyState
          title="No students yet"
          action={
            <span className={styles.emptyActions}>
              {can.includes("roster.import") && (
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "import") }}
                  className={buttonClass("primary")}
                >
                  Import a roster
                </Link>
              )}
              {canAdd && (
                <Button
                  variant="secondary"
                  onClick={() => setSearch({ add: 1 })}
                >
                  Add one student
                </Button>
              )}
            </span>
          }
        >
          A spreadsheet or OneRoster file brings in the whole school at once.
        </EmptyState>
      )}
      {open && (
        <StudentSheet
          key={open.id}
          orgId={orgId}
          student={open}
          canTransfer={can.includes("students.transfer")}
          canRemove={can.includes("students.remove")}
          onClose={() => closeSearch(router, "student")}
        />
      )}
      {familyAdd && session ? (
        <AddChildSheet
          session={session}
          kind={familyAdd}
          open={adding}
          onOpenChange={(next) =>
            next ? setSearch({ add: 1 }) : closeSearch(router, "add")
          }
        />
      ) : (
        canAdd && (
          <AddStudentSheet
            orgId={orgId}
            open={adding}
            wholeSchool={can.includes("students.add")}
            onOpenChange={(next) =>
              next ? setSearch({ add: 1 }) : closeSearch(router, "add")
            }
          />
        )
      )}
    </OrgFrame>
  );
}

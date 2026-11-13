import { EntityLink } from "../../nav/links";
import { classColumn, teacherColumn } from "./class-columns";
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
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { divisionLabels, formatDay } from "../../../schools/calendar";
import type {
  ClassResource,
  GradingKind,
  StudentResource,
} from "../../../schools/contracts";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../ui/DataGrid";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { Loading } from "../../ui/Loading";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import {
  calendarOptions,
  classesOptions,
  currentSession,
  fetchStudents,
  orgOptions,
  refreshSchool,
  school,
  schoolGradingOptions,
  studentsKey,
} from "./api";
import { SettingMeta } from "./classroom/SettingMeta";
import { OrgFrame } from "./OrgFrame";
import { YearCalendar } from "./CalendarScreen";
import { JoinClass } from "./join/JoinClass";
import { ClassExperienceSection } from "./classroom/ExperienceScreens";
import { FormNote, GradePicker, PageHead, gradeLabel } from "./parts";
import { yearsOptions } from "./org/org-api";
import { classPath, orgPath } from "./paths";
import { SmallClassGrades } from "./classes/SmallClassGrades";
import { SMALL_CLASS } from "../navigation/shell-frame";
import { meOptions } from "../../lib/query";
import styles from "./School.module.css";

const COURSE_OPTIONS: readonly (readonly [string, string])[] = [
  ["", "Each student’s own grade"],
  ["K", "Kindergarten"],
  ...Array.from(
    { length: 8 },
    (_, index) => [String(index + 1), `Grade ${index + 1}`] as const,
  ),
  ["algebra-1", "Algebra 1"],
  ["geometry", "Geometry"],
  ["algebra-2", "Algebra 2"],
  ["precalculus", "Precalculus"],
];
const courseLabel = (bands: readonly string[]) =>
  bands.length
    ? bands
        .map(
          (band) =>
            COURSE_OPTIONS.find(([value]) => value === band)?.[1] ?? band,
        )
        .join(", ")
    : "Own grades";
const GRADING: GradingKind[] = ["year", "semester", "trimester", "quarter"];
const gradingLabel = (kind: GradingKind) =>
  kind === "year"
    ? "Full year"
    : kind === "custom"
      ? "Custom"
      : divisionLabels[kind].plural;

/** "Add class", from a screen that can offer it. */
function AddClassSheet({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = currentSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [grading, setGrading] = useState<GradingKind>("semester");
  // A new class starts on the school's periods, until someone picks others.
  const schoolGrading = useQuery(schoolGradingOptions(session, orgId)).data;
  const [pickedGrading, setPickedGrading] = useState(false);
  useEffect(() => {
    if (schoolGrading && !pickedGrading && schoolGrading.kind !== "custom")
      setGrading(schoolGrading.kind);
  }, [schoolGrading, pickedGrading]);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  const submit = async () => {
    if (!name.trim()) {
      setNameError("Enter a name for the class.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await school.addClass(session, orgId, {
        name: name.trim(),
        gradingKind: grading,
        ...(course ? { courseBands: [course] } : {}),
      });
      await refreshSchool(session);
      await navigate({
        to: "/$",
        params: { _splat: classPath(orgId, created.id) },
      });
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "That class didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a class">
      <form
        className={styles.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Class name"
          placeholder="Grade 5 Math"
          value={name}
          maxLength={100}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
          }}
        />
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Course</span>
          <Select aria-label="Course" value={course} onValueChange={setCourse}>
            {COURSE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Grading periods</span>
          <Segmented
            label="Grading periods"
            compact
            value={grading}
            onChange={(next) => {
              setPickedGrading(true);
              setGrading(next);
            }}
            options={GRADING.map((value) => ({
              value,
              label: gradingLabel(value),
            }))}
          />
        </div>
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          aria-busy={busy}
          disabled={busy}
          className={styles.sheetAction}
        >
          Add class
        </Button>
      </form>
    </Sheet>
  );
}

const classColumns = (
  orgId: string,
  earlier: boolean,
  self: string | null | undefined,
): DataGridColumn<ClassResource>[] => [
  // The same Class and Teacher columns as the Overview's table.
  classColumn<ClassResource>((row) => classHome(orgId, row.id, earlier)),
  teacherColumn<ClassResource>(self),
  {
    id: "students",
    header: "Students",
    width: 90,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => a.studentCount - b.studentCount,
    cell: (row) => row.studentCount,
  },
  {
    id: "course",
    header: "Course",
    width: 160,
    cell: (row) => courseLabel(row.courseBands),
  },
  {
    id: "grading",
    header: "Grading periods",
    width: 130,
    cell: (row) => gradingLabel(row.gradingKind),
  },
];

/** A class from another year opens on its gradebook: there's no today in it. */
const classHome = (orgId: string, classId: string, earlier: boolean) =>
  earlier
    ? `${classPath(orgId, classId)}/gradebook`
    : classPath(orgId, classId);

export function ClassesScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const search = useSearch({ strict: false }) as {
    add?: unknown;
    year?: unknown;
    periods?: unknown;
  };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const years = useQuery(yearsOptions(session, orgId)).data ?? [];
  // From the school's Settings: only the classes with their own periods.
  const grading = useQuery({
    ...schoolGradingOptions(session, orgId),
    enabled: search.periods === "own",
  }).data;
  const inUse = years.find((entry) => entry.inUse);
  const asked = years.find((entry) => entry.id === search.year);
  // The year in use is the plain address; anything else is a year someone chose.
  const year = asked && asked.id !== inUse?.id ? asked : undefined;
  const classes = useQuery({
    ...classesOptions(session, orgId, year?.id),
    placeholderData: keepPreviousData,
  });
  const ownPeriods = search.periods === "own" && !!grading;
  const rows = (classes.data ?? []).filter(
    (row) => !ownPeriods || row.gradingKind !== grading!.kind,
  );
  const earlier = !!year && !!inUse && year.endsOn < inUse.startsOn;
  const canAdd = org?.can?.includes("classes.create") && !year;
  const adding = search.add === 1 || search.add === "1";
  const setAdding = (open: boolean) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        add: open ? 1 : undefined,
      })) as never,
    });
  return (
    <OrgFrame orgId={orgId} nav="classes" title="Classes">
      <PageHead
        title="Classes"
        // A count only for a list that runs past the first screen; the
        // year when it is not the one in use.
        detail={
          [
            rows.length > SMALL_CLASS
              ? `${rows.length} ${rows.length === 1 ? "class" : "classes"}`
              : "",
            year ? year.name : "",
          ]
            .filter(Boolean)
            .join(", ") || undefined
        }
        action={
          canAdd ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add class
            </Button>
          ) : undefined
        }
      />
      {years.length > 1 && (
        <div className={styles.toolbar}>
          <Segmented
            label="School year"
            compact
            dense
            value={(year ?? inUse)?.id ?? null}
            onChange={(value) =>
              void navigate({
                to: ".",
                search: ((previous: Record<string, unknown>) => ({
                  ...previous,
                  year: value === inUse?.id ? undefined : value,
                })) as never,
                resetScroll: false,
              })
            }
            options={years
              .slice(0, 4)
              .reverse()
              .map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        </div>
      )}
      {ownPeriods && (
        <p className={styles.quiet} data-own-periods="">
          Classes with their own grading periods ·{" "}
          <Link
            to="/$"
            params={{ _splat: orgPath(orgId, "classes") }}
            search={{} as never}
          >
            Show all classes
          </Link>
        </p>
      )}
      {classes.isError ? (
        <EmptyState
          title="Your classes didn’t load"
          action={
            <Button variant="secondary" onClick={() => void classes.refetch()}>
              Try again
            </Button>
          }
        />
      ) : rows.length ? (
        <DataGrid
          label="Classes"
          columns={classColumns(orgId, earlier, org?.personName)}
          rows={rows}
          rowKey={(row) => row.id}
          defaultSort={{ column: "name", direction: "ascending" }}
          onRowActivate={(row) =>
            void navigate({
              to: "/$",
              params: { _splat: classHome(orgId, row.id, earlier) },
            })
          }
        />
      ) : canAdd ? (
        <EmptyState
          title="No classes yet"
          action={
            <span className={styles.emptyActions}>
              {org?.can?.includes("roster.import") && (
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "import") }}
                  className={buttonClass("primary")}
                >
                  Import a roster
                </Link>
              )}
              <Button variant="secondary" onClick={() => setAdding(true)}>
                Add class
              </Button>
            </span>
          }
        >
          A roster file can bring in every class at once, or add them one at a
          time.
        </EmptyState>
      ) : (
        <EmptyState title="You’re not on a class yet">
          Your school’s admin adds you to classes from the Staff screen. They’ll
          appear here as soon as that’s done.
        </EmptyState>
      )}
      {canAdd && (
        <AddClassSheet orgId={orgId} open={adding} onOpenChange={setAdding} />
      )}
    </OrgFrame>
  );
}

/** A family has no Students screen or seats: a child's name opens their
 * record in the class, and the seat column isn't there. */
const rosterColumns = (
  orgId: string,
  classId: string,
  family: boolean,
): DataGridColumn<StudentResource>[] => [
  {
    id: "name",
    header: family ? "Child" : "Student",
    width: 220,
    compare: (a, b) => displayName(a).localeCompare(displayName(b), "en"),
    // A student opens in the class, never on the school's Students page.
    cell: (row) => (
      <EntityLink
        entity={{ kind: "student", id: row.id }}
        className={`${styles.person} ${styles.rowLink}`}
      >
        <span>{displayName(row)}</span>
      </EntityLink>
    ),
  },
  {
    id: "grade",
    header: "Grade",
    width: 80,
    compare: (a, b) => (a.gradeLevel ?? -1) - (b.gradeLevel ?? -1),
    cell: (row) => gradeLabel(row.gradeLevel),
  },
  ...(family
    ? []
    : [
        {
          id: "seat",
          header: "Seat",
          width: 130,
          cell: (row: StudentResource) =>
            row.seated ? (
              <Badge tone="success">Seated</Badge>
            ) : (
              <Badge tone="warning">Needs a seat</Badge>
            ),
        },
      ]),
];
export const displayName = (row: StudentResource) =>
  row.displayName ??
  (row.familyName ? `${row.givenName} ${row.familyName}` : row.givenName);

/** Every student in the org, page by page, filtered by class on this client. */
function useClassRoster(orgId: string, classId: string) {
  const session = currentSession();
  const query = useInfiniteQuery({
    queryKey: studentsKey(session, orgId, ""),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchStudents(session, orgId, "", pageParam, signal),
    getNextPageParam: (last) => last.nextOffset,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return {
    query,
    rows: (query.data?.pages.flatMap((page) => page.students) ?? []).filter(
      (student) => student.classIds.includes(classId),
    ),
  };
}

function AddStudentSheet({
  orgId,
  classId,
  className,
  open,
  onOpenChange,
}: {
  orgId: string;
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = currentSession();
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [givenError, setGivenError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useLoggedError(error);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a student"
      description={`To ${className}`}
    >
      <form
        className={styles.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!given.trim()) {
            setGivenError("Enter a first name.");
            return;
          }
          setBusy(true);
          setError("");
          setStatus("");
          void school
            .addStudent(session, orgId, {
              givenName: given.trim(),
              ...(family.trim() ? { familyName: family.trim() } : {}),
              ...(grade !== null ? { gradeLevel: grade } : {}),
              classId,
            })
            .then(async (student) => {
              await refreshSchool(session);
              setStatus(
                student.seated
                  ? `${given.trim()} is in this class.`
                  : `${given.trim()} is in this class and needs a seat.`,
              );
              setGiven("");
              setFamily("");
            })
            .catch((failure) => {
              setError(
                failure instanceof AppError
                  ? failure.message
                  : "That student didn’t save. Try again.",
              );
            })
            .finally(() => setBusy(false));
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
          label="Last name"
          value={family}
          autoComplete="off"
          maxLength={100}
          onChange={(event) => setFamily(event.target.value)}
        />
        <GradePicker value={grade} onChange={setGrade} />
        <FormNote error={error} status={status} />
        <Button
          variant="primary"
          type="submit"
          aria-busy={busy}
          disabled={busy}
          className={styles.sheetAction}
        >
          Add student
        </Button>
      </form>
    </Sheet>
  );
}

/** Where setup lands: one class, its code, and the way to get students in. */
export function ClassScreen() {
  const { org: orgId, class: classId } = useParams({ strict: false }) as {
    org: string;
    class: string;
  };
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const classes = useQuery(classesOptions(session, orgId));
  const klass = classes.data?.find((entry) => entry.id === classId);
  const { query, rows } = useClassRoster(orgId, classId);
  const search = useSearch({ strict: false }) as { add?: unknown };
  const navigate = useNavigate();
  const adding = search.add === 1 || search.add === "1";
  const setAdding = (open: boolean) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        add: open ? 1 : undefined,
      })) as never,
      resetScroll: false,
    });
  const canEdit =
    org?.can?.includes("classes.update") || org?.teaches?.includes(classId);
  const canAdd = canAddStudents(org, classId);
  const family = org?.kind === "family";
  // A family's class adds a child (or a tutor's student), never by the
  // school form: a family has no school roster endpoint.
  const familyAdd = useFamilyAdd(session, org);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  if (!klass)
    return (
      <OrgFrame orgId={orgId} nav="classes" title="Class">
        <EmptyState
          title="This class isn’t available"
          action={
            <Link
              to="/$"
              params={{ _splat: orgPath(orgId, "classes") }}
              className={buttonClass("secondary")}
            >
              See your classes
            </Link>
          }
        >
          It may have been archived, or it isn’t one of yours.
        </EmptyState>
      </OrgFrame>
    );
  const pick = (gradingKind: GradingKind) =>
    void school
      .updateClass(session, orgId, classId, { gradingKind })
      .then(() => refreshSchool(session))
      .then(() =>
        setNotice(
          `${klass.name} now uses ${gradingLabel(gradingKind).toLowerCase()}.`,
        ),
      )
      .catch((failure) =>
        setError(
          failure instanceof AppError
            ? failure.message
            : "That change didn’t save. Try again.",
        ),
      );
  // A family, a tutor or a lone class keeps its year here; a school's classes
  // pick only their grading periods, and the year is the school's
  // (docs/design/ia.md, "Where settings live").
  const small = org?.kind === "family" || org?.solo === true;
  const schoolSettings =
    !family &&
    ["calendar.read", "license.read", "privacy.read", "settings.read"].some(
      (permission) => org?.can?.includes(permission as never),
    );
  return (
    <OrgFrame
      orgId={orgId}
      nav={`class:${classId}`}
      title={klass.name}
      crumbs={[{ label: klass.name }]}
      narrow
    >
      <div className={styles.classSettings}>
        <PageHead
          title="Settings"
          detail={
            family
              ? undefined
              : klass.studentCount
                ? `${klass.studentCount} ${klass.studentCount === 1 ? "student" : "students"}, ${courseLabel(klass.courseBands).toLowerCase()}`
                : courseLabel(klass.courseBands)
          }
          action={
            org?.can?.includes("roster.import") ? (
              <Link
                to="/$"
                params={{ _splat: orgPath(orgId, "import") }}
                className={buttonClass("secondary")}
              >
                Import students
              </Link>
            ) : undefined
          }
        />
        <section className={styles.classMeta}>
          <JoinClass
            code={klass.joinCode}
            place={{ org: orgId, class: classId }}
            family={family}
            manage={
              org?.can?.includes("signin.manage") ||
              org?.teaches?.includes(classId)
            }
          />
          {!small && (
            <ClassGrading
              orgId={orgId}
              orgName={org?.name ?? "the school"}
              kind={klass.gradingKind}
              canEdit={!!canEdit}
              onChange={pick}
            />
          )}
        </section>
        {small && org?.can?.includes("calendar.read") && (
          <YearCalendar
            orgId={orgId}
            compact
            grading={{
              value: klass.gradingKind,
              onChange: pick,
              disabled: !canEdit,
            }}
          />
        )}
        <ClassExperienceSection classId={classId} family={family} />
        {schoolSettings && (
          <ul className={styles.settingsLinks}>
            {schoolSettings && (
              <li>
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "settings") }}
                  className={styles.settingsLink}
                >
                  <span>
                    <strong>{org?.name ?? "School"} settings</strong>
                    <span className={styles.quiet}>
                      {small
                        ? "License, privacy and what students see"
                        : "School year and terms, license, privacy and what students see"}
                    </span>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            )}
          </ul>
        )}
        {!family && (
          <section className={styles.classRoster}>
            <div className={styles.rosterHead}>
              <h2>Students</h2>
              {(canAdd || familyAdd) && (
                <Button variant="secondary" onClick={() => setAdding(true)}>
                  {familyAdd ? familyAddLabel(familyAdd) : "Add student"}
                </Button>
              )}
            </div>
            {query.isPending ? (
              <Loading>Loading students</Loading>
            ) : rows.length ? (
              <DataGrid
                label={`Students in ${klass.name}`}
                columns={rosterColumns(orgId, classId, family)}
                rows={rows}
                rowKey={(row) => row.id}
                defaultSort={{ column: "name", direction: "ascending" }}
                cardLayout="row"
                cardEstimate={72}
                card={(row) => (
                  <EntityLink
                    entity={{ kind: "student", id: row.id }}
                    className={styles.studentCard}
                  >
                    <span className={styles.studentCardText}>
                      <strong>{displayName(row)}</strong>
                      <span>
                        {row.gradeLevel === null
                          ? "Grade not set"
                          : `Grade ${gradeLabel(row.gradeLevel)}`}
                      </span>
                    </span>
                    {family ? null : row.seated ? (
                      <Badge tone="success">Seated</Badge>
                    ) : (
                      <Badge tone="warning">Needs a seat</Badge>
                    )}
                  </EntityLink>
                )}
              />
            ) : (
              <EmptyState
                title={family ? "No children yet" : "No students yet"}
              >
                {family
                  ? "Add a child in Family and they appear here with their grade."
                  : canAdd
                    ? "Add them one at a time, or import a file."
                    : "Students added to this class appear here."}
              </EmptyState>
            )}
            {familyAdd && session ? (
              <AddChildSheet
                session={session}
                kind={familyAdd}
                open={adding}
                onOpenChange={setAdding}
              />
            ) : (
              canAdd && (
                <AddStudentSheet
                  orgId={orgId}
                  classId={classId}
                  className={klass.name}
                  open={adding}
                  onOpenChange={setAdding}
                />
              )
            )}
          </section>
        )}
        {/* A small class has no Grades tab: its target and records are here. */}
        {family && klass.studentCount <= SMALL_CLASS && (
          <SmallClassGrades orgId={orgId} classId={classId} />
        )}
      </div>
      <Toast tone="status" message={notice} onDismiss={() => setNotice("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </OrgFrame>
  );
}

/** A school's class: its grading periods are the school's, said in one line
 * with their dates; a quiet action reveals the picker for the rare class that
 * needs its own (a split calendar, a semester block). A class that has its
 * own shows them, with the way back to the school's (Q-43). */
function ClassGrading({
  orgId,
  orgName,
  kind,
  canEdit,
  onChange,
}: {
  orgId: string;
  orgName: string;
  kind: GradingKind;
  canEdit: boolean;
  onChange: (kind: GradingKind) => void;
}) {
  const session = currentSession();
  const grading = useQuery(schoolGradingOptions(session, orgId)).data;
  const sessions = useQuery(calendarOptions(session, orgId)).data ?? [];
  const [choosing, setChoosing] = useState(false);
  if (!grading) return null;
  const follows = kind === grading.kind;
  const terms = sessions
    .filter((term) => term.kind === kind)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    .map(
      (term) =>
        `${formatDay(term.startsOn, false)}–${formatDay(term.endsOn, false)}`,
    )
    .join(", ");
  if (follows && !choosing)
    return (
      <div className={styles.field} data-class-grading="follows">
        <span className={styles.fieldLabel}>Grading periods</span>
        <p className={styles.gradingLine}>
          {gradingLabel(kind)}, from {orgName}
          {terms && <span className={styles.quiet}> · {terms}</span>}
        </p>
        {canEdit && (
          <Button
            variant="quiet"
            align="start"
            onClick={() => setChoosing(true)}
          >
            Use different periods for this class
          </Button>
        )}
      </div>
    );
  return (
    <div
      className={styles.field}
      data-class-grading={follows ? "choosing" : "own"}
    >
      <span className={styles.fieldLabel}>Grading periods</span>
      <Segmented
        label="Grading periods"
        compact
        dense
        disabled={!canEdit}
        value={kind}
        onChange={(next) => {
          onChange(next);
          if (next === grading.kind) setChoosing(false);
        }}
        options={GRADING.map((value) => ({
          value,
          label: gradingLabel(value),
        }))}
      />
      <SettingMeta
        scope="class"
        own={!follows}
        setBy={null}
        lockedAbove={null}
        reset={
          canEdit && !follows
            ? {
                label: `Use ${orgName}’s`,
                onClick: () => {
                  onChange(grading.kind);
                  setChoosing(false);
                },
              }
            : undefined
        }
      />
    </div>
  );
}

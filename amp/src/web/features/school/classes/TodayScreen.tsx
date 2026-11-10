import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type {
  ClassTabId,
  TodayTodo,
} from "../../../../schools/teacher-contracts";
import { AvatarStack } from "../../../ui/Avatar";
import { Button, buttonClass } from "../../../ui/Button";
import { CheckboxControl } from "../../../ui/Checkbox";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Sheet } from "../../../ui/Sheet";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { LessonBoundary } from "../../pathways/LessonRecovery";
import { presenceOptions, useStaffSession } from "./api";
import { currentSession } from "../api";
import { ClassFrame } from "./ClassFrame";
import { useDemoOrg } from "../demo/DemoPlace";
import { ClassMap, MapKey } from "./ClassMap";
import { useSchoolNavigation } from "../../navigation/school-navigation";
import { FamilyPanel } from "./FamilyPanel";
import { mapOptions, studentRecordOptions, todayOptions } from "./teacher-api";
import { StudentSections } from "./StudentSections";
import { TryAsStudent } from "../../profiles/TryAsStudent";
import {
  classUrl,
  fullDay,
  LoadFailed,
  number,
  studentUrl,
  useClassSearch,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

const SkillLesson = lazy(() => import("../../pathways/SkillLesson"));
/** On Today the map is a glance; its own tab shows every strand. */
const TODAY_STRANDS = 5;
/** A class's week reads in the thousands; a smaller count says nothing. */
const PROBLEMS_WORTH_STATING = 1000;

/** A check is for today, on this device: the list is back tomorrow if it's
 * still true. */
function readChecks(key: string): ReadonlySet<string> {
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch (error) {
    console.warn("Today’s checks couldn’t be read on this device", error);
    return new Set();
  }
}
function useChecks(classId: string, today: string | undefined) {
  const key = today ? `amp.school.done.${classId}.${today}` : "";
  const [state, setState] = useState(() => ({ key, done: readChecks(key) }));
  // Read as the day arrives, so the first paint with it is already right.
  const done = state.key === key ? state.done : readChecks(key);
  if (state.key !== key) setState({ key, done });
  useEffect(() => {
    if (!key) return;
    try {
      for (const stored of Object.keys(localStorage))
        if (stored.startsWith(`amp.school.done.${classId}.`) && stored !== key)
          localStorage.removeItem(stored);
    } catch (error) {
      console.warn("Earlier checks couldn’t be cleared on this device", error);
    }
  }, [classId, key]);
  const set = (id: string, on: boolean) => {
    const next = new Set(done);
    if (on) next.add(id);
    else next.delete(id);
    setState({ key, done: next });
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch (error) {
      console.warn("Today’s checks couldn’t be saved on this device", error);
    }
  };
  return [done, set] as const;
}

function TodoAction({
  todo,
  org,
  classId,
  primary,
  onLesson,
}: {
  todo: TodayTodo;
  org: string;
  classId: string;
  primary: boolean;
  onLesson: (templateId: string) => void;
}) {
  const { action } = todo;
  const look = primary ? "primary" : "secondary";
  if (action.kind === "lesson")
    return (
      <Button variant={look} onClick={() => onLesson(action.templateId)}>
        {action.label}
      </Button>
    );
  const target =
    action.kind === "skill"
      ? { to: `pathways/${action.skillId}`, search: {} }
      : action.kind === "student"
        ? {
            to: studentUrl(org, action.personId),
            search: { class: classId },
          }
        : {
            to: classUrl(org, classId, action.tab as ClassTabId | "start"),
            search: action.tab === "settings" ? { add: 1 } : {},
          };
  return (
    <Link
      to="/$"
      params={{ _splat: target.to }}
      search={target.search as never}
      className={buttonClass(look)}
    >
      {action.label}
    </Link>
  );
}

/** A first-run step is done by doing it, so there's nothing to check off. */
const isFirstStep = (todo: TodayTodo) =>
  todo.id === "add-students" || todo.id === "start-class";
const AVATARS_SHOWN = 8;

function Todo({
  todo,
  done,
  onDone,
  children,
}: {
  todo: TodayTodo;
  done: boolean;
  onDone: (on: boolean) => void;
  children: ReactNode;
}) {
  const names = todo.students.map((student) => student.name);
  const hidden = names.length - AVATARS_SHOWN;
  const plain = isFirstStep(todo);
  return (
    <li
      className={styles.todo}
      data-done={done || undefined}
      data-plain={plain || undefined}
    >
      {!plain && (
        <span className={styles.todoCheck}>
          <CheckboxControl
            aria-label={`Done: ${todo.title}`}
            checked={done}
            onChange={(event) => onDone(event.target.checked)}
          />
        </span>
      )}
      <div className={styles.todoBody}>
        <h2 className={styles.todoTitle}>{todo.title}</h2>
        <p className={styles.todoDetail}>{todo.detail}</p>
        {names.length > 0 && (
          <div className={styles.todoPeople}>
            <AvatarStack
              names={names.slice(0, AVATARS_SHOWN)}
              label={names.join(", ")}
            />
            {hidden > 0 && <span className={styles.moreFaces}>+{hidden}</span>}
          </div>
        )}
      </div>
      <div className={styles.todoActions}>{children}</div>
    </li>
  );
}

/** Today for one class: who needs the teacher and what to do about it, what's
 * going well, the week in a line, then the whole class on one map. */
export function TodayScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/today" });
  const session = useStaffSession();
  const today = useQuery(todayOptions(session, place));
  const map = useQuery(mapOptions(session, place));
  // The class code, for a student's own device: with Today, never after it.
  const presence = useQuery(presenceOptions(session, place));
  const code = presence.data?.class.joinCode;
  const [search, set] = useClassSearch();
  const [done, setDone] = useChecks(place.class, today.data?.today);
  const lesson =
    typeof search.lesson === "string" ? search.lesson.slice(0, 100) : undefined;
  const lessonTodo = today.data?.todos.find(
    (todo) =>
      todo.action.kind === "lesson" && todo.action.templateId === lesson,
  );
  const data = today.data;
  const week = data?.week;
  const demo = useDemoOrg(place.org);
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={today.isPending || map.isPending || presence.isPending}
      tab="today"
    >
      {!data || !week || !map.data ? (
        <LoadFailed
          what="Today"
          onRetry={() => {
            void today.refetch();
            void map.refetch();
          }}
        />
      ) : (
        <div className={styles.page}>
          <div className={styles.greeting}>
            <h1>
              Good {data.partOfDay}
              {data.teacherName ? `, ${data.teacherName}` : ""}.
            </h1>
            <p>{fullDay(data.today)}</p>
            {code && (
              <p className={styles.code}>
                <span>Class code</span>{" "}
                <strong data-class-code={code}>
                  {code.slice(0, 3)}-{code.slice(3)}
                </strong>
              </p>
            )}
            {demo && (
              // A demo's bar leads to the real class, so the board opens here.
              <Link
                to="/school/$org/classes/$class/start"
                params={place}
                className={`${buttonClass("secondary")} ${styles.startClass}`}
              >
                Start class
              </Link>
            )}
          </div>
          <FamilyPanel classId={place.class} />
          <ul className={styles.todos} aria-label="What needs you today">
            {data.todos.map((todo, index) => (
              <Todo
                key={todo.id}
                todo={todo}
                done={done.has(todo.id)}
                onDone={(on) => setDone(todo.id, on)}
              >
                <TodoAction
                  todo={todo}
                  org={place.org}
                  classId={place.class}
                  primary={index === 0}
                  onLesson={(templateId) => set({ lesson: templateId })}
                />
                {todo.groupSheet && data.canPrint && (
                  <Link
                    to="/school/$org/classes/$class/workbooks"
                    params={place}
                    search={{
                      students: todo.students
                        .map((student) => student.id)
                        .join(","),
                      skill: todo.groupSheet.skillId,
                    }}
                    className={buttonClass("secondary")}
                  >
                    {todo.groupSheet.label}
                  </Link>
                )}
              </Todo>
            ))}
          </ul>
          {week.students > 0 && (
            <section className={styles.week} aria-labelledby="school-week">
              <h2 id="school-week" className={styles.weekTitle}>
                This week
              </h2>
              <StatRow>
                <StatTile value={number(week.minutes)} label="active minutes" />
                {week.problems >= PROBLEMS_WORTH_STATING ? (
                  <StatTile value={number(week.problems)} label="problems" />
                ) : (
                  <StatTile
                    value={number(week.skills)}
                    label="skills practiced"
                  />
                )}
                <StatTile
                  value={`${week.working} of ${week.students}`}
                  label="students working"
                />
              </StatRow>
            </section>
          )}
          {map.data.students.length > 0 && (
            <section aria-labelledby="school-map">
              <div className={styles.mapHead}>
                <h2 id="school-map">Class map</h2>
                <MapKey data={map.data} />
              </div>
              <ClassMap data={map.data} limitStrands={TODAY_STRANDS} />
            </section>
          )}
        </div>
      )}
      <Sheet
        tall
        open={!!lesson}
        onOpenChange={(open) => {
          if (!open) set({ lesson: undefined });
        }}
        title={lessonTodo?.title ?? "Lesson"}
        description={
          lessonTodo
            ? lessonTodo.students.map((student) => student.name).join(", ")
            : undefined
        }
      >
        {lesson && (
          <LessonBoundary
            key={lesson}
            onBack={() => set({ lesson: undefined })}
          >
            <Suspense fallback={<Loading>Loading lesson…</Loading>}>
              <SkillLesson
                templateId={lesson}
                onBack={() => set({ lesson: undefined })}
              />
            </Suspense>
          </LessonBoundary>
        )}
      </Sheet>
    </ClassFrame>
  );
}

/** The class map alone, with every strand. */
export function MapScreen() {
  const params = useParams({ strict: false }) as {
    org: string;
    class: string;
    student?: string;
  };
  const place = { org: params.org, class: params.class };
  const session = useStaffSession();
  const map = useQuery(mapOptions(session, place));
  const navigate = useNavigate();
  // The class's code board, where students join; offered as the map's one
  // step only where the bar would offer it (a current class).
  const { start } = useSchoolNavigation({
    kind: "class",
    org: place.org,
    classId: place.class,
    active: "map",
    board: false,
  });
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={map.data?.class.name}
      loading={map.isPending}
      tab="map"
    >
      {!map.data ? (
        <LoadFailed what="The class map" onRetry={() => void map.refetch()} />
      ) : map.data.students.length === 0 ? (
        <div className={styles.page}>
          <h1>Class map</h1>
          <EmptyMap org={place.org} classId={place.class} />
        </div>
      ) : (
        <div>
          <div className={styles.mapHead}>
            <h1>Class map</h1>
            <MapKey data={map.data} />
          </div>
          <MapStudentSheet
            org={place.org}
            classId={place.class}
            student={params.student}
            onClose={() =>
              void navigate({
                to: "/$",
                params: { _splat: classUrl(place.org, place.class, "map") },
                replace: true,
              })
            }
          />
          <ClassMap
            data={map.data}
            action={
              start ? (
                <Link
                  to="/$"
                  params={{ _splat: classUrl(place.org, place.class, "start") }}
                  className={buttonClass("primary")}
                >
                  Start class
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
    </ClassFrame>
  );
}

/** One student, over the map: their whole record in one column, with
 * trying their level and printing. Its own URL under the class
 * (`map/<student>`), so the class's tabs stay and Back closes it. */
function MapStudentSheet({
  org,
  classId,
  student,
  onClose,
}: {
  org: string;
  classId: string;
  student: string | undefined;
  onClose: () => void;
}) {
  const session = useStaffSession();
  const record = useQuery({
    ...studentRecordOptions(session, student ?? ""),
    enabled: !!student,
  });
  const data = record.data;
  return (
    <Sheet
      open={!!student}
      tall
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={data?.student.name ?? "Student"}
      description={
        data ? data.classes.map((entry) => entry.name).join(", ") : undefined
      }
      returnFocus={() =>
        document.querySelector<HTMLElement>(`[data-map-student="${student}"]`)
      }
    >
      {!data ? (
        record.isError ? (
          <LoadFailed
            what="This record"
            onRetry={() => void record.refetch()}
          />
        ) : (
          <Loading />
        )
      ) : (
        <div className={styles.sheetRecord}>
          <div className={styles.recordAction}>
            <TryAsStudent
              session={currentSession()}
              personId={data.student.id}
            />
            <Button variant="quiet" onClick={() => window.print()}>
              Print progress report
            </Button>
          </div>
          <StudentSections data={data} org={org} single />
        </div>
      )}
    </Sheet>
  );
}

function EmptyMap({ org, classId }: { org: string; classId: string }) {
  return (
    <EmptyState
      title="No students in this class yet"
      action={
        <Link
          to="/$"
          params={{ _splat: classUrl(org, classId, "settings") }}
          search={{ add: 1 } as never}
          className={buttonClass("primary")}
        >
          Add students
        </Link>
      }
    >
      Each student gets a row here, placed by the work they do.
    </EmptyState>
  );
}

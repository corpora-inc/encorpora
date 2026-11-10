import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { TodayResponse } from "../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Sheet } from "../../../ui/Sheet";
import { meOptions } from "../../../lib/query";
import { LessonBoundary } from "../../pathways/LessonRecovery";
import { secondParentOptions } from "../../second-parent/api";
import { currentSession, orgOptions } from "../api";
import { useDemoOrg } from "../demo/DemoPlace";
import { presenceOptions, useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { ClassMap, MapKey } from "./ClassMap";
import { useSchoolNavigation } from "../../navigation/school-navigation";
import { mapOptions, studentRecordOptions, todayOptions } from "./teacher-api";
import { StudentSections } from "./StudentSections";
import { TryAsStudent } from "../../profiles/TryAsStudent";
import {
  classUrl,
  fullDay,
  LoadFailed,
  useClassSearch,
} from "./teacher-shared";
import { FamilyNotice } from "./today/FamilyNotice";
import { FamilyToday } from "./today/FamilyToday";
import { Feed } from "./today/Feed";
import { SignInCode } from "./today/SignInCode";
import { todoEntries, useChecks } from "./today/todo-entries";
import { WeekFacts } from "./today/WeekFacts";
import todayStyles from "./today/Today.module.css";
import styles from "./Teacher.module.css";

const SkillLesson = lazy(() => import("../../pathways/SkillLesson"));

/** A class's Today (the /schools product shot): a feed of what to do and
 * why, then the week in a line. No map: Map is its own tab. */
function ClassToday({
  data,
  place,
  onLesson,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  onLesson: (templateId: string) => void;
}) {
  const [done, setDone] = useChecks(place.class, data.today);
  const entries = todoEntries({
    todos: data.todos,
    place,
    canPrint: data.canPrint,
    onLesson,
    people: true,
  });
  // Before anyone has started, the next step after the board: cards for
  // the students who sign in on a device of their own.
  const starting = data.todos.some((todo) => todo.id === "start-class");
  if (starting && data.canPrint)
    entries.push({
      id: "cards",
      title: `Print sign-in cards for ${data.students.length === 1 ? "your student" : `your ${data.students.length} students`}`,
      detail:
        "A card signs a student in with one scan, on a shared device or their own.",
      mark: "check",
      actions: (
        <Link
          to="/school/$org/classes/$class/cards"
          params={place}
          search={{}}
          className={buttonClass("secondary")}
        >
          Print cards
        </Link>
      ),
    });
  return (
    <>
      <Feed
        label="What needs you today"
        entries={entries}
        done={done}
        onDone={setDone}
      />
      <WeekFacts
        week={data.week}
        family={false}
        target={data.weeklyTargetMinutes}
      />
    </>
  );
}

/** Today for one class, about today (docs/design/ia.md). A class's: its name
 * and the date, the class code, the feed, the week. A family's: the date
 * (never the parent's own name), the code, each child on a line, the same
 * feed in a parent's words, the week. Who else teaches or belongs lives on
 * People. */
export function TodayScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/today" });
  const session = useStaffSession();
  const account = currentSession();
  const org = useQuery({
    ...orgOptions(account, place.org),
    refetchOnMount: false,
  });
  const family = org.data?.kind === "family";
  const today = useQuery(todayOptions(session, place));
  // The class code, for a student's own device: with Today, never after it.
  const presence = useQuery(presenceOptions(session, place));
  const code = presence.data?.class.joinCode;
  const me = useQuery(meOptions(account)).data;
  const signedIn = me?.signedIn ? me : undefined;
  const holder = signedIn?.familyClass?.classId === place.class;
  const secondParent = useQuery({
    ...secondParentOptions(account),
    enabled: holder,
  });
  const [search, set] = useClassSearch();
  const lesson =
    typeof search.lesson === "string" ? search.lesson.slice(0, 100) : undefined;
  const lessonTodo = today.data?.todos.find(
    (todo) =>
      todo.action.kind === "lesson" && todo.action.templateId === lesson,
  );
  const data = today.data;
  const demo = useDemoOrg(place.org);
  const loading =
    org.isPending ||
    today.isPending ||
    presence.isPending ||
    (holder && secondParent.isPending);
  const onLesson = (templateId: string) => set({ lesson: templateId });
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={loading}
      tab="today"
      // The class's name is this page's title.
      place={false}
    >
      {!data ? (
        <LoadFailed what="Today" onRetry={() => void today.refetch()} />
      ) : (
        <div className={todayStyles.today}>
          <header className={todayStyles.head}>
            {family ? (
              <h1>{fullDay(data.today)}</h1>
            ) : (
              <div className={todayStyles.title}>
                <h1>{data.class.name}</h1>
                <p>{fullDay(data.today)}</p>
              </div>
            )}
            {code && (
              <SignInCode
                code={code}
                place={place}
                family={family}
                // The bar's Start class opens the board, except in a demo
                // (its bar leads to the real class) and a family (no class
                // to start).
                board={family || demo}
              />
            )}
          </header>
          {signedIn && holder && (
            <FamilyNotice session={account} me={signedIn} />
          )}
          {family ? (
            <FamilyToday
              data={data}
              place={place}
              session={account}
              me={signedIn}
              secondParent={holder ? secondParent.data : undefined}
              onLesson={onLesson}
            />
          ) : (
            <ClassToday data={data} place={place} onLesson={onLesson} />
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

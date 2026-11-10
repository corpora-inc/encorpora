import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { buttonClass } from "../../../ui/Button";
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
import { mapOptions, todayOptions } from "./teacher-api";
import {
  classUrl,
  fullDay,
  LoadFailed,
  useClassSearch,
} from "./teacher-shared";
import { ChildList } from "./today/ChildList";
import { FamilyNotice } from "./today/FamilyNotice";
import {
  SecondParentHint,
  secondParentHintDismissed,
} from "./today/SecondParentHint";
import { SignInCode } from "./today/SignInCode";
import { TodoList } from "./today/TodoList";
import { WeekFacts } from "./today/WeekFacts";
import todayStyles from "./today/Today.module.css";
import styles from "./Teacher.module.css";

const SkillLesson = lazy(() => import("../../pathways/SkillLesson"));
/** On Today the map is a glance; its own tab shows every strand. */
const TODAY_STRANDS = 5;

/** Today for one class, about today: the date and the class code, the week
 * in a line, then a family's children one row each (level, today, the week,
 * access, practice here) or a class's to-dos and its map. Who else teaches or
 * belongs lives on People; Today carries at most one quiet line about it. */
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
  // A family's rows show each child's level; a class's Today has the map.
  const map = useQuery({
    ...mapOptions(session, place),
    enabled: !!session && org.isSuccess && !family,
  });
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
  const [hintGone, setHintGone] = useState(() =>
    secondParentHintDismissed(account.accountId),
  );
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
    (!family && map.isPending) ||
    (holder && secondParent.isPending);
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={loading}
      tab="today"
    >
      {!data || (!family && !map.data) ? (
        <LoadFailed
          what="Today"
          onRetry={() => {
            void today.refetch();
            void map.refetch();
          }}
        />
      ) : (
        <div className={todayStyles.today}>
          <header className={todayStyles.head}>
            <h1>{fullDay(data.today)}</h1>
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
          <WeekFacts week={data.week} family={family} />
          {holder &&
            secondParent.isSuccess &&
            !secondParent.data &&
            !hintGone && (
              <SecondParentHint
                session={account}
                onDismiss={() => setHintGone(true)}
              />
            )}
          {family && (
            <ChildList
              students={data.students}
              session={account}
              me={signedIn}
              classId={place.class}
            />
          )}
          <TodoList
            todos={data.todos}
            today={data.today}
            place={place}
            canPrint={data.canPrint}
            onLesson={(templateId) => set({ lesson: templateId })}
          />
          {/* The map once someone can be placed on it: never empty axes. */}
          {!family && map.data?.students.some((student) => student.level) && (
            <section aria-labelledby="school-map">
              <div className={todayStyles.mapHead}>
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
  const place = useParams({ from: "/school/$org/classes/$class/map" });
  const session = useStaffSession();
  const map = useQuery(mapOptions(session, place));
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
          <ClassMap data={map.data} />
        </div>
      )}
    </ClassFrame>
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

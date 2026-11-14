import { spaceWords } from "../../spaces/words";
import { standing } from "../../../lib/AppError";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { TodayResponse } from "../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { meOptions } from "../../../lib/query";
import { secondParentOptions } from "../../second-parent/api";
import { currentSession, orgOptions } from "../api";
import { classYearOptions } from "../org/org-api";
import { useDemoOrg } from "../demo/DemoPlace";
import { presenceOptions, useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { ClassMap, MapKey } from "./ClassMap";
import { useSchoolNavigation } from "../../navigation/school-navigation";
import { mapOptions, todayOptions } from "./teacher-api";
import { classUrl, fullDay, LoadFailed } from "./teacher-shared";
import { FamilyNotice } from "./today/FamilyNotice";
import { FamilyToday } from "./today/FamilyToday";
import { Feed } from "./today/Feed";
import { PracticeSlot } from "./today/PracticeSlot";
import { todoEntries, useChecks } from "./today/todo-entries";
import { WeekFacts } from "./today/WeekFacts";
import todayStyles from "./today/Today.module.css";
import styles from "./Teacher.module.css";
import {
  accessFeedEntry,
  AccessSheets,
  useClassAccess,
} from "../pilots/ClassAccess";

/** A class's Today (the /schools product shot): a feed of what to do and
 * why, then the week in a line. No map: Map is its own tab. */
function ClassToday({
  data,
  place,
  headed,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  /** The header's practice slot says where practice stands (PracticeSlot):
   * starting, waiting, ended and "couldn't check" live there, not here. */
  headed: boolean;
}) {
  const [done, setDone] = useChecks(place.class, data.today);
  const { start: canStart } = useSchoolNavigation({
    kind: "class",
    org: place.org,
    classId: place.class,
    active: "today",
    leaf: "today",
    board: false,
  });
  const access = useClassAccess(place);
  // The board and cards wait for practice, and end with it.
  const closed = access.closed;
  // What this person may do in this class, as the server says (a viewer
  // or an aide reads the class; adding students and printing cards are
  // its teacher's and its school's).
  const can = new Set(
    standing(
      useQuery({
        ...classYearOptions(currentSession(), place.class),
        refetchOnMount: false,
      }),
    )?.can ?? [],
  );
  const adds = can.has("class.import") || can.has("students.add");
  const entry = accessFeedEntry(
    access.view,
    place,
    access.pilot,
    access.teaches,
  );
  // Practice running, but not for everyone, or ending soon: said in the
  // feed beside the code. The rest is the header slot's.
  const practice =
    headed &&
    (access.closed || !["ending", "partial"].includes(access.view.kind))
      ? null
      : entry;
  const entries = todoEntries({
    // Anything that opens the board ("Start class", students who haven't
    // started) waits for practice: the board would only say it's closed.
    todos: data.todos.filter(
      (todo) =>
        (adds || todo.id !== "add-students") &&
        ((canStart && !closed) ||
          (todo.id !== "start-class" &&
            !("tab" in todo.action && todo.action.tab === "start"))),
    ),
    place,
    canPrint: data.canPrint,
    people: true,
    // Practice access leads when it needs doing; then the class's own items.
    lead: !practice,
    importStudents: true,
  });
  if (practice) entries.unshift(practice);
  // Couldn't check where practice stands: said calmly, with Try again,
  // never a dead closed state.
  if (access.unavailable && !headed)
    entries.unshift({
      id: "practice-unknown",
      title: "Couldn’t check practice",
      detail: "",
      mark: "status",
      actions: (
        <Button variant="secondary" onClick={access.retry}>
          Try again
        </Button>
      ),
    });
  // Before anyone has started, the next step after the board: cards for
  // the students who sign in on a device of their own.
  const starting = data.todos.some((todo) => todo.id === "start-class");
  if (starting && can.has("signin.manage") && !closed)
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
        words={spaceWords("classroom")}
        target={data.weeklyTargetMinutes}
        students={data.students}
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
  const data = today.data;
  const demo = useDemoOrg(place.org);
  const access = useClassAccess(place);
  // The header's practice slot (PracticeSlot): the Start action, the code,
  // Request seats, one height in every state, so practice opening during
  // this visit moves nothing (CP-3 r6).
  const signInRead = (
    standing(
      useQuery({
        ...classYearOptions(account, place.class),
        refetchOnMount: false,
      }),
    )?.can ?? []
  ).includes("signin.read");
  const headed = !family && !!data && data.students.length > 0 && signInRead;
  const loading =
    access.pending ||
    org.isPending ||
    today.isPending ||
    presence.isPending ||
    (holder && secondParent.isPending);
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
            {/* The title is the day for a family and the class's name for
                a class: never a greeting or the viewer's own name. */}
            {family ? (
              <h1 data-today-title="">{fullDay(data.today)}</h1>
            ) : (
              <div className={todayStyles.title}>
                <h1 data-today-title="">{data.class.name}</h1>
                <p>{fullDay(data.today)}</p>
              </div>
            )}
            {/* The code waits for a roster, and for practice. A family's
                children mostly practice on the parent's device: their code
                is an option under the children, not the page's lead. */}
            {headed && (
              <PracticeSlot
                place={place}
                words={spaceWords("classroom")}
                // The bar's Start class opens the board, except in a demo
                // (its bar leads to the real class).
                board={demo}
                manage={presence.data?.canManage ?? false}
                locked={!!presence.data?.class.joinLockedUntil}
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
              code={code ?? null}
              manage={presence.data?.canManage ?? false}
              locked={!!presence.data?.class.joinLockedUntil}
              session={account}
              me={signedIn}
              secondParent={holder ? secondParent.data : undefined}
            />
          ) : (
            <>
              <ClassToday data={data} place={place} headed={headed} />
              <AccessSheets place={place} />
            </>
          )}
        </div>
      )}
    </ClassFrame>
  );
}

/** The class map alone, with every strand. */
export function MapScreen() {
  const params = useParams({ strict: false }) as {
    org: string;
    class: string;
  };
  const place = { org: params.org, class: params.class };
  const session = useStaffSession();
  const map = useQuery(mapOptions(session, place));
  const family =
    useQuery({
      ...orgOptions(currentSession(), place.org),
      refetchOnMount: false,
    }).data?.kind === "family";
  const words = spaceWords(family ? "family" : "classroom");
  // The class's code board, where students join; offered as the map's one
  // step only where the bar would offer it (a current class).
  const { start } = useSchoolNavigation({
    kind: "class",
    org: place.org,
    classId: place.class,
    active: "map",
    leaf: "map",
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
          <ScreenTitle>{family ? "Map" : "Class map"}</ScreenTitle>
          <EmptyMap org={place.org} classId={place.class} />
        </div>
      ) : (
        <div>
          <div className={styles.mapHead}>
            <ScreenTitle>{family ? "Map" : "Class map"}</ScreenTitle>
            <MapKey data={map.data} words={words} />
          </div>
          <ClassMap
            data={map.data}
            words={words}
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

function EmptyMap({ org, classId }: { org: string; classId: string }) {
  // Only someone who may add them is offered it. A family's map keeps the
  // way it has (P2 moves the family's own).
  const family =
    useQuery({
      ...orgOptions(currentSession(), org),
      refetchOnMount: false,
    }).data?.kind === "family";
  const can =
    standing(
      useQuery({
        ...classYearOptions(currentSession(), classId),
        refetchOnMount: false,
      }),
    )?.can ?? [];
  const adds =
    family || can.includes("class.import") || can.includes("students.add");
  return (
    <EmptyState
      title="No students in this class yet"
      action={
        adds && (
          <Link
            to="/$"
            params={{ _splat: classUrl(org, classId, "settings") }}
            search={{ add: 1 } as never}
            className={buttonClass("primary")}
          >
            Add students
          </Link>
        )
      }
    />
  );
}

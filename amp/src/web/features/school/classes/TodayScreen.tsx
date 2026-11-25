import { sheetState } from "../../../nav/sheet";
import { spaceWords } from "../../spaces/words";
import { standing } from "../../../lib/AppError";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { TodayResponse } from "../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { meOptions } from "../../../lib/query";
import { currentSession, orgOptions } from "../api";
import { classYearOptions } from "../org/org-api";
import { presenceOptions, useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { ClassMap, MapKey } from "./ClassMap";
import { useSchoolNavigation } from "../../navigation/school-navigation";
import { mapOptions, todayOptions } from "./teacher-api";
import { classUrl, fullDay, LoadFailed } from "./teacher-shared";
import { ClassCockpit, type CockpitWords } from "./today/ClassCockpit";
import { FamilyNotice } from "./today/FamilyNotice";
import { Feed } from "./today/Feed";
import { PracticeSlot } from "./today/PracticeSlot";
import { todoEntries, useChecks } from "./today/todo-entries";
import { useCockpitShown } from "./today/use-cockpit-shown";
import { WeekFacts } from "./today/WeekFacts";
import todayStyles from "./today/Today.module.css";
import { pilotLeft } from "../pilots/presentation";
import styles from "./Teacher.module.css";
import {
  accessFeedEntry,
  useEndedStep,
  AccessSheets,
  useClassAccess,
} from "../pilots/ClassAccess";

const COCKPIT_WORDS: CockpitWords = {
  start: "Start class",
  nameHeader: "Student",
  roster: "Students in this session",
};

/** A class's Today (the /schools product shot): a feed of what to do and
 * why, then the week in a line. No map: Map is its own tab. */
function ClassToday({
  data,
  place,
  headed,
  cockpit,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  /** The header's practice slot says where practice stands (PracticeSlot):
   * starting, waiting, ended and "couldn't check" live there, not here. */
  headed: boolean;
  /** The session control is on the page above: it is how class starts, so
   * the feed doesn't say "Start class" again. */
  cockpit: boolean;
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
  const ended = useEndedStep(place);
  const entry = accessFeedEntry(
    access.view,
    place,
    access.pilot,
    access.requests,
    ended,
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
        !(cockpit && todo.id === "start-class") &&
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

/** Today for one class, about today (docs/design/ia.md): its name and the
 * date, the class code, the feed, the week. A family's own Today is
 * features/family/Today.tsx. Who else teaches or belongs lives on People. */
export function TodayScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/today" });
  const session = useStaffSession();
  const account = currentSession();
  const org = useQuery({
    ...orgOptions(account, place.org),
    refetchOnMount: false,
  });
  // A family-kind class reached at its class address is a tutoring group: a
  // parent's own family class opens at /family, so this is the classroom
  // composition, the whole group, in a classroom's words.
  const today = useQuery(todayOptions(session, place));
  // The class's sign-in standing, for the header's practice slot.
  const presence = useQuery(presenceOptions(session, place));
  const me = useQuery(meOptions(account)).data;
  const signedIn = me?.signedIn ? me : undefined;
  const holder = signedIn?.familyClass?.classId === place.class;
  const data = today.data;
  const access = useClassAccess(place);
  const pilotNote = pilotLeft(access.view);
  // The header's practice slot (PracticeSlot): the Start action, the code,
  // Request seats, one height in every state, so practice opening during
  // this visit moves nothing (CP-3 r6).
  const can = new Set(
    standing(
      useQuery({
        ...classYearOptions(account, place.class),
        refetchOnMount: false,
      }),
    )?.can ?? [],
  );
  const signInRead = can.has("signin.read");
  const headed = !!data && data.students.length > 0 && signInRead;
  // The live session (#2465): where students can practice (or a demo), for
  // anyone who may watch one. A session already running always shows.
  const { start: canStart } = useSchoolNavigation({
    kind: "class",
    org: place.org,
    classId: place.class,
    active: "today",
    leaf: "today",
    board: false,
  });
  const cockpit = headed && can.has("session.read");
  // While the cockpit shows a session, a phone's header gives its code one
  // short row so the roster starts on the first screen.
  const live = useCockpitShown(place, cockpit);
  // A class's code has its own place (PracticeSlot), loading or failing
  // there without holding the page.
  const loading = access.pending || org.isPending || today.isPending;
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={loading}
      tab="today"
    >
      {!data ? (
        <LoadFailed what="Today" onRetry={() => void today.refetch()} />
      ) : (
        <div className={todayStyles.today} data-live={live || undefined}>
          <header className={todayStyles.head}>
            {/* The title is the class's name: never a greeting or the
                viewer's own name. */}
            <div className={todayStyles.title}>
              <h1 data-today-title="">{data.class.name}</h1>
              <p>{fullDay(data.today)}</p>
              {/* Days left in the pilot or its grace. Its line is always
                  held, so a pilot starting, its grace or the paywall never
                  moves the header (premium rule 1). */}
              <p
                data-pilot-left=""
                aria-hidden={pilotNote ? undefined : true}
                className={pilotNote ? undefined : todayStyles.heldLine}
              >
                {pilotNote ?? "\u00a0"}
              </p>
            </div>
            {/* The code waits for a roster, and for practice. A family's
                children mostly practice on the parent's device: their code
                is an option under the children, not the page's lead. */}
            {headed && (
              <PracticeSlot
                place={place}
                words={spaceWords("classroom")}
                // The board, projected, is opened from the code: the bar's
                // Start class starts the session (#2465).
                board
                manage={presence.data?.canManage ?? false}
                locked={!!presence.data?.class.joinLockedUntil}
                live={live}
              />
            )}
          </header>
          {signedIn && holder && <FamilyNotice me={signedIn} />}
          {cockpit && (
            <ClassCockpit
              place={place}
              available={canStart}
              words={COCKPIT_WORDS}
              can={{
                resolve: can.has("signal.resolve"),
                resetPictures: can.has("signin.manage"),
              }}
              // Staff see levels, as on the map and in grades; the class's
              // "levels" setting is what its students see.
              showGradeNumbers
            />
          )}
          <ClassToday
            data={data}
            place={place}
            headed={headed}
            cockpit={cockpit && canStart}
          />
          <AccessSheets place={place} />
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
  // A family-kind class reached at its class address is a tutoring group: a
  // parent's own family class opens at /family, so this is the classroom
  // composition, the whole group, in a classroom's words.
  const words = spaceWords("classroom");
  // Start class is the bar's (a live session, #2465): the map has none of
  // its own.
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
          <ScreenTitle>Class map</ScreenTitle>
          <EmptyMap org={place.org} classId={place.class} />
        </div>
      ) : (
        <div>
          <div className={styles.mapHead}>
            <ScreenTitle>Class map</ScreenTitle>
            <MapKey data={map.data} words={words} />
          </div>
          <ClassMap
            data={map.data}
            words={words}
            crossCutting
            // Ranges in grade words, as everywhere else ("Gr 7–Geom").
            plain
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
            state={sheetState("add") as never}
            className={buttonClass("primary")}
          >
            Add students
          </Link>
        )
      }
    />
  );
}

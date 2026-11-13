import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type {
  ClassTabId,
  TodayTodo,
} from "../../../../../schools/teacher-contracts";
import { buttonClass } from "../../../../ui/Button";
import type { FeedEntry } from "./Feed";
import { classUrl } from "../teacher-shared";
import { EntityLink } from "../../../../nav/links";
import { work, type Entity } from "../../../../nav/entities";

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
/** Today's checks on this device, kept per class and day. */
export function useChecks(classId: string, today: string) {
  const key = `amp.school.done.${classId}.${today}`;
  const [state, setState] = useState(() => ({ key, done: readChecks(key) }));
  // Read as the day arrives, so the first paint with it is already right.
  const done = state.key === key ? state.done : readChecks(key);
  if (state.key !== key) setState({ key, done });
  useEffect(() => {
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

/** A to-do's one action: a lesson to teach, a skill, a student or a tab. */
export function TodoAction({
  todo,
  org,
  classId,
  primary,
}: {
  todo: TodayTodo;
  org: string;
  classId: string;
  primary: boolean;
}) {
  const { action } = todo;
  const look = primary ? "primary" : "secondary";
  // A lesson to teach opens over Today as a layer, as a skill does.
  if (action.kind === "lesson")
    return (
      <EntityLink
        entity={{ kind: "lesson", id: action.templateId }}
        className={buttonClass(look)}
      >
        {action.label}
      </EntityLink>
    );
  const miss = todo.misses?.find((entry) =>
    action.kind === "student" ? entry.personId === action.personId : false,
  );
  // A skill, a student or one of their answers opens over Today: Today
  // stays, and closing comes back to it (nav/entities.ts).
  if (action.kind === "skill" || action.kind === "student")
    return (
      <EntityLink
        entity={
          action.kind === "skill"
            ? { kind: "skill", id: action.skillId }
            : miss
              ? missLayers(miss)
              : { kind: "student", id: action.personId }
        }
        with={miss ? { skill: miss.skillId } : undefined}
        className={buttonClass(look)}
      >
        {action.label}
      </EntityLink>
    );
  const target = {
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

type Miss = NonNullable<TodayTodo["misses"]>[number];
/** A student's latest miss, replayed over Today with their record under
 * it; Previous and Next stay on the skill. */
const missLayers = (miss: Miss): Entity[] => [
  { kind: "student", id: miss.personId },
  work(miss.personId, miss.attempt),
];
/** "Keeps missing": each student's misses, one link each, unless the item's
 * own action already opens them. */
function MissLinks({
  todo,
  org,
  classId,
}: {
  todo: TodayTodo;
  org: string;
  classId: string;
}) {
  const misses = (todo.misses ?? []).filter(
    (miss) =>
      !(
        todo.action.kind === "student" && todo.action.personId === miss.personId
      ),
  );
  if (!misses.length) return null;
  const names = new Map(todo.students.map((s) => [s.id, s.name]));
  return (
    <>
      {misses.map((miss) => {
        const name = names.get(miss.personId)?.split(" ")[0] ?? "Student";
        return (
          <EntityLink
            key={miss.personId}
            entity={missLayers(miss)}
            with={{ skill: miss.skillId }}
          >
            {`${name}’s misses`}
          </EntityLink>
        );
      })}
    </>
  );
}

/** A first-run step is done by doing it, so there's nothing to check off. */
const isFirstStep = (todo: TodayTodo) =>
  todo.id === "add-students" || todo.id === "start-class";

/** The server's to-dos as feed entries: each with its action, a sheet to
 * print where a skill allows it, and anything the screen adds (a family's
 * "Let Sam practice here"). `people` puts the faces of a class's students on
 * each item, to scan. */
export function todoEntries({
  todos,
  place,
  canPrint,
  extra,
  people,
  lead = true,
}: {
  todos: readonly TodayTodo[];
  place: { org: string; class: string };
  canPrint: boolean;
  extra?: (todo: TodayTodo) => ReactNode;
  people: boolean;
  /** The first to-do carries the screen's one primary action. */
  lead?: boolean;
}): FeedEntry[] {
  return todos.map((todo, index) => ({
    id: todo.id,
    title: todo.title,
    detail: todo.detail,
    rule: todo.rule,
    mark: isFirstStep(todo) ? "plain" : "check",
    people: people ? todo.students.map((student) => student.name) : undefined,
    links: todo.misses?.length ? (
      <MissLinks todo={todo} org={place.org} classId={place.class} />
    ) : undefined,
    actions: (
      <>
        <TodoAction
          todo={todo}
          org={place.org}
          classId={place.class}
          primary={lead && index === 0}
        />
        {todo.groupSheet && canPrint && (
          <Link
            to="/school/$org/classes/$class/workbooks"
            params={place}
            search={{
              students: todo.students.map((student) => student.id).join(","),
              skill: todo.groupSheet.skillId,
            }}
            className={buttonClass("secondary")}
          >
            {todo.groupSheet.label}
          </Link>
        )}
        {extra?.(todo)}
      </>
    ),
  }));
}

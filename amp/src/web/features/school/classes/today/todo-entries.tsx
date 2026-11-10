import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type {
  ClassTabId,
  TodayTodo,
} from "../../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../../ui/Button";
import type { FeedEntry } from "./Feed";
import { classUrl, studentUrl } from "../teacher-shared";

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
            to: studentUrl(org, action.personId, classId),
            search: {},
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

/** The server's to-dos as feed entries: each with its action, a sheet to
 * print where a skill allows it, and anything the screen adds (a family's
 * "Let Sam practice here"). `people` puts the faces of a class's students on
 * each item, to scan. */
export function todoEntries({
  todos,
  place,
  canPrint,
  onLesson,
  extra,
  people,
  lead = true,
}: {
  todos: readonly TodayTodo[];
  place: { org: string; class: string };
  canPrint: boolean;
  onLesson: (templateId: string) => void;
  extra?: (todo: TodayTodo) => ReactNode;
  people: boolean;
  /** The first to-do carries the screen's one primary action. */
  lead?: boolean;
}): FeedEntry[] {
  return todos.map((todo, index) => ({
    id: todo.id,
    title: todo.title,
    detail: todo.detail,
    mark: isFirstStep(todo) ? "plain" : "check",
    people: people ? todo.students.map((student) => student.name) : undefined,
    actions: (
      <>
        <TodoAction
          todo={todo}
          org={place.org}
          classId={place.class}
          primary={lead && index === 0}
          onLesson={onLesson}
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

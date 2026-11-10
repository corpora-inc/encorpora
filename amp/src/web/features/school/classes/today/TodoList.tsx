import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type {
  ClassTabId,
  TodayTodo,
} from "../../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../../ui/Button";
import { CheckboxControl } from "../../../../ui/Checkbox";
import { EmptyState } from "../../../../ui/EmptyState";
import { classUrl, studentUrl } from "../teacher-shared";
import styles from "./Today.module.css";

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
function useChecks(classId: string, today: string) {
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

/** One thing that needs the teacher today: a check to mark it done on this
 * device, what and why, and its action at the end of the line. */
function TodoItem({
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
        <h3 className={styles.todoTitle}>{todo.title}</h3>
        <p className={styles.todoDetail}>{todo.detail}</p>
      </div>
      <div className={styles.todoActions}>{children}</div>
    </li>
  );
}

/** Two made-up to-dos, for a class with no work yet: what Today will say. */
function ExampleTodos() {
  const examples = [
    {
      title: "3 students are stuck on fraction addition",
      detail: "A short lesson together should clear it.",
      action: "Teach this lesson",
    },
    {
      title: "Priya and Sam are ready for more",
      detail: "Both are past this course in every strand.",
      action: "See the class map",
    },
  ];
  return (
    <ul className={styles.todos}>
      {examples.map((example, index) => (
        <li key={example.title} className={styles.todo}>
          <span className={styles.todoCheck}>
            <CheckboxControl aria-label={example.title} tabIndex={-1} />
          </span>
          <div className={styles.todoBody}>
            <span className={styles.todoTitle}>{example.title}</span>
            <p className={styles.todoDetail}>{example.detail}</p>
          </div>
          <div className={styles.todoActions}>
            <span className={buttonClass(index ? "secondary" : "primary")}>
              {example.action}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "What needs you": today's to-dos, most useful first, each with one action
 * (and a group sheet to print where a shared gap allows it). Before any work,
 * the one first step, beside what the list will hold. */
export function TodoList({
  todos,
  today,
  place,
  canPrint,
  onLesson,
}: {
  todos: readonly TodayTodo[];
  today: string;
  place: { org: string; class: string };
  canPrint: boolean;
  onLesson: (templateId: string) => void;
}) {
  const [done, setDone] = useChecks(place.class, today);
  if (!todos.length) return null;
  const [first] = todos;
  if (todos.length === 1 && isFirstStep(first!))
    return (
      <EmptyState
        title={first!.title}
        example={<ExampleTodos />}
        action={
          <TodoAction
            todo={first!}
            org={place.org}
            classId={place.class}
            primary
            onLesson={onLesson}
          />
        }
      >
        {first!.detail}
      </EmptyState>
    );
  return (
    <section aria-labelledby="today-todos">
      <h2 id="today-todos" className={styles.sectionTitle}>
        What needs you
      </h2>
      <ul className={styles.todos}>
        {todos.map((todo, index) => (
          <TodoItem
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
              onLesson={onLesson}
            />
            {todo.groupSheet && canPrint && (
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
          </TodoItem>
        ))}
      </ul>
    </section>
  );
}

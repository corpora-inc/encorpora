import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { MathText } from "../../../MathText";
import { AvatarStack } from "../../../ui/Avatar";
import { Button, buttonClass } from "../../../ui/Button";
import { CheckboxControl } from "../../../ui/Checkbox";
import { Sheet } from "../../../ui/Sheet";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { Toast } from "../../../ui/Toast";
import { ClassMap, MapKey } from "./ClassMap";
import {
  fullNames,
  lesson,
  students,
  teacher,
  today,
  todos,
  week,
  type Todo,
} from "./fixture";
import { PreviewFrame } from "./PreviewFrame";
import { usePreviewSearch } from "./search";
import { usePreview } from "./store";
import styles from "./Preview.module.css";

function TodoItem({ todo, children }: { todo: Todo; children: ReactNode }) {
  const done = usePreview((state) => !!state.done[todo.id]);
  const setDone = usePreview((state) => state.setDone);
  const names = fullNames(todo.students);
  return (
    <li className={styles.todo} data-done={done || undefined}>
      <span className={styles.todoCheck}>
        <CheckboxControl
          aria-label={`Done: ${todo.title}`}
          checked={done}
          onChange={(event) => setDone(todo.id, event.target.checked)}
        />
      </span>
      <div className={styles.todoBody}>
        <h2 className={styles.todoTitle}>{todo.title}</h2>
        <p className={styles.todoDetail}>{todo.detail}</p>
        <div className={styles.todoPeople}>
          <AvatarStack names={names} label={names.join(", ")} />
        </div>
      </div>
      <div className={styles.todoActions}>{children}</div>
    </li>
  );
}

function Strip({
  parts,
  shaded,
  label,
}: {
  parts: number;
  shaded: number;
  label: string;
}) {
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>
        <MathText text={label} />
      </span>
      <span className={styles.stripBar} aria-hidden="true">
        {Array.from({ length: parts }, (_, index) => (
          <span key={index} data-on={index < shaded || undefined} />
        ))}
      </span>
    </div>
  );
}

function LessonSheet({
  open,
  onOpenChange,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
}) {
  const group = todos[0]!;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={lesson.title}
      description={`A ${lesson.minutes}-minute lesson for 6 students`}
    >
      <div className={styles.lesson}>
        <AvatarStack
          names={fullNames(group.students)}
          label={fullNames(group.students).join(", ")}
        />
        <figure
          className={styles.strips}
          data-strand="fractions"
          aria-label="Two equal strips: 2 of 3 parts shaded, and 8 of 12 parts shaded, the same amount."
          role="img"
        >
          <Strip parts={3} shaded={2} label="2/3" />
          <Strip parts={12} shaded={8} label="8/12" />
        </figure>
        <ol className={styles.steps}>
          {lesson.steps.map((step) => (
            <li key={step}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
        <p className={styles.slip}>
          <MathText text={lesson.slip} />
        </p>
        <Button variant="primary" onClick={onPrint}>
          Print a group sheet
        </Button>
      </div>
    </Sheet>
  );
}

/** Today for one class: who needs the teacher and what to do about it, then
 * the week in a line, then the whole class on one map. */
export function TodayScreen() {
  const [search, set] = usePreviewSearch();
  const [message, setMessage] = useState("");
  const printed = () =>
    setMessage("Group sheet ready to print: 6 students, 12 problems.");
  return (
    <PreviewFrame tab="today">
      <div className={styles.page}>
        <div className={styles.greeting}>
          <h1>Good morning, {teacher.greeting}.</h1>
          <p>{today}</p>
        </div>
        <ul className={styles.todos} aria-label="What needs you today">
          <TodoItem todo={todos[0]!}>
            <Button
              variant="primary"
              onClick={() => set({ lesson: lesson.id })}
            >
              Teach this lesson
            </Button>
            <Button variant="secondary" onClick={printed}>
              Print a group sheet
            </Button>
          </TodoItem>
          <TodoItem todo={todos[1]!}>
            <Link
              to="/$"
              params={{ _splat: "school/preview/gradebook" }}
              search={{ student: "marcus-bell" }}
              className={buttonClass("secondary")}
            >
              See Marcus’s work
            </Link>
          </TodoItem>
          <TodoItem todo={todos[2]!}>
            <Button
              variant="secondary"
              onClick={() =>
                setMessage("Priya and Sam will get harder problems next.")
              }
            >
              Move them ahead
            </Button>
          </TodoItem>
        </ul>
        <section className={styles.week} aria-labelledby="school-week">
          <h2 id="school-week" className={styles.weekTitle}>
            This week
          </h2>
          <StatRow>
            <StatTile
              value={week.minutes.toLocaleString("en-US")}
              label="active minutes"
            />
            <StatTile
              value={week.problems.toLocaleString("en-US")}
              label="problems"
            />
            <StatTile
              value={`${week.working} of ${students.length}`}
              label="students working"
            />
          </StatRow>
        </section>
        <section aria-labelledby="school-map">
          <div className={styles.mapHead}>
            <h2 id="school-map">Class map</h2>
            <MapKey />
          </div>
          <ClassMap />
        </section>
      </div>
      <LessonSheet
        open={!!search.lesson}
        onOpenChange={(open) => {
          if (!open) set({ lesson: undefined });
        }}
        onPrint={printed}
      />
      <Toast tone="status" message={message} onDismiss={() => setMessage("")} />
    </PreviewFrame>
  );
}

/** The class map alone, full width. */
export function MapScreen() {
  return (
    <PreviewFrame tab="map">
      <div className={styles.page}>
        <div className={styles.mapHead}>
          <h1>Class map</h1>
          <MapKey />
        </div>
        <ClassMap />
      </div>
    </PreviewFrame>
  );
}

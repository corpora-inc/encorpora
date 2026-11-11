import type { ReactNode } from "react";
import { AvatarStack } from "../../../../ui/Avatar";
import { CheckboxControl } from "../../../../ui/Checkbox";
import { RuleNote } from "../../RuleNote";
import styles from "./Today.module.css";

/** One thing to do today and why: a title in plain words, the reason under
 * it, and its one or two actions at the end of the line. */
export type FeedEntry = {
  /** Stable for the day, so checking it off survives a reload. */
  id: string;
  title: string;
  detail: string;
  /** How the item is decided, in one sentence, closed until asked for. */
  rule?: string;
  /** `check`: marked done on this device for today. `plain`: done by doing
   * it. `dismiss`: an offer the reader can put away for good. */
  mark: "check" | "plain" | "dismiss";
  actions: ReactNode;
  /** Other people the item is about, to scan by face (a teacher's class). */
  people?: readonly string[];
};

const PEOPLE_SHOWN = 8;

function FeedItem({
  entry,
  done,
  onDone,
  onDismiss,
}: {
  entry: FeedEntry;
  done: boolean;
  onDone: (on: boolean) => void;
  onDismiss?: () => void;
}) {
  const people = entry.people ?? [];
  const hidden = people.length - PEOPLE_SHOWN;
  return (
    <li
      className={styles.todo}
      data-done={done || undefined}
      data-feed={entry.id}
    >
      {/* One treatment for every item: a box to tick off. An offer that can
          be put away for good is put away by ticking it. */}
      <span className={styles.todoCheck}>
        <CheckboxControl
          aria-label={`Done: ${entry.title}`}
          checked={done}
          onChange={(event) => {
            onDone(event.target.checked);
            if (entry.mark === "dismiss" && event.target.checked) onDismiss?.();
          }}
        />
      </span>
      <div className={styles.todoBody}>
        <h3 className={styles.todoTitle}>{entry.title}</h3>
        <p className={styles.todoDetail}>{entry.detail}</p>
        {entry.rule && <RuleNote>{entry.rule}</RuleNote>}
        {people.length > 0 && (
          <div className={styles.todoPeople}>
            <AvatarStack
              names={people.slice(0, PEOPLE_SHOWN)}
              label={people.join(", ")}
            />
            {hidden > 0 && <span className={styles.morePeople}>+{hidden}</span>}
          </div>
        )}
      </div>
      <div className={styles.todoActions}>{entry.actions}</div>
    </li>
  );
}

/** Today's feed (the /schools product shot): one list of things to do, each
 * with its reason, for a class or a family alike. */
export function Feed({
  entries,
  done,
  onDone,
  onDismiss,
  label = "Today",
}: {
  entries: readonly FeedEntry[];
  done: ReadonlySet<string>;
  onDone: (id: string, on: boolean) => void;
  onDismiss?: (id: string) => void;
  label?: string;
}) {
  if (!entries.length) return null;
  return (
    <ul className={styles.todos} aria-label={label}>
      {entries.map((entry) => (
        <FeedItem
          key={entry.id}
          entry={entry}
          done={done.has(entry.id)}
          onDone={(on) => onDone(entry.id, on)}
          onDismiss={() => onDismiss?.(entry.id)}
        />
      ))}
    </ul>
  );
}

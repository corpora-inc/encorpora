import { useMemo, useState } from "react";
import { Button } from "../../ui/Button";
import { SearchField } from "../../ui/SearchField";
import { Sheet } from "../../ui/Sheet";
import type { adoptionLabels } from "./adoption-labels";
import styles from "./AdoptionScreen.module.css";

type RecordLabel = ReturnType<typeof adoptionLabels>[number];
type Kind = "people" | "classes";
type Group = {
  source: RecordLabel[];
  candidates: RecordLabel[];
  values: Record<string, string>;
};
const candidateLimit = 50;
const searchable = (record: RecordLabel) =>
  [
    record.label,
    record.identifier,
    record.grade,
    record.courseName,
    record.period,
    record.sectionNumber,
    ...(record.classNames ?? []),
    ...(record.teacherNames ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase();

/** One search sheet serves the whole roster. Closed rows hold only their
 * chosen label; no row constructs a copy of all the provider candidates. */
export function AdoptionMatching({
  people,
  classes,
  disabled,
  onChange,
}: {
  people: Group;
  classes: Group;
  disabled: boolean;
  onChange: (kind: Kind, sourceId: string, targetId: string) => void;
}) {
  const [active, setActive] = useState<{ kind: Kind; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const indexes = useMemo(
    () => ({
      people: new Map(people.candidates.map((record) => [record.id, record])),
      classes: new Map(classes.candidates.map((record) => [record.id, record])),
    }),
    [people.candidates, classes.candidates],
  );
  const group = active?.kind === "people" ? people : classes;
  const source = active
    ? group.source.find((record) => record.id === active.id)
    : undefined;
  const used = useMemo(
    () =>
      new Set(
        Object.entries(group.values)
          .filter(([id]) => id !== source?.id)
          .map(([, value]) => value),
      ),
    [group.values, source?.id],
  );
  const candidates = useMemo(
    () =>
      source
        ? group.candidates
            .filter((record) => record.student === source.student)
            .map((record) => ({ record, text: searchable(record) }))
        : [],
    [group.candidates, source],
  );
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const results = candidates.filter(({ text }) =>
    words.every((word) => text.includes(word)),
  );
  const choose = (value: string) => {
    if (!active) return;
    onChange(active.kind, active.id, value);
    setActive(null);
  };
  return (
    <>
      {(["people", "classes"] as const).map((kind) => {
        const records = kind === "people" ? people : classes;
        return (
          <section className={styles.section} key={kind}>
            <h3>{kind === "people" ? "People" : "Classes"}</h3>
            <ul className={styles.matchRows}>
              {records.source.map((record) => (
                <li className={styles.match} key={record.id}>
                  <span>{record.label}</span>
                  {record.ambiguous && (
                    <small>
                      Add distinguishing details to the roster before matching.
                    </small>
                  )}
                  <Button
                    variant="secondary"
                    className={styles.matchButton}
                    aria-label={`Clever match for ${record.label}`}
                    aria-haspopup="dialog"
                    disabled={disabled || record.ambiguous}
                    data-match-source={record.id}
                    data-value={records.values[record.id] ?? ""}
                    onClick={() => {
                      setSearch("");
                      setActive({ kind, id: record.id });
                    }}
                  >
                    {indexes[kind].get(records.values[record.id])?.label ??
                      (kind === "people"
                        ? "Choose the same person"
                        : "Choose the same class")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Sheet
        open={!!source}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        title={
          active?.kind === "people"
            ? "Choose the same person"
            : "Choose the same class"
        }
        description={source?.label}
      >
        {source && (
          <div className={styles.section}>
            <SearchField
              label="Search Clever records"
              placeholder={
                active?.kind === "people"
                  ? "Name, school ID or class"
                  : "Name, teacher or class details"
              }
              value={search}
              onChange={setSearch}
            />
            <p className={styles.matchCount} role="status">
              {results.length > candidateLimit
                ? `Showing ${candidateLimit} of ${results.length.toLocaleString()}. Search to narrow the list.`
                : results.length
                  ? `${results.length.toLocaleString()} ${results.length === 1 ? "record" : "records"}`
                  : "No matching Clever records. Try another name or school ID."}
            </p>
            <ul className={styles.candidates} aria-label="Clever records">
              {results.slice(0, candidateLimit).map(({ record }) => (
                <li key={record.id}>
                  <Button
                    variant="secondary"
                    className={styles.matchButton}
                    data-adoption-candidate={record.id}
                    aria-pressed={group.values[source.id] === record.id}
                    disabled={
                      disabled || record.ambiguous || used.has(record.id)
                    }
                    onClick={() => choose(record.id)}
                  >
                    {record.label}
                    {record.ambiguous
                      ? " · Needs distinguishing details"
                      : used.has(record.id)
                        ? " · Already matched"
                        : ""}
                  </Button>
                </li>
              ))}
            </ul>
            {group.values[source.id] && (
              <Button variant="quiet" onClick={() => choose("")}>
                Clear match
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { isIsoDate } from "../../../../schools/calendar";
import {
  activityKinds,
  type ActivityKind,
} from "../../../../schools/org-contracts";
import { Button } from "../../../ui/Button";
import { DatePicker } from "../../../ui/DatePicker";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { SearchField } from "../../../ui/SearchField";
import { Select } from "../../../ui/Select";
import { currentSession } from "../api";
import { fullDay, uuidOr } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { PageHead } from "../parts";
import {
  activityKey,
  fetchActivity,
  searchActivityPeople,
  type ActivityFilters,
} from "./org-api";
import styles from "./Org.module.css";

const KIND_LABELS: Record<ActivityKind, string> = {
  grades: "Grades",
  students: "Students",
  classes: "Classes and settings",
  staff: "Staff",
  "sign-in": "Sign-in",
  calendar: "Calendar and year",
  license: "License and integrations",
  privacy: "Privacy",
};

/** Picks a person by name, and puts only their ID in the URL. The name goes in a
 * request body, never a query string a log would keep. */
function PersonFilter({
  orgId,
  person,
  onChange,
}: {
  orgId: string;
  person: { id: string; name: string } | null;
  onChange: (id: string | undefined) => void;
}) {
  const session = currentSession();
  const [typed, setTyped] = useState("");
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const ask = useRef(0);
  useEffect(() => {
    const needle = typed.trim();
    if (!needle) {
      setPeople([]);
      return;
    }
    const mine = ++ask.current;
    const timer = setTimeout(() => {
      searchActivityPeople(session, orgId, needle)
        .then((found) => {
          if (mine === ask.current) setPeople(found);
        })
        .catch((failure) => console.error("People search failed", failure));
    }, 180);
    return () => clearTimeout(timer);
  }, [typed, orgId, session]);
  if (person)
    return (
      <div className={styles.filterField}>
        <span className={styles.groupLabel}>Person</span>
        <button
          type="button"
          className={styles.personChip}
          aria-label={`Stop filtering by ${person.name}`}
          onClick={() => onChange(undefined)}
        >
          <span>{person.name}</span>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>
    );
  return (
    <div className={styles.filterField}>
      <span className={styles.groupLabel}>Person</span>
      <div className={styles.personSearch}>
        <SearchField
          label="Filter by person"
          placeholder="Any name"
          value={typed}
          onChange={setTyped}
        />
        {people.length > 0 && (
          <ul className={styles.personResults}>
            {people.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTyped("");
                    setPeople([]);
                    onChange(entry.id);
                  }}
                >
                  <span>{entry.name}</span>
                  <small>{entry.role}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Everything that changed here, in sentences, newest first. Filters live in the
 * URL; pages come from the database by position, not offset. */
export function ActivityScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const session = currentSession();
  const filters = useMemo<ActivityFilters>(() => {
    const date = (value: unknown) =>
      typeof value === "string" && isIsoDate(value) ? value : undefined;
    return {
      person: uuidOr(raw.person),
      kind: activityKinds.find((kind) => kind === raw.kind),
      from: date(raw.from),
      to: date(raw.to),
    };
  }, [raw.person, raw.kind, raw.from, raw.to]);
  const log = useInfiniteQuery({
    queryKey: activityKey(session, orgId, filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchActivity(session, orgId, filters, pageParam, signal),
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
  });
  const set = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
      replace: true,
      resetScroll: false,
    });
  const events = useMemo(
    () => log.data?.pages.flatMap((page) => page.events) ?? [],
    [log.data],
  );
  const days = useMemo(() => {
    const grouped: { day: string; events: typeof events }[] = [];
    for (const event of events) {
      const last = grouped.at(-1);
      if (last?.day === event.day) last.events.push(event);
      else grouped.push({ day: event.day, events: [event] });
    }
    return grouped;
  }, [events]);
  const person = log.data?.pages[0]?.person ?? null;
  const filtered = !!(
    filters.person ||
    filters.kind ||
    filters.from ||
    filters.to
  );
  return (
    <OrgFrame orgId={orgId} nav="activity" title="Activity">
      <PageHead
        title="Activity"
        action={
          filtered ? (
            <Button
              variant="quiet"
              onClick={() =>
                set({
                  person: undefined,
                  kind: undefined,
                  from: undefined,
                  to: undefined,
                })
              }
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
      <div className={styles.filters}>
        <PersonFilter
          orgId={orgId}
          person={person}
          onChange={(id) => set({ person: id })}
        />
        <div className={styles.filterField}>
          <span className={styles.groupLabel}>Kind</span>
          <Select
            aria-label="Kind of change"
            value={filters.kind ?? ""}
            onValueChange={(value) => set({ kind: value || undefined })}
          >
            <option value="">All changes</option>
            {activityKinds.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.filterField}>
          <DatePicker
            label="From"
            placeholder="Any day"
            value={filters.from ?? ""}
            max={filters.to}
            onChange={(value) => set({ from: value || undefined })}
          />
        </div>
        <div className={styles.filterField}>
          <DatePicker
            label="To"
            placeholder="Any day"
            value={filters.to ?? ""}
            min={filters.from}
            onChange={(value) => set({ to: value || undefined })}
          />
        </div>
      </div>
      {log.isPending ? (
        <Loading>Loading the log</Loading>
      ) : log.isError && !events.length ? (
        <EmptyState
          title="The log didn’t load"
          action={
            <Button variant="secondary" onClick={() => void log.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : events.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches these filters" : "Nothing yet"}
        >
          {filtered
            ? "Try a wider date range, or another kind of change."
            : "Each change anyone makes here appears in this list."}
        </EmptyState>
      ) : (
        <div className={styles.log}>
          {days.map((group) => (
            <section key={group.day} className={styles.logDay}>
              <h2>{fullDay(group.day)}</h2>
              <ol>
                {group.events.map((event) => (
                  <li key={event.id}>
                    <time>{event.time}</time>
                    <span>{event.sentence}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {log.hasNextPage && (
            <Button
              variant="secondary"
              aria-busy={log.isFetchingNextPage}
              disabled={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              Show older
            </Button>
          )}
        </div>
      )}
    </OrgFrame>
  );
}

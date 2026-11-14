import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { TodayTodo } from "../../../schools/teacher-contracts";
import { EntityLink } from "../../nav/links";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { RowButton, RowList } from "../../ui/RowList";
import { Toast } from "../../ui/Toast";
import { rememberContinuation } from "../continue/memory";
import { lastPracticed } from "../school/classes/today/ChildRow";
import { Feed, type FeedEntry } from "../school/classes/today/Feed";
import { useChecks } from "../school/classes/today/todo-entries";
import { useHandOver } from "../school/classes/today/use-hand-over";
import { WeekFacts } from "../school/classes/today/WeekFacts";
import { fullDay } from "../school/classes/teacher-shared";
import type { FamilyChild } from "./api";
import { AddKidsSheet } from "./AddKids";
import { DevicesSheet } from "./Devices";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** One value over what it counts. */
export function Fact({ value, label }: { value: string; label: string }) {
  return (
    <span className={styles.fact}>
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </span>
  );
}

/** The latest active grant's end, when the child has access. */
export function accessUntil(child: FamilyChild): string | null {
  const ends = child.access.grants
    .filter((grant) => grant.status === "active")
    .map((grant) => grant.endsAt)
    .sort();
  const last = ends.at(-1);
  return last ? DATE.format(new Date(last)) : null;
}

/** Access, or the free problems left: what lets this child practice. */
export function AccessFact({ child }: { child: FamilyChild }) {
  if (child.access.hasAccess) {
    const until = accessUntil(child);
    return (
      <Fact value="Active" label={until ? `through ${until}` : "access"} />
    );
  }
  const left = child.access.freeAllowance.problems.remaining;
  return (
    <Fact
      value={String(left)}
      label={left === 1 ? "free problem left" : "free problems left"}
    />
  );
}

/** The figures of a child's week: minutes, problems and when they last
 * practiced, or that they haven't started. */
export function WeekFactsOf({
  child,
  today,
}: {
  child: FamilyChild;
  today: string;
}) {
  const { week } = child;
  if (!week.lastPracticed)
    return <Fact value="Not started" label="no practice yet" />;
  return (
    <>
      <Fact
        value={week.minutes > 0 ? `${week.minutes} min` : "None"}
        label={
          week.minutes > 0 || week.problems > 0
            ? `${count(week.problems, "problem")} this week`
            : "this week"
        }
      />
      <Fact
        value={lastPracticed(week.lastPracticed, today)}
        label="last practiced"
      />
    </>
  );
}

/**
 * The one action that works for a child now: their practice on this device
 * ("Let Maya practice here"), else, for the parent who buys, "Continue with
 * AMP", which returns to the screen it was opened from with access active.
 * Never a button the server would refuse (premium rule 2).
 */
export function ChildAction({
  child,
  family,
  accountId,
  starting,
  onPracticeHere,
  primary = false,
}: {
  child: FamilyChild;
  family: string;
  /** Whose purchase this is: the continuation is kept for them alone. */
  accountId: string;
  starting: string | null;
  onPracticeHere: (learnerId: string) => void;
  primary?: boolean;
}) {
  if (child.capabilities.practiceHere && child.access.canPractice)
    return (
      <Button
        variant={primary ? "primary" : "secondary"}
        aria-busy={starting === child.id || undefined}
        disabled={starting !== null && starting !== child.id}
        onClick={() => onPracticeHere(child.id)}
        data-practice-here={child.id}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
        </svg>
        Let {child.name} practice here
      </Button>
    );
  if (child.capabilities.continuePurchase && child.paths.continue)
    return (
      <Link
        to="/continue/$learnerId"
        params={{ learnerId: child.id }}
        className={buttonClass("primary")}
        data-continue={child.id}
        // Back to the child's page, with access active, after the plan,
        // consent and payment.
        onClick={() =>
          rememberContinuation({
            accountId,
            learnerId: child.id,
            returnTo: `/${familyHref(family, `kids/${child.id}`)}`,
          })
        }
      >
        Continue with AMP
      </Link>
    );
  return (
    <span className={styles.actionNote}>
      {child.access.learningAllowed ? "Needs access" : "Paused"}
    </span>
  );
}

const TAB_LEAF: Record<string, string> = {
  map: "map",
  time: "time",
  settings: "settings",
};

/** The server's to-dos for the family's own children, in a parent's words:
 * a child opens their page, a skill or a lesson opens over Today. */
function familyEntries(
  tasks: readonly TodayTodo[],
  family: string,
  extra: (todo: TodayTodo) => ReactNode,
): FeedEntry[] {
  const action = (todo: TodayTodo, primary: boolean): ReactNode => {
    const look = primary ? "primary" : "secondary";
    const { action } = todo;
    if (action.kind === "lesson" || action.kind === "skill")
      return (
        <EntityLink
          entity={
            action.kind === "lesson"
              ? { kind: "lesson", id: action.templateId }
              : { kind: "skill", id: action.skillId }
          }
          className={buttonClass(look)}
        >
          {action.label}
        </EntityLink>
      );
    if (action.kind === "student")
      return (
        <Link
          to="/$"
          params={{ _splat: familyHref(family, `kids/${action.personId}`) }}
          className={buttonClass(look)}
        >
          {action.label}
        </Link>
      );
    const leaf = TAB_LEAF[action.tab];
    return (
      <Link
        to="/$"
        params={{ _splat: familyHref(family, leaf ?? "") }}
        search={(action.tab === "start" ? { devices: 1 } : {}) as never}
        className={buttonClass(look)}
      >
        {action.label}
      </Link>
    );
  };
  return tasks.map((todo, index) => ({
    id: todo.id,
    title: todo.title,
    detail: todo.detail,
    rule: todo.rule,
    mark: todo.kind === "start" ? "plain" : "check",
    actions: (
      <>
        {action(todo, index === 0)}
        {extra(todo)}
      </>
    ),
  }));
}

/**
 * A family's Today (`/family/<family>`): the date, then each of the family's
 * own children on one line (their page, this week, when they last practiced,
 * access or free problems left, and "Let Maya practice here", the same width
 * on every row), then what needs a parent today and the week in plain words.
 * Only the family's own children: another family's child in a tutoring group
 * is never here (docs/architecture/family-api.md).
 */
export function FamilyTodayScreen() {
  const place = useFamilyPlace();
  const { data, family, session, me } = place;
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const { starting, error, clearError, handOver } = useHandOver(session);
  const [done, setDone] = useChecks(`family.${family}`, data?.today.date ?? "");
  const devices = search.devices === 1 || search.devices === "1";
  const adding = search.add === 1 || search.add === "1";
  const setOpen = (key: "devices" | "add", open: boolean) =>
    void navigate({
      to: ".",
      search: ((current: Record<string, unknown>) => {
        const next = { ...current };
        if (open) next[key] = 1;
        else delete next[key];
        return next;
      }) as never,
      replace: !open,
    });
  const children = data?.children ?? [];
  const byId = new Map(children.map((child) => [child.id, child]));
  const own = place.own;
  const manageDevices = children.some(
    (child) => child.capabilities.manageDevices,
  );
  const practiceSelf = !!me?.adultPractice?.learner;
  const startSelf = !practiceSelf && me?.adultPractice?.eligible === true;
  const entries = data
    ? familyEntries(data.today.tasks, family, (todo) => {
        if (todo.kind === "good-day" || todo.students.length !== 1) return null;
        const child = byId.get(todo.students[0]!.id);
        return child &&
          child.capabilities.practiceHere &&
          child.access.canPractice ? (
          <ChildAction
            child={child}
            family={family}
            accountId={session.accountId}
            starting={starting}
            onPracticeHere={(id) => void handOver(id)}
          />
        ) : null;
      })
    : [];
  return (
    <FamilyFrame place={place}>
      {data && (
        <div className={styles.page}>
          <header className={styles.head}>
            {/* The day, never a greeting or the parent's own name. */}
            <h1 data-today-title="">{fullDay(data.today.date)}</h1>
          </header>
          {children.length === 0 ? (
            place.holder ? (
              <EmptyState
                title="Add your kids"
                action={
                  <Button
                    variant="primary"
                    onClick={() =>
                      me?.consent.status === "active"
                        ? setOpen("add", true)
                        : void navigate({ to: "/start/parent" as never })
                    }
                  >
                    Add your kids
                  </Button>
                }
              >
                Each child gets their own place to start, their own map and
                their own record.
              </EmptyState>
            ) : (
              <EmptyState title="No children here yet">
                The parent who invited you adds the children.
              </EmptyState>
            )
          ) : (
            <section aria-labelledby="family-kids">
              <h2 id="family-kids" className={styles.sectionTitle}>
                {children.length === 1 ? "Your child" : "Your kids"}
              </h2>
              <ul className={styles.kids} data-family-kids="">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className={styles.kid}
                    data-child={child.id}
                  >
                    <Link
                      to="/$"
                      params={{
                        _splat: familyHref(family, `kids/${child.id}`),
                      }}
                      className={styles.kidName}
                      data-child-link={child.id}
                    >
                      {child.name}
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
                      </svg>
                    </Link>
                    <span className={styles.facts}>
                      <WeekFactsOf child={child} today={data.today.date} />
                      <AccessFact child={child} />
                    </span>
                    <span className={styles.action}>
                      <ChildAction
                        child={child}
                        family={family}
                        accountId={session.accountId}
                        starting={starting}
                        onPracticeHere={(id) => void handOver(id)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              {(own && manageDevices) || practiceSelf || startSelf ? (
                <div className={styles.quiet}>
                  <RowList label="More ways to practice">
                    {own && manageDevices && (
                      <RowButton
                        title="Their own devices"
                        meta="A code, a QR code or a printed card"
                        data-own-devices=""
                        onClick={() => setOpen("devices", true)}
                      />
                    )}
                    {(practiceSelf || startSelf) && (
                      <RowButton
                        title={
                          practiceSelf
                            ? "Practice yourself"
                            : "Start your own practice"
                        }
                        meta={
                          practiceSelf
                            ? "Your own levels, in My practice"
                            : "Free for you, with your children’s plan"
                        }
                        data-practice-self=""
                        onClick={() =>
                          void navigate({
                            to: (practiceSelf ? "/me" : "/me/start") as never,
                          })
                        }
                      />
                    )}
                  </RowList>
                </div>
              ) : null}
            </section>
          )}
          {entries.length > 0 && (
            <section aria-labelledby="family-feed">
              <h2 id="family-feed" className={styles.sectionTitle}>
                For today
              </h2>
              <Feed entries={entries} done={done} onDone={setDone} />
            </section>
          )}
          {children.length > 0 && (
            <WeekFacts
              week={data.today.week}
              words={{ learner: "child", learners: "kids" }}
              earned={["new skill earned", "new skills earned"]}
            />
          )}
          {own && manageDevices && (
            <DevicesSheet
              place={place}
              classId={own.id}
              open={devices}
              onOpenChange={(open) => setOpen("devices", open)}
            />
          )}
          {place.holder && (
            <AddKidsSheet
              session={session}
              open={adding}
              onOpenChange={(open) => setOpen("add", open)}
            />
          )}
        </div>
      )}
      <Toast message={error} onDismiss={clearError} />
    </FamilyFrame>
  );
}

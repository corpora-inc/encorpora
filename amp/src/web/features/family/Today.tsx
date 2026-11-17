import { useQuery } from "@tanstack/react-query";
import { fundingRecordsOptions } from "../funding/records";
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
import { useLearnerStore } from "../../learner-store";
import { useStartOwnPractice } from "../me/api";
import { rememberPlace } from "../onboarding/place-memory";
import { AddKidsSheet } from "./AddKids";
import { accessUntil, sharedAccessOf } from "./access";
import { DevicesSheet } from "./Devices";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";
import { ColumnList, ColumnRow, type Column } from "../../ui/ColumnList";
import styles from "./Family.module.css";
import { PayLink } from "../pay/link";

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** One value over what it counts. */
export function Fact({
  value,
  label,
  wide = false,
}: {
  value: string;
  label: string;
  /** Takes the two cells the week's figures will, so the row holds. */
  wide?: boolean;
}) {
  return (
    <span className={`${styles.fact} ${wide ? styles.factWide : ""}`}>
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </span>
  );
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

/** Billing stays in the parent's family frame; the child's practice stays primary. */
function ChildBillingLink({
  child,
  pending,
}: {
  child: FamilyChild;
  pending: boolean;
}) {
  const label = !child.access.hasAccess
    ? "Get access"
    : pending
      ? "View invoice"
      : "Manage access";
  return (
    <Link
      to="/account/billing"
      hash={pending ? "funded-invoices-title" : undefined}
      className={styles.accessLink}
      aria-label={`${label} for ${child.name}`}
      data-child-billing={child.id}
      onClick={() => useLearnerStore.getState().select(child.id)}
    >
      {label}
    </Link>
  );
}

/** The figures of a child's week: minutes, problems and when they last
 * practiced, or that they haven't started. */
export function WeekFactsOf({
  child,
  today,
  steady = false,
}: {
  child: FamilyChild;
  today: string;
  /** Before any practice, hold the two cells its figures will take, so the
   * first answer moves nothing (a child's page; CP-5 r2 #2). */
  steady?: boolean;
}) {
  if (!child.week.lastPracticed)
    return <Fact value="Not started" label="no practice yet" wide={steady} />;
  return (
    <>
      <WeekFact child={child} />
      <LastPracticedFact child={child} today={today} />
    </>
  );
}

/** A child's week on Today: minutes and problems, or that they haven't
 * started. */
export function WeekFact({ child }: { child: FamilyChild }) {
  const { week } = child;
  if (!week.lastPracticed)
    return <Fact value="Not started" label="no practice yet" />;
  return (
    <Fact
      value={week.minutes > 0 ? `${week.minutes} min` : "None"}
      label={
        week.minutes > 0 || week.problems > 0
          ? `${count(week.problems, "problem")} this week`
          : "this week"
      }
    />
  );
}
/** When a child last practiced; nothing before their first answer. */
export function LastPracticedFact({
  child,
  today,
}: {
  child: FamilyChild;
  today: string;
}) {
  const last = child.week.lastPracticed;
  return last ? (
    <Fact value={lastPracticed(last, today)} label="last practiced" />
  ) : null;
}
/** Today's children: name, this week, last practiced, access (when the
 * family shows it per child), action. */
const kidColumns = (access: boolean): Column[] => [
  { key: "name", track: "minmax(120px, 1.2fr)", part: "title" },
  { key: "week", track: "minmax(0, 1fr)" },
  { key: "last", track: "minmax(0, 1fr)" },
  ...(access ? [{ key: "access", track: "minmax(0, 1fr)" }] : []),
  { key: "action", track: "auto", part: "action" as const },
];

/**
 * The one action that works for a child now: their practice on this device
 * ("Practice"), else, for the parent who buys, "Continue with
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
        aria-label={`Practice with ${child.name}`}
        data-practice-here={child.id}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
        </svg>
        Practice
      </Button>
    );
  if (child.capabilities.continuePurchase && child.paths.continue)
    return (
      <PayLink
        learnerId={child.id}
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
      </PayLink>
    );
  return (
    <span className={styles.actionNote}>
      {child.access.learningAllowed ? "Needs access" : "Paused"}
    </span>
  );
}

/** Where a to-do's tab opens, straight there: Progress and practice time
 * are a one-child family's child page (practice time at its part). */
function tabTarget(
  tab: string,
  only: string | null,
): { leaf: string; hash?: string } {
  if (tab === "map" || tab === "time")
    return only
      ? {
          leaf: `kids/${only}`,
          ...(tab === "time" ? { hash: "child-time" } : {}),
        }
      : { leaf: "map" };
  return { leaf: tab === "settings" ? "settings" : "" };
}

/** The server's to-dos for the family's own children, in a parent's words:
 * a child opens their page, a skill or a lesson opens over Today. */
function familyEntries(
  tasks: readonly TodayTodo[],
  family: string,
  only: string | null,
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
    const { leaf, hash } = tabTarget(action.tab, only);
    return (
      <Link
        to="/$"
        params={{ _splat: familyHref(family, leaf) }}
        hash={hash}
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
  const billing = useQuery({
    ...fundingRecordsOptions(session),
    enabled:
      !!data?.capabilities.manageBilling &&
      data.children.some((child) => child.access.hasAccess),
  });
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
  const sharedAccess = sharedAccessOf(children);
  const byId = new Map(children.map((child) => [child.id, child]));
  const own = place.own;
  const manageDevices = children.some(
    (child) => child.capabilities.manageDevices,
  );
  const startOwn = useStartOwnPractice(session);
  const [ownError, setOwnError] = useState("");
  const practiceSelf = !!me?.adultPractice?.learner;
  const startSelf = !practiceSelf && me?.adultPractice?.eligible === true;
  const entries = data
    ? familyEntries(
        data.today.tasks,
        family,
        data.children.length === 1 ? data.children[0]!.id : null,
        (todo) => {
          if (todo.kind === "good-day" || todo.students.length !== 1)
            return null;
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
        },
      )
    : [];
  return (
    <FamilyFrame
      place={place}
      title={
        data && <span data-today-title="">{fullDay(data.today.date)}</span>
      }
    >
      {data && (
        <div className={styles.page}>
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
              />
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
              {sharedAccess && (
                <p className={styles.shared} data-shared-access="">
                  {children.length === 2 ? "Both have" : "All have"} AMP through{" "}
                  {sharedAccess}
                </p>
              )}
              <ColumnList
                label={children.length === 1 ? "Your child" : "Your kids"}
                columns={kidColumns(
                  !sharedAccess || !!data.capabilities.manageBilling,
                )}
                data-family-kids=""
              >
                {children.map((child) => (
                  <ColumnRow
                    key={child.id}
                    data-child={child.id}
                    cells={{
                      name: (
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
                      ),
                      week: <WeekFact child={child} />,
                      last: (
                        <LastPracticedFact
                          child={child}
                          today={data.today.date}
                        />
                      ),
                      access: (
                        <>
                          {!sharedAccess && <AccessFact child={child} />}
                          {data.capabilities.manageBilling && (
                            <ChildBillingLink
                              child={child}
                              pending={
                                billing.data?.requests.some(
                                  (invoice) =>
                                    invoice.learnerId === child.id &&
                                    invoice.fundedPending?.status ===
                                      "funded-pending",
                                ) ?? false
                              }
                            />
                          )}
                        </>
                      ),
                      action: (
                        <span className={styles.action}>
                          <ChildAction
                            child={child}
                            family={family}
                            accountId={session.accountId}
                            starting={starting}
                            onPracticeHere={(id) => void handOver(id)}
                            primary
                          />
                        </span>
                      ),
                    }}
                  />
                ))}
                {(practiceSelf || startSelf) && (
                  <ColumnRow
                    data-family-self=""
                    cells={{
                      name: <span className={styles.kidName}>You</span>,
                      action: (
                        <span className={styles.action}>
                          <Button
                            variant="secondary"
                            aria-label="Practice as yourself"
                            aria-busy={startOwn.isPending || undefined}
                            onClick={() => {
                              if (startOwn.isPending) return;
                              setOwnError("");
                              void (
                                practiceSelf
                                  ? Promise.resolve()
                                  : startOwn.mutateAsync(undefined)
                              )
                                .then(() => {
                                  rememberPlace(session.accountId, "home");
                                  return navigate({
                                    to: "/$",
                                    params: { _splat: "practice" },
                                    search: { from: `/${familyHref(family)}` },
                                  });
                                })
                                .catch(() =>
                                  setOwnError(
                                    "Practice didn’t start. Try again.",
                                  ),
                                );
                            }}
                          >
                            Practice
                          </Button>
                        </span>
                      ),
                    }}
                  />
                )}
              </ColumnList>
              {own && manageDevices ? (
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
      <Toast
        message={error || ownError}
        onDismiss={() => {
          clearError();
          setOwnError("");
        }}
      />
    </FamilyFrame>
  );
}

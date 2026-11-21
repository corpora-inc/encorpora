import { useQuery } from "@tanstack/react-query";
import { practiceMinutes } from "../../lib/practice-minutes";
import { fundingRecordsOptions } from "../funding/records";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { TodayTodo } from "../../../schools/teacher-contracts";
import { EntityLink } from "../../nav/links";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Toast } from "../../ui/Toast";
import { rememberContinuation } from "../continue/memory";
import { lastPracticed } from "../learners/week-words";
import { LearnerRow } from "../learners/LearnerRow";
import { SkillKey } from "../learners/SkillKey";
import { Feed, type FeedEntry } from "../school/classes/today/Feed";
import { useChecks } from "../school/classes/today/todo-entries";
import { useHandOver } from "../school/classes/today/use-hand-over";
import { fullDay } from "../school/classes/teacher-shared";
import { standing } from "../../lib/AppError";
import { classYearOptions } from "../school/core-api";
import { familyDashboardOptions, type FamilyChild } from "./api";
import { FamilyLive } from "./FamilyLive";
import { PastSessions } from "./PastSessions";
import { peopleOf } from "./redirects";
import { selectLearner } from "../../learner-store";
import { useStartOwnPractice } from "../me/api";
import { rememberPlace } from "../onboarding/place-memory";
import { AddChildrenSheet } from "./AddChildren";
import { accessUntil, sharedAccessOf } from "./access";
import { DevicesSheet } from "./Devices";
import {
  actionWidth,
  ChildDashboard,
  ChildWeekFacts,
  FamilyHero,
  FamilyWeekSummary,
  GetIn,
  NotAskedSheet,
} from "./Dashboard";
import dash from "./Dashboard.module.css";
import { FamilyReportCards } from "./Records";
import { useSheet } from "../../nav/sheet";
import { ActionRow } from "../../ui/ActionRow";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";
import { PayLink } from "../pay/link";
import { practiceParams } from "../spaces/identity";

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** One value over what it counts. */
export function Fact({
  value,
  label,
  wide = false,
  inline = false,
}: {
  value: string;
  label: string;
  /** Takes the two cells the week's figures will, so the row holds. */
  wide?: boolean;
  /** On one line, the value then its label (a line under a child's row). */
  inline?: boolean;
}) {
  return (
    <span
      className={`${styles.fact} ${wide ? styles.factWide : ""} ${inline ? styles.factInline : ""}`}
    >
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </span>
  );
}

/** Access, or the free problems left: what lets this child practice. */
export function AccessFact({
  child,
  inline = false,
}: {
  child: FamilyChild;
  inline?: boolean;
}) {
  if (child.access.hasAccess) {
    const until = accessUntil(child);
    return (
      <Fact
        value="Active"
        label={until ? `through ${until}` : "access"}
        inline={inline}
      />
    );
  }
  const left = child.access.freeAllowance.problems.remaining;
  return (
    <Fact
      inline={inline}
      value={String(left)}
      label={left === 1 ? "free problem left" : "free problems left"}
    />
  );
}

/** A child's access, for the parent who buys: without it, Pay over Today;
 * with it (or an invoice waiting), Billing over the family's Settings, the
 * one place billing is. The child's practice stays primary. */
function ChildBillingLink({
  child,
  family,
  pending,
}: {
  child: FamilyChild;
  family: string;
  pending: boolean;
}) {
  const label = !child.access.hasAccess
    ? "Get access"
    : pending
      ? "View invoice"
      : "Manage access";
  const select = () => selectLearner(child.id);
  if (!child.access.hasAccess)
    return (
      <PayLink
        learnerId={child.id}
        className={styles.accessLink}
        aria-label={`${label} for ${child.name}`}
        data-child-billing={child.id}
        onClick={select}
      >
        {label}
      </PayLink>
    );
  return (
    <Link
      to="/$"
      params={{ _splat: familyHref(family, "settings/billing") }}
      className={styles.accessLink}
      aria-label={`${label} for ${child.name}`}
      data-child-billing={child.id}
      onClick={select}
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
  const minutes = practiceMinutes(week.minutes, week.problems);
  // Practiced before, not yet this week: one quiet line, never "None".
  if (!minutes)
    return (
      <span className={styles.fact} data-week-quiet="">
        <span className={styles.factLabel}>No practice yet this week</span>
      </span>
    );
  return (
    <Fact
      value={minutes}
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

/** Where a to-do's tab opens, straight there: a one-child family's child
 * page (practice time at its part); with several, the children are here. */
function tabTarget(
  tab: string,
  only: string | null,
): { leaf: string; hash?: string } {
  if ((tab === "map" || tab === "time") && only)
    return {
      leaf: `kids/${only}`,
      ...(tab === "time" ? { hash: "child-time" } : {}),
    };
  return { leaf: tab === "settings" ? "settings" : "" };
}

/** The server's to-dos for the family's own children, in a parent's words:
 * a child opens their page, a skill or a lesson opens over Today. */
function familyEntries(
  tasks: readonly TodayTodo[],
  family: string,
  only: string | null,
  extra: (todo: TodayTodo) => ReactNode,
  /** Opens their own devices over Today (a "start" to-do). */
  openDevices: () => void,
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
    if (action.tab === "start")
      return (
        <Button variant={look} onClick={openDevices}>
          {action.label}
        </Button>
      );
    const { leaf, hash } = tabTarget(action.tab, only);
    return (
      <Link
        to="/$"
        params={{ _splat: familyHref(family, leaf) }}
        hash={hash}
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
 * A family's Today (`/family/<family>`), the parent's dashboard: the date,
 * then each of the family's own children as one block (their row: page,
 * this week, how many right, Practice; what AMP is working on with them and
 * why; their five areas with what was checked below each), the key to the
 * bars once, then what needs a parent today, the family's week and how the
 * children get in. Before any answer, a centred start (ia.md rule 7). Only
 * the family's own children: another family's child in a tutoring group is
 * never here (docs/architecture/family-api.md).
 */
export function FamilyTodayScreen() {
  const place = useFamilyPlace();
  const { data, family, session, me } = place;
  const dashboard = useQuery(familyDashboardOptions(session, family));
  const board =
    dashboard.data?.familyId === family ? dashboard.data : undefined;
  const billing = useQuery({
    ...fundingRecordsOptions(session),
    enabled:
      !!data?.capabilities.manageBilling &&
      data.children.some((child) => child.access.hasAccess),
  });
  const navigate = useNavigate();
  const { starting, error, clearError, handOver } = useHandOver(session);
  const [done, setDone] = useChecks(`family.${family}`, data?.today.date ?? "");
  // Their own devices and adding a child: sheets over Today, in history
  // state (nav/sheet.ts), never an address key.
  const devices = useSheet("devices");
  const adding = useSheet("add-children");
  const children = data?.children ?? [];
  const sharedAccess = sharedAccessOf(children);
  const byId = new Map(children.map((child) => [child.id, child]));
  const boards = new Map(board?.children.map((child) => [child.id, child]));
  const own = place.own;
  // The family's class is where its practice sessions live (the live
  // section, the past sessions): its `can` says what this parent may do.
  const classPlace = own ? { org: own.org, class: own.id } : null;
  const can = new Set(
    standing(
      useQuery({
        ...classYearOptions(session, own?.id ?? ""),
        enabled: !!own,
        refetchOnMount: false,
      }),
    )?.can ?? [],
  );
  const watch = !!classPlace && can.has("session.read");
  const live = watch && classPlace && (
    <FamilyLive
      family={family}
      place={classPlace}
      can={{
        resolve: can.has("signal.resolve"),
        resetPictures: can.has("signin.manage"),
      }}
      people={peopleOf(children, classPlace.class)}
      levelShown={
        new Map(board?.children.map((kid) => [kid.id, kid.gradeLevelShown]))
      }
    />
  );
  const manageDevices = children.some(
    (child) => child.capabilities.manageDevices,
  );
  const startOwn = useStartOwnPractice(session);
  const [ownError, setOwnError] = useState("");
  const practiceSelf = !!me?.adultPractice?.learner;
  const startSelf = !practiceSelf && me?.adultPractice?.eligible === true;
  const today = data?.today.date ?? "";
  // Day 0: no child has answered anything yet.
  const dayZero =
    children.length > 0 &&
    children.every(
      (child) =>
        !child.week.lastPracticed &&
        !(boards.get(child.id)?.level ?? null) &&
        !boards.get(child.id)?.week.lastPracticed,
    );
  const checking = !!board?.children.some((child) =>
    child.areas.some((area) => area.checked),
  );
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
        devices.show,
      )
    : [];
  const action = (child: FamilyChild) => (
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
  );
  const name = (child: FamilyChild) => (
    <Link
      to="/$"
      params={{ _splat: familyHref(family, `kids/${child.id}`) }}
      className={styles.kidName}
      data-child-link={child.id}
    >
      {child.name}
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
      </svg>
    </Link>
  );
  const moreWays =
    own && manageDevices ? (
      <Button
        variant="quiet"
        className={dash.moreWays}
        data-own-devices=""
        onClick={devices.show}
      >
        Cards, a new code and more
      </Button>
    ) : null;
  const getIn = board?.join ? (
    <GetIn join={board.join} more={moreWays} />
  ) : moreWays ? (
    <div>{moreWays}</div>
  ) : null;
  const pendingFor = (child: FamilyChild) =>
    billing.data?.requests.some(
      (invoice) =>
        invoice.learnerId === child.id &&
        invoice.fundedPending?.status === "funded-pending",
    ) ?? false;
  // With one access for all, Billing is one link on that line; a child's
  // own line only says what is theirs alone (an invoice waiting).
  const accessLine = (child: FamilyChild) =>
    !sharedAccess || (data?.capabilities.manageBilling && pendingFor(child)) ? (
      <p className={dash.access}>
        {!sharedAccess && <AccessFact child={child} inline />}
        {data?.capabilities.manageBilling && (
          <ChildBillingLink
            child={child}
            family={family}
            pending={pendingFor(child)}
          />
        )}
      </p>
    ) : null;
  const self = (practiceSelf || startSelf) && (
    <LearnerRow
      as="li"
      data-family-self=""
      name={<span className={styles.kidName}>You</span>}
      action={
        practiceSelf ? (
          <Link
            to="/$"
            params={practiceParams(me!.adultPractice!.learner!.id)}
            className={buttonClass("secondary")}
            aria-label="Practice as yourself"
            onClick={() => rememberPlace(session.accountId, "home")}
          >
            Practice
          </Link>
        ) : (
          <Button
            variant="secondary"
            aria-label="Practice as yourself"
            aria-busy={startOwn.isPending || undefined}
            onClick={() => {
              if (startOwn.isPending) return;
              setOwnError("");
              void startOwn
                .mutateAsync(undefined)
                .then((learner) => {
                  rememberPlace(session.accountId, "home");
                  return navigate({
                    to: "/$",
                    params: practiceParams(learner),
                  });
                })
                .catch((failure: unknown) => {
                  console.error("Own practice didn’t start", failure);
                  setOwnError("Practice didn’t start. Try again.");
                });
            }}
          >
            Practice
          </Button>
        )
      }
    />
  );
  const sheets = (
    <>
      {own && manageDevices && (
        <DevicesSheet
          place={place}
          classId={own.id}
          open={devices.open}
          onOpenChange={devices.onOpenChange}
        />
      )}
      {place.holder && (
        <AddChildrenSheet
          open={adding.open}
          onOpenChange={adding.onOpenChange}
        />
      )}
      <NotAskedSheet
        dashboard={board}
        children={children}
        starting={starting}
        onPractice={(learner, filter) => void handOver(learner, filter)}
      />
    </>
  );
  return (
    <FamilyFrame
      place={place}
      width="wide"
      // The dashboard arrives with the route (its loader); a cold visit
      // waits for it whole rather than drawing the children twice.
      loading={children.length > 0 && dashboard.isPending}
      title={data && <span data-today-title="">{fullDay(today)}</span>}
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
                    data-add-child=""
                    onClick={adding.show}
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
          ) : dayZero ? (
            <FamilyHero
              single={children.length === 1 ? children[0]!.name : null}
              getIn={getIn}
            >
              <ul
                className={dash.heroKids}
                aria-label={children.length === 1 ? "Your child" : "Your kids"}
                style={actionWidth(children)}
                data-family-kids=""
              >
                {children.map((child) => (
                  <LearnerRow
                    key={child.id}
                    as="li"
                    data-child={child.id}
                    name={name(child)}
                    action={action(child)}
                  />
                ))}
                {self}
              </ul>
              {live}
            </FamilyHero>
          ) : (
            <div
              className={dash.layout}
              data-side={entries.length > 0 || !!board || !!getIn || undefined}
            >
              <section aria-labelledby="family-kids" className={dash.kids}>
                {live}
                <div className={dash.kidsHead}>
                  <h2 id="family-kids" className={dash.kidsTitle}>
                    {children.length === 1 ? "Your child" : "Your kids"}
                  </h2>
                  {checking && <SkillKey level="Likely level" />}
                </div>
                {sharedAccess && (
                  <p className={styles.shared} data-shared-access="">
                    {children.length === 2 ? "Both have" : "All have"} AMP
                    through {sharedAccess}
                    {data.capabilities.manageBilling && (
                      <>
                        {" · "}
                        <Link
                          to="/$"
                          params={{
                            _splat: familyHref(family, "settings/billing"),
                          }}
                          className={styles.accessLink}
                          data-shared-billing=""
                        >
                          Manage access
                        </Link>
                      </>
                    )}
                  </p>
                )}
                {dashboard.isError && (
                  <p role="alert" className={dash.failed}>
                    The week and levels didn’t load.{" "}
                    <Button
                      variant="quiet"
                      onClick={() => void dashboard.refetch()}
                    >
                      Try again
                    </Button>
                  </p>
                )}
                <ul
                  className={dash.list}
                  aria-label={
                    children.length === 1 ? "Your child" : "Your kids"
                  }
                  style={actionWidth(children)}
                  data-family-kids=""
                >
                  {children.map((child) => {
                    const childBoard = boards.get(child.id);
                    return (
                      <li
                        key={child.id}
                        className={dash.block}
                        data-child={child.id}
                      >
                        <LearnerRow
                          name={name(child)}
                          facts={
                            <ChildWeekFacts
                              child={child}
                              board={childBoard}
                              today={today}
                              from={board?.week.from}
                            />
                          }
                          action={action(child)}
                        />
                        {accessLine(child)}
                        {childBoard && (
                          <ChildDashboard child={child} board={childBoard} />
                        )}
                      </li>
                    );
                  })}
                  {self}
                </ul>
              </section>
              <div className={dash.side}>
                {entries.length > 0 && (
                  <section aria-labelledby="family-feed">
                    <h2 id="family-feed" className={styles.sectionTitle}>
                      For today
                    </h2>
                    <Feed entries={entries} done={done} onDone={setDone} />
                  </section>
                )}
                {board && (
                  <FamilyWeekSummary
                    dashboard={board}
                    objectives={data.today.week.objectives}
                  />
                )}
                {getIn}
                {children.length > 1 && <ForAllKids place={place} />}
              </div>
            </div>
          )}
          {watch && classPlace && !dayZero && (
            <PastSessions family={family} place={classPlace} />
          )}
          {sheets}
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

/**
 * For all the kids at once (several children): the family's report cards,
 * once there is term work to report on, and the workbook print for them
 * all (the family's workbooks address).
 * Nothing until one of them applies.
 */
function ForAllKids({ place }: { place: ReturnType<typeof useFamilyPlace> }) {
  const children = place.data?.children ?? [];
  const several =
    !!place.own && children.some((child) => child.capabilities.createWorkbook);
  const cards = <FamilyReportCards place={place} />;
  if (!several) return cards;
  return (
    <ActionRow label="For all your kids">
      {cards}
      {several && (
        <Link
          to="/$"
          params={{ _splat: familyHref(place.family, "workbooks") }}
          className={buttonClass("secondary")}
          data-workbooks-several=""
        >
          Workbooks for all kids
        </Link>
      )}
    </ActionRow>
  );
}

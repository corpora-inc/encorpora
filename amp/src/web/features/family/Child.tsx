import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLearnerStore } from "../../learner-store";
import { z } from "zod";
import {
  CHILD_NAME_MAX,
  childNameProblem,
  PARENT_ENTRY_LINE,
} from "../../../learning/nickname";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { invalidateAccount } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { YearField } from "../../ui/YearField";
import { TryAsStudent } from "../profiles/TryAsStudent";
import { SatMathFocus } from "../practice/SatMathFocus";
import { rememberContinuation } from "../continue/memory";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
} from "../school/classes/ProgressRecord";
import { useHandOver } from "../school/classes/today/use-hand-over";
import { childProgressOptions, type FamilyChild } from "./api";
import { DevicesSheet } from "./Devices";
import {
  childOf,
  FamilyFrame,
  familyHref,
  useFamilyPlace,
  type FamilyPlace,
} from "./FamilyFrame";
import { AccessFact, ChildAction, WeekFactsOf } from "./Today";
import styles from "./Family.module.css";

/**
 * A child's page (`/family/<family>/kids/<learner>`): the same record a
 * teacher reads (where they are, their weeks, the skills they've earned and
 * their recent work), worded for a parent, with the one action that works
 * now and, for the parent who manages them, their name, birth year, consent
 * and devices. A second parent reads it and lets them practice here.
 */
export function ChildScreen() {
  const place = useFamilyPlace();
  const { learner } = useParams({ strict: false }) as { learner: string };
  const { data, family, session } = place;
  const child = childOf(data, learner);
  const progress = useQuery({
    ...childProgressOptions(session, family, learner),
    enabled: !!child?.capabilities.readProgress,
  });
  const { starting, error, clearError, handOver } = useHandOver(session);
  // This child is the one chosen on this device while their page is open:
  // their grade numbers (This device) and their learning screens are theirs.
  const known = !!child;
  useEffect(() => {
    if (known) useLearnerStore.getState().select(learner);
  }, [known, learner]);
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const devices = search.devices === 1 || search.devices === "1";
  const setDevices = (open: boolean) =>
    void navigate({
      to: ".",
      search: ((current: Record<string, unknown>) => {
        const next = { ...current };
        if (open) next.devices = 1;
        else delete next.devices;
        return next;
      }) as never,
      replace: !open,
    });
  if (data && !child)
    return (
      <FamilyFrame place={place}>
        <EmptyState
          title="This child isn’t in your family"
          action={
            <Link
              to="/$"
              params={{ _splat: familyHref(family) }}
              className={buttonClass("primary")}
            >
              Back to Today
            </Link>
          }
        >
          They may have been removed, or the link is for another family.
        </EmptyState>
      </FamilyFrame>
    );
  // Their class person, for their answers and a copy of their levels.
  const person =
    child && place.own
      ? child.classes.find((entry) => entry.id === place.own!.id)?.personId
      : undefined;
  const record = progress.data;
  return (
    <FamilyFrame
      place={place}
      loading={!!child?.capabilities.readProgress && progress.isPending}
    >
      {data && child && (
        <div className={styles.page} data-child-page={child.id}>
          <header className={styles.childHead}>
            <div className={styles.head}>
              <h1>{child.name}</h1>
              {child.birthYear && (
                <p className={styles.sub}>Born {child.birthYear}</p>
              )}
            </div>
            <div className={styles.childActions}>
              <ChildAction
                child={child}
                family={family}
                accountId={session.accountId}
                starting={starting}
                onPracticeHere={(id) => void handOver(id)}
                primary
              />
              {/* While free problems remain, the plan is one step away. */}
              {!child.access.hasAccess &&
                child.access.canPractice &&
                child.capabilities.continuePurchase &&
                child.paths.continue && (
                  <Link
                    to="/continue/$learnerId"
                    params={{ learnerId: child.id }}
                    className={buttonClass("secondary")}
                    data-continue={child.id}
                    onClick={() =>
                      rememberContinuation({
                        accountId: session.accountId,
                        learnerId: child.id,
                        returnTo: `/${familyHref(family, `kids/${child.id}`)}`,
                      })
                    }
                  >
                    Continue with AMP
                  </Link>
                )}
              {person && (
                <TryAsStudent
                  session={session}
                  personId={person}
                  label={`Try problems as ${child.name}`}
                />
              )}
            </div>
          </header>
          <section aria-labelledby="child-week" className={styles.section}>
            <h2 id="child-week" className={styles.label}>
              This week
            </h2>
            <div className={styles.weekRow}>
              <WeekFactsOf child={child} today={data.today.date} />
              <AccessFact child={child} />
            </div>
          </section>
          {record ? (
            <div className={styles.record}>
              <section
                aria-labelledby="child-levels"
                className={styles.section}
              >
                <h2 id="child-levels">Where {child.name} is</h2>
                <RecordLevels
                  record={record}
                  empty={`${child.name}’s levels show after a little practice.`}
                />
              </section>
              <section aria-labelledby="child-weeks" className={styles.section}>
                <h2 id="child-weeks">Time, by week</h2>
                <RecordWeeks record={record} />
              </section>
              <section
                aria-labelledby="child-skills"
                className={styles.section}
              >
                <h2 id="child-skills">Skills earned</h2>
                <RecordObjectives record={record} openSkills />
              </section>
              <section aria-labelledby="child-work" className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 id="child-work">Recent work</h2>
                  {child.capabilities.readWorkbooks && (
                    <Link
                      to="/learners/$learnerId/workbooks"
                      params={{ learnerId: child.id }}
                      className={buttonClass("secondary")}
                    >
                      Workbooks
                    </Link>
                  )}
                </div>
                <RecordWork
                  record={record}
                  workPath={
                    person
                      ? (attempt) => ({
                          kind: "work",
                          id: `${person}.${attempt}`,
                        })
                      : undefined
                  }
                />
              </section>
            </div>
          ) : progress.isError ? (
            <EmptyState
              title={`${child.name}’s record didn’t load`}
              action={
                <Button
                  variant="primary"
                  onClick={() => void progress.refetch()}
                >
                  Try again
                </Button>
              }
            >
              Check your connection, then try again.
            </EmptyState>
          ) : null}
          <ChildSettings
            place={place}
            child={child}
            onDevices={() => setDevices(true)}
          />
          {place.own && child.capabilities.manageDevices && (
            <DevicesSheet
              place={place}
              classId={place.own.id}
              open={devices}
              onOpenChange={setDevices}
            />
          )}
        </div>
      )}
      <Toast message={error} onDismiss={clearError} />
    </FamilyFrame>
  );
}

const ok = z.unknown();

/** What the parent who manages this child can change: their name, birth
 * year, consent and devices. Each row only where the server allows it; a
 * second parent reads the year. */
function ChildSettings({
  place,
  child,
  onDevices,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  onDevices: () => void;
}) {
  const { session } = place;
  const caps = child.capabilities;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(child.name);
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const say = (failure: unknown, fallback: string) => {
    console.error(fallback, failure);
    setError(
      failure instanceof AppError && failure.message
        ? failure.message
        : fallback,
    );
  };
  const rename = async () => {
    const value = name.trim();
    const problem = childNameProblem(value, CHILD_NAME_MAX);
    if (problem || !value) return setNameError(problem || "Enter a name.");
    setBusy(true);
    try {
      await request(
        `/family/learners/${encodeURIComponent(child.id)}/rename`,
        ok,
        { token: session.token, body: { name: value } },
      );
      await invalidateAccount(session.accountId);
      setNaming(false);
      setNotice("Name saved.");
    } catch (failure) {
      say(failure, "The name didn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const saveYear = async (year: string) => {
    if (Number(year) === child.birthYear) return;
    setBusy(true);
    try {
      await request(
        `/family/learners/${encodeURIComponent(child.id)}/birth-year`,
        ok,
        { token: session.token, body: { birthYear: Number(year) } },
      );
      await invalidateAccount(session.accountId);
      setNotice(`${child.name}’s birth year is ${year}.`);
    } catch (failure) {
      say(failure, "That year didn’t save. Choose it again from the list.");
    } finally {
      setBusy(false);
    }
  };
  // Practice settings that are this child's own (the SAT focus, from 13).
  const summary = place.me?.family.learners.find(
    (entry) => entry.id === child.id,
  );
  const age = child.birthYear
    ? new Date().getFullYear() - child.birthYear
    : null;
  const practice =
    caps.changePracticeSettings && !!summary && (age === null || age >= 13);
  const rows = [
    practice,
    caps.rename || caps.changeBirthYear || !!child.birthYear,
    caps.manageConsent,
    caps.manageDevices && !!place.own,
    caps.delete,
  ];
  if (!rows.some(Boolean)) return null;
  return (
    <section aria-labelledby="child-settings" className={styles.section}>
      <h2 id="child-settings">{child.name}’s settings</h2>
      <dl className={styles.settings}>
        {(caps.rename || naming) && (
          <div className={styles.setting}>
            {naming ? (
              <form
                className={styles.form}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void rename();
                }}
                style={{ gridColumn: "1 / -1" }}
              >
                <TextField
                  label="Name"
                  value={name}
                  error={nameError}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameError("");
                  }}
                  maxLength={CHILD_NAME_MAX}
                  autoComplete="off"
                  placeholder="First name or nickname"
                  title={PARENT_ENTRY_LINE}
                  autoFocus
                  disabled={busy}
                />
                <div className={styles.formActions}>
                  <Button
                    variant="primary"
                    disabled={busy}
                    aria-busy={busy || undefined}
                  >
                    Save name
                  </Button>
                  <Button
                    variant="quiet"
                    type="button"
                    onClick={() => {
                      setNaming(false);
                      setName(child.name);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className={styles.settingText}>
                  <dt>Name</dt>
                  <dd>{child.name}</dd>
                </div>
                <div className={styles.settingAction}>
                  <Button variant="secondary" onClick={() => setNaming(true)}>
                    Change
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {(caps.changeBirthYear || child.birthYear) && (
          <div className={styles.setting}>
            <div className={styles.settingText}>
              <dt>Birth year</dt>
              <dd>Sets where practice starts. Their answers stay.</dd>
            </div>
            <div className={styles.settingAction}>
              <YearField
                label={`Birth year, ${child.name}`}
                value={child.birthYear ? String(child.birthYear) : ""}
                placeholder="Choose a year"
                disabled={busy || !caps.changeBirthYear}
                onChange={(year) => void saveYear(year)}
              />
            </div>
          </div>
        )}
        {practice && summary && (
          <div className={styles.setting} data-practice-settings="">
            <div
              className={styles.settingText}
              style={{ gridColumn: "1 / -1" }}
            >
              <SatMathFocus
                key={`${session.accountId}:${child.id}`}
                learner={summary}
                token={session.token}
                identity={session.accountId}
                onSaved={() => invalidateAccount(session.accountId)}
              />
            </div>
          </div>
        )}
        {caps.manageDevices && place.own && (
          <div className={styles.setting}>
            <div className={styles.settingText}>
              <dt>Their own devices</dt>
              <dd>A code, a QR code or a printed card</dd>
            </div>
            <div className={styles.settingAction}>
              <Button variant="secondary" onClick={onDevices}>
                Open
              </Button>
            </div>
          </div>
        )}
        {caps.manageConsent && (
          <div className={styles.setting}>
            <div className={styles.settingText}>
              <dt>Consent</dt>
              <dd>What you agreed to for your children, and withdrawing it</dd>
            </div>
            <div className={styles.settingAction}>
              <Link
                to="/$"
                params={{ _splat: "account/privacy/consent" }}
                className={buttonClass("secondary")}
              >
                Open
              </Link>
            </div>
          </div>
        )}
        {caps.delete && (
          <div className={styles.setting}>
            <div className={styles.settingText}>
              <dt>Delete learning data</dt>
              <dd>{child.name}’s answers and levels, for good</dd>
            </div>
            <div className={styles.settingAction}>
              <Link
                to="/$"
                params={{ _splat: "account/privacy/delete" }}
                className={buttonClass("secondary")}
              >
                Open
              </Link>
            </div>
          </div>
        )}
      </dl>
      <Toast
        message={notice || error}
        onDismiss={() => (setNotice(""), setError(""))}
      />
    </section>
  );
}

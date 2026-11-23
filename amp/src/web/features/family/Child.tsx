import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { reportable } from "../../../learning/level-check";
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
import { ActionRow } from "../../ui/ActionRow";
import { YearField } from "../../ui/YearField";
import { Disclosure } from "../../ui/Disclosure";
import { PrintButton } from "../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { gradebookOptions } from "../school/classes/teacher-api";
import { WorkbookHistory } from "../workbooks/WorkbookHistoryScreen";
import { canReadWorkbooks, isDate } from "../workbooks/model";
import { WorkbookDaySheet } from "../workbooks/WorkbookDayScreen";
import { WorkbookResultsSheet } from "../workbooks/WorkbookResultsScreen";
import type { WorkbookLearner } from "../workbooks/WorkbookFrame";
import { childWorkbookPaths, WorkbookPathsContext } from "../workbooks/paths";
import { SatMathFocus } from "../practice/SatMathFocus";
import { ChildPracticeSettings } from "./Practice";
import { ResetPracticeLevel } from "../practice/ResetPracticeLevel";
import { rememberContinuation } from "../continue/memory";
import {
  RecordLevels,
  RecordObjectives,
  RecordWork,
} from "../school/classes/ProgressRecord";
import { useHandOver } from "../school/classes/today/use-hand-over";
import { areaSourceOf } from "../../nav/AreaLayer";
import layers from "../../nav/layers.module.css";
import { showByGrade } from "../inventory/inventory-view";
import { bandLabel, bands } from "../pathways/model";
import { learnerWhere } from "../../lib/learner-where";
import { childPath } from "../spaces/identity";
import { childProgressOptions, type FamilyChild } from "./api";
import { DevicesSheet, SignInPictures } from "./Devices";
import { ChildConsentPanel, ChildDeletePanel } from "../privacy/ChildPanels";
import {
  childOf,
  FamilyFrame,
  familyHref,
  useFamilyPlace,
  type FamilyPlace,
} from "./FamilyFrame";
import { AccessFact, ChildAction, WeekFactsOf } from "./Today";
import styles from "./Family.module.css";
import { ChildActivity } from "./ChildActivity";
import { useSheet } from "../../nav/sheet";
import { Sheet } from "../../ui/Sheet";
import { PayLink } from "../pay/link";
import { Form } from "../../ui/Form";

/**
 * A child's page (`/family/<family>/kids/<learner>`): the same record a
 * teacher reads (where they are, their weeks, the skills they've earned and
 * their recent work), worded for a parent: the hub for that child. Its
 * actions: Practice, and beside it their own devices (a code, a QR code or a
 * printed card). On the page, no pages of their own: their practice time
 * (#child-time), their workbooks (#child-workbooks) and their reports to
 * download (#child-reports). Their settings fold under one Settings, closed
 * until opened. A second parent reads it and lets them practice here.
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
  // Opened before the first answer: this visit keeps the level held, so its
  // bar takes the first estimate in place (CP-5 r2 #2).
  const openedUnmeasured = useRef<boolean | null>(null);
  // Something to report: a level with an answer behind it (Q-201).
  const hasReport = reportable(progress.data?.level);
  if (progress.data) openedUnmeasured.current ??= !hasReport;
  // Their own devices: a sheet over the page, in history state.
  const devices = useSheet("devices");
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
              Open Today
            </Link>
          }
        >
          They may have been removed, or the link is for another family.
        </EmptyState>
      </FamilyFrame>
    );
  // The roster person identifies this child's recorded answers.
  const person =
    child && place.own
      ? child.classes.find((entry) => entry.id === place.own!.id)?.personId
      : undefined;
  const record = progress.data;
  return (
    <FamilyFrame
      place={place}
      title={child?.name}
      description={child?.birthYear ? `Born ${child.birthYear}` : undefined}
      loading={!!child?.capabilities.readProgress && progress.isPending}
      area={
        record
          ? {
              ...areaSourceOf(record),
              // Under their whole level: every skill of their own grade.
              overallMore: child && (
                <ChildSkillsByGrade
                  family={family}
                  child={child}
                  level={record.level?.overall}
                />
              ),
            }
          : undefined
      }
    >
      {data && child && (
        <div className={styles.page} data-child-page={child.id}>
          <ChildActions
            place={place}
            child={child}
            starting={starting}
            onPracticeHere={(id) => void handOver(id)}
            onDevices={devices.show}
          />
          <section aria-labelledby="child-week" className={styles.section}>
            <h2 id="child-week" className={styles.label}>
              This week
            </h2>
            <div className={styles.weekRow}>
              <WeekFactsOf child={child} today={data.today.date} steady />
              <AccessFact child={child} />
            </div>
          </section>
          {record ? (
            <div className={styles.record}>
              <section
                aria-labelledby="child-levels"
                className={styles.section}
              >
                <h2 id="child-levels">Current estimates</h2>
                <RecordLevels
                  plain
                  record={record}
                  empty={`We’ll find ${child.name}’s level in a few minutes of practice.`}
                  openAreas
                  holdFirst={!!openedUnmeasured.current}
                />
              </section>
              <ChildActivity place={place} learner={child.id} record={record} />
              <section
                aria-labelledby="child-skills"
                className={styles.section}
              >
                <div className={styles.sectionHead}>
                  <h2 id="child-skills">Skills earned</h2>
                  {/* Their map and inventory, at their own addresses. */}
                  <span className={styles.sectionLinks}>
                    <Link
                      to="/$"
                      params={{
                        _splat: familyHref(family, `kids/${child.id}/pathways`),
                      }}
                      className={buttonClass("secondary")}
                    >
                      Pathways
                    </Link>
                    <Link
                      to="/$"
                      params={{
                        _splat: familyHref(
                          family,
                          `kids/${child.id}/inventory`,
                        ),
                      }}
                      className={buttonClass("secondary")}
                    >
                      Inventory
                    </Link>
                  </span>
                </div>
                <RecordObjectives record={record} openSkills />
              </section>
              <section aria-labelledby="child-work" className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 id="child-work">Recent work</h2>
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
          <ChildWorkbooks place={place} child={child} />
          {/* A progress report once there is progress to report, decided
              when the page opens: a first answer while it is open adds
              nothing above the settings. */}
          <ChildReports
            place={place}
            child={child}
            progress={
              child.capabilities.readProgress &&
              hasReport &&
              openedUnmeasured.current === false
            }
          />
          <ChildSettings place={place} child={child} />
          <ChildWorkbookOverlay place={place} child={child} />
          {place.own && child.capabilities.manageDevices && (
            <DevicesSheet
              place={place}
              classId={place.own.id}
              open={devices.open}
              onOpenChange={devices.onOpenChange}
            />
          )}
        </div>
      )}
      <Toast message={error} onDismiss={clearError} />
    </FamilyFrame>
  );
}

/** In a child's Overall: the way to every skill of their own grade, with
 * where they stand on each (their Inventory, by grade). The grade is the
 * best guess the page itself names (lib/learner-where.ts), and the link
 * opens on that very grade. */
function ChildSkillsByGrade({
  family,
  child,
  level,
}: {
  family: string;
  child: FamilyChild;
  level: Parameters<typeof learnerWhere>[0];
}) {
  const where = learnerWhere(level);
  const band = where
    ? bands[Math.min(bands.length - 1, Math.max(0, where.best))]
    : undefined;
  if (!band) return null;
  const path = childPath(family, child.id, "inventory");
  return (
    <section data-skills-by-grade={child.id}>
      <h3 className={layers.heading}>By grade</h3>
      <ul className={layers.rows}>
        <li>
          <Link
            to="/$"
            params={{ _splat: path.slice(1) }}
            className={layers.row}
            data-grade={band}
            // The address names the screen; its view opens on this grade.
            onClick={() => showByGrade(path, band)}
          >
            <span>All {bandLabel(band)} skills</span>
            <span className={layers.rowAction}>
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** A child's actions: Practice, and beside it their own devices, as near to
 * hand; while free problems remain, the plan. Their workbooks and reports
 * are sections of the page, not actions. */
export function ChildActions({
  place,
  child,
  starting,
  onPracticeHere,
  onDevices,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  starting: string | null;
  onPracticeHere: (learnerId: string) => void;
  onDevices: () => void;
}) {
  const { family, session } = place;
  return (
    <ActionRow>
      <ChildAction
        child={child}
        family={family}
        accountId={session.accountId}
        starting={starting}
        onPracticeHere={onPracticeHere}
        primary
      />
      {/* Their own devices: as near to hand as Practice. */}
      {place.own && child.capabilities.manageDevices && (
        <Button variant="secondary" data-own-devices="" onClick={onDevices}>
          Their own devices
        </Button>
      )}
      {/* While free problems remain, the plan is one step away. */}
      {!child.access.hasAccess &&
        child.access.canPractice &&
        child.capabilities.continuePurchase &&
        child.paths.continue && (
          <PayLink
            learnerId={child.id}
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
          </PayLink>
        )}
    </ActionRow>
  );
}

/** A child's workbooks, on their page: today's to make, the ones made
 * before to download, and results to enter. Their record arrives with the
 * page (family-routes), so the list never pushes the page down. */
function ChildWorkbooks({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}) {
  const learner = workbookLearner(place, child);
  // A day or its results open over the page: the list holds still.
  const { date, workbookId } = useParams({ strict: false }) as {
    date?: string;
    workbookId?: string;
  };
  if (!learner) return null;
  return (
    <section
      aria-labelledby="child-workbooks"
      className={styles.section}
      data-child-workbooks=""
    >
      <WorkbookPathsContext.Provider value={childWorkbookPaths(place.family)}>
        <WorkbookHistory
          section
          learner={learner}
          still={!!date || !!workbookId}
        />
      </WorkbookPathsContext.Provider>
    </section>
  );
}

/** The child as their workbooks know them, when this reader may read them. */
function workbookLearner(
  place: FamilyPlace,
  child: FamilyChild,
): WorkbookLearner | null {
  const learner = place.me?.family.learners.find(
    (entry) => entry.id === child.id && !entry.deletedAt,
  );
  if (!child.capabilities.readWorkbooks || !learner) return null;
  if (!canReadWorkbooks(learner)) return null;
  return {
    ...learner,
    pauseViewer: learner.simulation
      ? "profile"
      : learner.adult
        ? "adult"
        : "parent",
  };
}

/** A workbook day or its results, open over the child's page at its own
 * address (`kids/<id>/workbooks/<date>`, `…/<workbook>/results`); ✕ closes
 * it to the page. */
function ChildWorkbookOverlay({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}) {
  const { date, workbookId } = useParams({ strict: false }) as {
    date?: string;
    workbookId?: string;
  };
  const learner = workbookLearner(place, child);
  if (!learner || (!date && !workbookId)) return null;
  return (
    <WorkbookPathsContext.Provider value={childWorkbookPaths(place.family)}>
      {workbookId ? (
        <WorkbookResultsSheet learner={learner} workbookId={workbookId} />
      ) : isDate(date!) ? (
        <WorkbookDaySheet learner={learner} date={date!} />
      ) : null}
    </WorkbookPathsContext.Provider>
  );
}

/** A child's reports, each a PDF to download: their progress report, their
 * report card for the current term (a child of the family's own class),
 * and the family's grades to decide. */
function ChildReports({
  place,
  child,
  progress,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  progress: boolean;
}) {
  const { own, session } = place;
  const person = own
    ? child.classes.find((entry) => entry.id === own.id)?.personId
    : undefined;
  const graded = !!own && !!person && child.capabilities.readGrades;
  const term = useQuery({
    ...gradebookOptions(
      session,
      { org: own?.org ?? "", class: own?.id ?? "" },
      undefined,
    ),
    enabled: graded,
  }).data?.term?.id;
  const card = graded && !!term;
  const grades = !!own && child.capabilities.editGrades;
  if (!progress && !card && !grades) return null;
  const file = child.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section
      aria-labelledby="child-reports"
      className={styles.section}
      data-child-reports=""
    >
      <h2 id="child-reports">Reports</h2>
      <div className={styles.reportActions}>
        {progress && (
          <PrintButton
            variant="secondary"
            label={`Download ${child.name}’s progress report, PDF`}
            download={() =>
              downloadPdf({
                path: `${child.paths.progress.replace(/^\/api\/v1/, "")}.pdf?format=${paperFormat()}`,
                token: session.token,
                name: `amp-progress-report-${file}.pdf`,
              })
            }
          >
            Download progress report
          </PrintButton>
        )}
        {card && (
          <PrintButton
            variant="secondary"
            label={`Download ${child.name}’s report card, PDF`}
            download={() =>
              downloadPdf({
                path: `/school/classes/${encodeURIComponent(own!.id)}/report-cards.pdf?${new URLSearchParams(
                  { term: term!, student: person!, format: paperFormat() },
                )}`,
                token: session.token,
                name: `amp-report-card-${file}.pdf`,
              })
            }
          >
            Download report card
          </PrintButton>
        )}
        {grades && (
          <Link
            to="/$"
            params={{ _splat: familyHref(place.family, "reports/grades") }}
            className={buttonClass("secondary")}
          >
            Grades
          </Link>
        )}
      </div>
    </section>
  );
}

const ok = z.unknown();

/** Whether a reader may change or read anything of this child's settings:
 * a row shows only where the server allows it; a second parent reads the
 * year. */
function hasSettings(place: FamilyPlace, child: FamilyChild) {
  const caps = child.capabilities;
  return [
    caps.rename,
    caps.changeBirthYear || !!child.birthYear,
    caps.changePracticeSettings,
    caps.manageDevices && !!place.own,
    caps.manageConsent,
    caps.delete,
  ].some(Boolean);
}

/** What the parent who manages this child can change, on their page, folded
 * under one Settings: the same rows as the child's settings sheet over
 * family Settings. Deleting their data leaves for the family's Today. */
export function ChildSettings({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}) {
  const navigate = useNavigate();
  if (!hasSettings(place, child)) return null;
  return (
    <section aria-label={`${child.name}’s settings`} className={styles.section}>
      {/* One folded section: nothing of the settings shows on the page
          until it is opened. */}
      <Disclosure summary="Settings" className={styles.childSettings}>
        <ChildSettingsRows
          place={place}
          child={child}
          onDeleted={() =>
            navigate({
              to: "/$",
              params: { _splat: familyHref(place.family) },
              replace: true,
            })
          }
        />
      </Disclosure>
    </section>
  );
}

/**
 * One child's settings over family Settings (the IA v2 spec, §3.1; sheet
 * state `child:<learner>`): the same rows as their page's Settings, and a
 * link to their page.
 */
export function ChildSettingsSheet({
  place,
  child,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={child.name}
      description={
        child.capabilities.readProgress ? (
          // A whole 44 px target, as every control is (premium rule 4).
          <Link
            to="/$"
            params={{ _splat: familyHref(place.family, `kids/${child.id}`) }}
            className={buttonClass("quiet", "", "start")}
            data-child-progress={child.id}
          >
            Progress
          </Link>
        ) : undefined
      }
      tall
    >
      <div data-child-settings-sheet={child.id}>
        <ChildSettingsRows
          place={place}
          child={child}
          onDeleted={() => onOpenChange(false)}
        />
      </div>
    </Sheet>
  );
}

/** The rows of a child's settings: their name, birth year, practice level
 * (Reset), practice settings, sign-in pictures, then learning permission and deleting their
 * learning data, each a disclosure in place (never a sheet over a sheet).
 * `onDeleted` leaves whatever is about this child once their data is gone. */
function ChildSettingsRows({
  place,
  child,
  onDeleted,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  onDeleted: () => Promise<unknown> | void;
}) {
  const { session } = place;
  const caps = child.capabilities;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(child.name);
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const reportFailure = (failure: unknown, fallback: string) => {
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
      reportFailure(failure, "The name didn’t save. Try again.");
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
      reportFailure(
        failure,
        "That year didn’t save. Choose it again from the list.",
      );
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
  return (
    <>
      <dl className={styles.settings} data-child-settings="">
        {(caps.rename || naming) && (
          <div className={styles.setting}>
            {naming ? (
              <Form
                className={styles.form}
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
              </Form>
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
                earlier
                value={child.birthYear ? String(child.birthYear) : ""}
                placeholder="Choose a year"
                disabled={busy || !caps.changeBirthYear}
                onChange={(year) => void saveYear(year)}
              />
            </div>
          </div>
        )}
        {/* The holder starts their practice level again from the birth
            year (the server refuses anyone else); without a year there is
            nowhere to start from. The row's own "Now" says it worked. */}
        {caps.changePracticeSettings && child.birthYear != null && (
          <ResetPracticeLevel
            look="row"
            learner={child}
            disabled={busy}
            rowClass={{
              row: styles.setting,
              text: styles.settingText,
              action: styles.settingAction,
            }}
          />
        )}
        {caps.changePracticeSettings && (
          <ChildPracticeSettings place={place} child={child} />
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
        <SignInPictures key={child.id} place={place} child={child} />
      </dl>
      {caps.manageConsent && (
        <Disclosure summary="Learning permission">
          <ChildConsentPanel />
        </Disclosure>
      )}
      {caps.delete && (
        <Disclosure summary="Delete learning data">
          <ChildDeletePanel
            child={{ id: child.id, name: child.name }}
            onDone={onDeleted}
          />
        </Disclosure>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
      <Toast tone="status" message={notice} onDismiss={() => setNotice("")} />
    </>
  );
}

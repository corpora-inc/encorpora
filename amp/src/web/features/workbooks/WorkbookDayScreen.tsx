import { closeTo } from "../../lib/return-to";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Link,
  notFound,
  useNavigate,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { Fragment, useState, type ReactNode } from "react";
import { qk } from "../../lib/keys";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { Button, buttonClass } from "../../ui/Button";
import { Chips } from "../../ui/Chips";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { Toast } from "../../ui/Toast";
import {
  workbookAreaNames,
  type WorkbookChoicesInput,
  type WorkbookPaper,
  type WorkbookSummary,
} from "../../../workbook/contracts";
import {
  issueWorkbook,
  downloadWorkbook,
  workbookAreasOptions,
  workbookHistoryOptions,
  workbookPreviewOptions,
  type WorkbookMinutes,
} from "./api";
import {
  canMakeWorkbook,
  choicesLabel,
  dateLabel,
  defaultPaper,
  defaultWorkbookChoices,
  isDate,
  localDate,
  sectionNames,
  workbookMessage,
} from "./model";
import {
  changeWorkbookDay,
  useWorkbookDay,
  workbookDayKey,
  type WorkbookDayDraft,
} from "./draft-store";
import { useWorkbookPaths } from "./paths";
import { AllowancePause } from "../continue/AllowancePause";
import { WorkbookFrame, whose, type WorkbookLearner } from "./WorkbookFrame";
import { WorkbookHistory } from "./WorkbookHistoryScreen";
import { WorkbookList } from "./WorkbookList";
import styles from "./Workbooks.module.css";

export function WorkbookDayScreen() {
  const { learnerId, date } = useParams({ strict: false }) as {
    learnerId: string;
    date: string;
  };
  // An address that names no day is no screen.
  if (!isDate(date)) throw notFound();
  return (
    <WorkbookFrame learnerId={learnerId} withHistory>
      {(learner) => <DaySheet learner={learner} date={date} />}
    </WorkbookFrame>
  );
}

/** A day's workbook opens in a sheet over the learner's workbooks, the
 * screen it belongs to (docs/design/ia.md): the sheet has its own URL, and
 * Back, Escape and the close button all return to the list. */
function DaySheet({
  learner,
  date,
}: {
  learner: WorkbookLearner;
  date: string;
}) {
  return (
    <>
      {/* The list behind holds still while the day is open over it. */}
      <WorkbookHistory learner={learner} still />
      <WorkbookDaySheet learner={learner} date={date} />
    </>
  );
}

/** A day's workbook, as a sheet over the screen that lists the learner's
 * workbooks (useWorkbookPaths): its own address; ✕, Escape and the
 * browser's Back close it to that screen. */
export function WorkbookDaySheet({
  learner,
  date,
}: {
  learner: WorkbookLearner;
  date: string;
}) {
  const router = useRouter();
  const paths = useWorkbookPaths();
  const who = whose(learner);
  return (
    <Sheet
      open
      tall
      title={dateLabel(date)}
      description={who.label ?? undefined}
      onOpenChange={(open) => {
        // Back to where the day was opened, else its workbooks.
        if (!open) closeTo(router, `/${paths.list(learner.id)}`);
      }}
      returnFocus={() => document.querySelector<HTMLElement>("main h1") ?? null}
    >
      {date === localDate() ? (
        <TodayOrUsed key={learner.id} learner={learner} date={date} />
      ) : (
        <PastDay learner={learner} date={date} />
      )}
    </Sheet>
  );
}

type DayProps = {
  learner: WorkbookLearner;
  date: string;
};
/** Today: the controls that make a workbook, or, when the five free ones are
 * used, the line that says so with today's workbooks. Chosen once, from the
 * account's data on opening, so making the last free workbook never rebuilds
 * the screen; the controls then simply stop making new ones. */
function TodayOrUsed(props: DayProps) {
  const [used] = useState(() => !canMakeWorkbook(props.learner));
  return used ? <PastDay {...props} used /> : <Today {...props} />;
}

function Today({ learner, date }: DayProps) {
  const session = useSession();
  // The day's workbook and the next one's choices (draft-store.ts): the
  // address names the day; which workbook and how it is made are the day's
  // draft, kept for the tab.
  const day = workbookDayKey(session.accountId, learner.id, date);
  const draft = useWorkbookDay(day);
  const navigate = useNavigate();
  const paths = useWorkbookPaths();
  const client = useQueryClient();
  const paper = draft.paper ?? defaultPaper();
  const history = useQuery(workbookHistoryOptions(session, learner.id, date));
  const areas = useQuery(workbookAreasOptions(session, learner.id));
  const [draftId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const books = history.data?.workbooks ?? [];
  const latest = books.length
    ? Math.max(...books.map((w) => w.number))
    : undefined;
  const issued = !draft.draft
    ? books.find(
        (book) =>
          book.number === (draft.number ?? latest) &&
          (draft.minutes === undefined || book.minutes === draft.minutes),
      )
    : undefined;
  // A stored workbook keeps its own choices; editing starts another draft.
  const choices = issued?.choices ?? draft.choices ?? defaultWorkbookChoices;
  const minutes = draft.minutes ?? issued?.minutes ?? 45;
  const canMake = canMakeWorkbook(learner);
  const unavailable = history.isSuccess && !issued && !canMake;
  const input = {
    date,
    minutes,
    paper,
    choices,
    requestId: draft.draft ?? draftId,
  };
  const workbook = useQuery({
    ...workbookPreviewOptions(session, learner.id, input),
    enabled: history.isSuccess && !issued && !unavailable,
    placeholderData: unavailable ? undefined : keepPreviousData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const current =
    issued ?? (workbook.isPlaceholderData ? undefined : workbook.data);
  const ready = !!current && history.isSuccess;
  const areaName = (id: string) => workbookAreaNames[id] ?? id;
  const choosing = !current || saving || !canMake;
  // Every change of choices is a new draft, kept for the tab: the same
  // preview across a refresh and every retry.
  const changeDraft = (change: WorkbookDayDraft) => {
    setMessage("");
    changeWorkbookDay(day, {
      minutes,
      paper,
      choices,
      ...change,
      number: undefined,
      draft: crypto.randomUUID(),
    });
  };
  const roll = (next: WorkbookChoicesInput) =>
    changeDraft({
      choices: { ...next, areas: [...new Set(next.areas)].sort() },
    });
  const set = (change: {
    minutes?: WorkbookMinutes;
    paper?: WorkbookPaper;
  }) => {
    if (change.paper && change.minutes === undefined) {
      // Paper changes the print layout, never the questions or history.
      changeWorkbookDay(day, change);
    } else changeDraft(change);
  };
  async function issue() {
    if (issued) return issued;
    const made = await issueWorkbook(session, learner.id, input);
    // Keep this exact issued book visible even when it used the last allowance.
    client.setQueryData(
      workbookHistoryOptions(session, learner.id, date).queryKey,
      (prior: { workbooks: WorkbookSummary[]; pdf: boolean } | undefined) => ({
        pdf: prior?.pdf ?? false,
        workbooks: [
          made,
          ...(prior?.workbooks ?? []).filter((book) => book.id !== made.id),
        ],
      }),
    );
    changeWorkbookDay(day, {
      draft: undefined,
      number: made.number,
      minutes: made.minutes,
      choices: made.choices,
    });
    void client.invalidateQueries({ queryKey: meOptions(session).queryKey });
    void client.invalidateQueries({
      queryKey: qk.account(
        session.accountId,
        "workbooks",
        learner.id,
        "history",
      ),
    });
    return made;
  }
  async function commit(action: "download" | "results") {
    if (!current || saving) return;
    setMessage("");
    setSaving(true);
    try {
      const made = await issue();
      if (action === "download") {
        await downloadWorkbook(
          session,
          learner.id,
          made,
          paper,
          history.data?.pdf ?? false,
        );
      } else {
        await navigate({
          to: "/$",
          params: { _splat: paths.results(learner.id, made.id) },
        });
      }
    } catch (error) {
      console.error(
        `AMP couldn’t ${action === "download" ? "download" : "save"} a workbook`,
        error,
      );
      setMessage(
        workbookMessage(error, "The workbook couldn't be saved. Try again."),
      );
    } finally {
      setSaving(false);
    }
  }
  // The learner's areas set the options' height (their chips wrap to rows):
  // the day waits for them, so the workbook below never drops when they
  // land. A failed read still opens the day, with Mixed alone.
  if (areas.isPending)
    return (
      <div className={`${styles.skeleton} amp-skeleton`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  // A workbook that can't be made because the free ones are used is not a
  // failure: the card says so calmly, in the same place.
  const loadError = unavailable ? null : (history.error ?? workbook.error);
  const options = (
    <WorkbookOptions
      canMake={canMake}
      choosing={choosing}
      saving={saving}
      minutes={minutes}
      paper={paper}
      choices={choices}
      areas={areas.data?.areas}
      set={set}
      roll={roll}
    />
  );
  return (
    <>
      <div className={styles.dayActions} data-workbook-actions>
        <Button
          variant="secondary"
          className={styles.another}
          title="Roll another"
          disabled={choosing}
          onClick={() => roll(choices)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.dice}>
            <rect x="2.5" y="2.5" width="15" height="15" rx="3.5" />
            <circle cx="7" cy="7" r="1.3" />
            <circle cx="13" cy="13" r="1.3" />
            <circle cx="10" cy="10" r="1.3" />
          </svg>
          <span className={styles.anotherLabel}>Roll another</span>
        </Button>
        <Button
          variant="primary"
          className={styles.download}
          disabled={!ready || saving}
          aria-busy={saving || (!ready && !loadError && !unavailable)}
          onClick={() => void commit("download")}
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={styles.buttonIcon}
          >
            <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
          </svg>
          Download workbook
        </Button>
      </div>
      <div className={styles.builder}>
        {/* The options first, then the workbook they make: a new preview
            never moves a control. */}
        <section className={styles.optionsPanel} aria-label="Workbook options">
          <h3 className={styles.optionsTitle}>Options</h3>
          {options}
        </section>
        <Contents
          workbook={issued ?? workbook.data}
          draft={!issued}
          onResults={() => void commit("results")}
          busy={saving}
          stale={!current}
          learnerId={learner.id}
          date={date}
          areaName={areaName}
          used={
            unavailable && !workbook.data ? (
              <AllowancePause
                kind="workbooks"
                compact
                viewer={learner.pauseViewer}
                learner={learner}
              />
            ) : undefined
          }
          failure={
            loadError && !workbook.data
              ? {
                  text: workbookMessage(
                    loadError,
                    "Today's workbook couldn't be prepared. Try again.",
                  ),
                  retry: () => {
                    // Focus stays in the card the retry replaces.
                    document
                      .querySelector<HTMLElement>("[data-workbook-contents]")
                      ?.focus();
                    void history.refetch();
                    void workbook.refetch();
                  },
                }
              : undefined
          }
        />
      </div>
      {/* An action that fails says so in the shared toast, over the page. */}
      <Toast message={message} onDismiss={() => setMessage("")} />
    </>
  );
}

/** Options prepare an unsaved draft; paper only changes its print layout.
 * Areas wrap as whole chips and remain the panel's last group. */
function WorkbookOptions({
  canMake,
  choosing,
  saving,
  minutes,
  paper,
  choices,
  areas,
  set,
  roll,
}: {
  canMake: boolean;
  choosing: boolean;
  saving: boolean;
  minutes: WorkbookMinutes;
  paper: WorkbookPaper;
  choices: WorkbookChoicesInput;
  areas: readonly { id: string; label: string }[] | undefined;
  set: (change: { minutes?: WorkbookMinutes; paper?: WorkbookPaper }) => void;
  roll: (next: WorkbookChoicesInput) => void;
}) {
  return (
    <div className={styles.options}>
      <OptionGroup label="Length">
        <Segmented<"30" | "45" | "60">
          compact
          label="Length"
          disabled={!canMake || saving}
          value={String(minutes) as "30" | "45" | "60"}
          onChange={(value) =>
            set({ minutes: Number(value) as WorkbookMinutes })
          }
          options={[
            { value: "30", label: "30 min", detail: "Lighter" },
            { value: "45", label: "45 min", detail: "Typical" },
            { value: "60", label: "60 min", detail: "Longer" },
          ]}
        />
      </OptionGroup>
      <OptionGroup label="Paper size">
        <Segmented<WorkbookPaper>
          compact
          label="Paper size"
          disabled={saving}
          value={paper}
          onChange={(value) => set({ paper: value })}
          options={[
            { value: "letter", label: "Letter", detail: "US, Canada" },
            { value: "a4", label: "A4", detail: "Most countries" },
          ]}
        />
      </OptionGroup>
      <OptionGroup label="Level">
        <Segmented<WorkbookChoicesInput["lean"]>
          compact
          dense
          label="Level"
          value={choices.lean}
          disabled={choosing}
          onChange={(lean) => roll({ ...choices, lean })}
          options={[
            { value: "easier", label: "Easier" },
            { value: "level", label: "At level" },
            { value: "stretch", label: "Harder" },
          ]}
        />
      </OptionGroup>
      <OptionGroup label="Today’s idea">
        <Segmented<"lesson" | "problems">
          compact
          dense
          label="Today's idea"
          value={choices.lesson ? "lesson" : "problems"}
          disabled={choosing}
          onChange={(value) => roll({ ...choices, lesson: value === "lesson" })}
          options={[
            { value: "lesson", label: "Include" },
            { value: "problems", label: "Leave out" },
          ]}
        />
      </OptionGroup>
      <OptionGroup label="Areas">
        <Chips<string>
          label="Areas"
          disabled={choosing}
          value={choices.areas.length ? choices.areas : ["mixed"]}
          onChange={(next) => {
            const picked = next.filter((v) => v !== "mixed");
            const mixed =
              !picked.length ||
              (next.includes("mixed") && choices.areas.length > 0);
            roll({ ...choices, areas: mixed ? [] : picked });
          }}
          options={[
            { value: "mixed", label: "Mixed (recommended)" },
            ...(areas ?? []).map((a) => ({ value: a.id, label: a.label })),
          ]}
        />
      </OptionGroup>
    </div>
  );
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.choice}>
      <span className={styles.choiceLabel} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/** The workbook as a sheet of paper: what it is, what is in it, section by
 * section. The hero of the page; its space is held while it is made, and a
 * failure or the end of the free workbooks is said in that same space. */
function Contents({
  workbook,
  stale,
  learnerId,
  date,
  areaName,
  used,
  failure,
  draft = false,
  onResults,
  busy = false,
}: {
  draft?: boolean;
  onResults?: () => void;
  busy?: boolean;
  workbook?: WorkbookSummary;
  stale: boolean;
  learnerId: string;
  date: string;
  areaName: (id: string) => string;
  /** No new workbook: the free ones are used. Said in the card's space. */
  used?: ReactNode;
  /** A load that failed: said in the card's reserved space, with a retry. */
  failure?: { text: string; retry: () => void };
}) {
  const paths = useWorkbookPaths();
  return (
    <article
      className={`${styles.contents} ${stale && !failure && !used ? styles.stale : ""}`}
      data-workbook-contents
      tabIndex={-1}
      aria-label="Workbook contents"
    >
      {workbook ? (
        // Keyed, so the contents mount fresh: an unkeyed fragment would reuse
        // the skeleton's bars as its own nodes and count as a layout shift.
        <Fragment key="workbook">
          <div className={styles.paperHead}>
            <span>{dateLabel(date, "short")}</span>
            <span className={styles.code} aria-label="Workbook code">
              {draft ? "Preview" : workbook.code}
            </span>
          </div>
          <div className={styles.contentsHead}>
            <h2>Workbook No.&nbsp;{workbook.number}</h2>
            <p className={styles.summary}>
              About {Math.max(5, Math.round(workbook.estimatedMinutes / 5) * 5)}{" "}
              minutes · {workbook.problems}{" "}
              {workbook.problems === 1 ? "problem" : "problems"} · answer key
              included
            </p>
            <p className={styles.choiceLine}>
              {choicesLabel(workbook.choices, areaName) || "Mixed, at level"}
            </p>
          </div>
          <ol className={styles.sections}>
            {workbook.sections.map((section, index) => (
              <li key={section.kind}>
                <span className={styles.sectionIndex} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.sectionName}>
                  {sectionNames[section.kind]}
                  {section.title && (
                    <span className={styles.sectionTitle}>{section.title}</span>
                  )}
                </span>
                <span className={styles.count}>
                  {section.problems}
                  <span className={styles.countUnit}>
                    {section.problems === 1 ? " problem" : " problems"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.paperFoot}>
            {onResults ? (
              <Button
                variant="quiet"
                className={styles.resultsButton}
                align="start"
                disabled={stale || busy}
                aria-busy={busy}
                onClick={onResults}
              >
                Enter results
              </Button>
            ) : (
              <Link
                to="/$"
                params={{ _splat: paths.results(learnerId, workbook.id) }}
                className={buttonClass("quiet", styles.resultsButton, "start")}
              >
                Enter results
              </Link>
            )}
          </div>
        </Fragment>
      ) : used ? (
        used
      ) : failure ? (
        <div className={styles.failure} role="alert">
          <p>{failure.text}</p>
          <button
            type="button"
            className={styles.retry}
            onClick={failure.retry}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className={`${styles.skeleton} amp-skeleton`} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </article>
  );
}

function PastDay({
  learner,
  date,
  used = false,
}: DayProps & { used?: boolean }) {
  const session = useSession();
  const history = useQuery(workbookHistoryOptions(session, learner.id, date));
  return (
    <>
      {used && (
        <AllowancePause
          kind="workbooks"
          compact
          viewer={learner.pauseViewer}
          learner={learner}
        />
      )}
      {history.data && !history.data.workbooks.length ? (
        used ? null : (
          <div className={styles.notice}>
            <p>No workbook was made on this day.</p>
            <Link
              to="/learners/$learnerId/workbooks/$date"
              params={{ learnerId: learner.id, date: localDate() }}
              className={buttonClass("primary")}
            >
              Open today's workbook
            </Link>
          </div>
        )
      ) : (
        <WorkbookList learnerId={learner.id} query={history} />
      )}
    </>
  );
}

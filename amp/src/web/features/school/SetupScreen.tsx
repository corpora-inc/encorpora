import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Authorization } from "./pilots/Authorization";
import { Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  AGREEMENT_VERSION,
  agreementLead,
  agreementPromises,
  agreementSections,
  agreementTitle,
} from "../../../schools/agreement";
import {
  divisionKinds,
  divisionLabels,
  formatDay,
  suggestedYear,
  type DivisionKind,
} from "../../../schools/calendar";
import type {
  ExperiencePreset,
  SetupState,
} from "../../../schools/setup-contracts";
import { AppError } from "../../lib/AppError";
import { Button } from "../../ui/Button";
import { DatePicker } from "../../ui/DatePicker";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { TextArea, TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useLoggedError } from "../../feedback";
import { meOptions } from "../../lib/query";
import { PlaceSwitcher, placeEntries } from "../navigation/PlaceSwitcher";
import {
  currentSession,
  orgsOptions,
  refreshSchool,
  school,
  setupOptions,
} from "./api";
import { GradePicker } from "./parts";
import { classPath, orgPath, setupSteps, type SetupStep } from "./paths";
import { Brand } from "./SchoolFrame";
import { YearRibbon } from "./YearRibbon";
import styles from "./Setup.module.css";

const stepNames: Record<SetupStep, string> = {
  school: "School",
  calendar: "Calendar",
  experience: "Student experience",
  agreement: "Data agreement",
  students: "Students",
};
const experiences: {
  value: ExperiencePreset;
  title: string;
  detail: string;
}[] = [
  {
    value: "quiet",
    title: "Quiet focus",
    detail:
      "Each student sees only their own next problem. No levels, no boards.",
  },
  {
    value: "levels",
    title: "Levels visible",
    detail: "Students see their own working level as it grows.",
  },
  {
    value: "competition",
    title: "Friendly competition",
    detail: "Levels show, and each class has a top-10 board for growth.",
  },
];
const experienceTitle = (value: ExperiencePreset | null) =>
  experiences.find((entry) => entry.value === value)?.title;

export const COMMON_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
] as const;
const message = (error: unknown, fallback: string) =>
  error instanceof AppError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;

function useErrorState() {
  const [error, setError] = useState("");
  useLoggedError(error);
  return [error, setError] as const;
}

/** What each step asks, until it's answered: the line under every step's name
 * is always there, so an answer arriving moves nothing below it. */
const stepAsks: Record<SetupStep, string> = {
  school: "Name and time zone",
  calendar: "When the year runs",
  experience: "What students see",
  agreement: "Read and accept",
  students: "Import or type a roster",
};

/** The left of the page writes itself as the questions are answered, so it is
 * always clear what's been decided, and each line is a way back to change it. */
function Ledger({
  state,
  current,
  orgId,
}: {
  state: SetupState | null;
  current: SetupStep;
  orgId: string;
}) {
  const answers: Record<SetupStep, string | undefined> = {
    school: state?.org.name,
    calendar: state?.calendar
      ? `${formatDay(state.calendar.startsOn, false)} to ${formatDay(state.calendar.endsOn)}${state.calendar.division ? `, ${divisionLabels[state.calendar.division].plural.toLowerCase()}` : ""}`
      : undefined,
    experience: experienceTitle(state?.experience ?? null),
    agreement: state?.agreement
      ? `Accepted by ${state.agreement.signerName}`
      : undefined,
    students: undefined,
  };
  const reachable = (step: SetupStep) =>
    !!state &&
    (step === current ||
      !!answers[step] ||
      setupSteps.indexOf(step) === setupSteps.findIndex((s) => !answers[s]));
  return (
    <ol className={styles.ledger}>
      {setupSteps.map((step, index) => {
        const done = !!answers[step] && step !== current;
        const answer = answers[step];
        const inner = (
          <>
            <span className={styles.ledgerMark} aria-hidden="true">
              {done ? (
                <svg viewBox="0 0 16 16">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.ledgerText}>
              <span className={styles.ledgerName}>{stepNames[step]}</span>
              <span
                className={styles.ledgerAnswer}
                data-answered={answer ? "" : undefined}
                title={answer}
              >
                {answer ?? stepAsks[step]}
              </span>
            </span>
          </>
        );
        return (
          <li
            key={step}
            data-state={step === current ? "current" : done ? "done" : "next"}
          >
            {reachable(step) && step !== current ? (
              <Link
                to="/$"
                params={{ _splat: "school/new" }}
                search={{ org: orgId, step } as never}
                className={styles.ledgerRow}
              >
                {inner}
              </Link>
            ) : (
              <span
                className={styles.ledgerRow}
                aria-current={step === current ? "step" : undefined}
              >
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Frame({
  step,
  state,
  orgId,
  children,
  footer,
}: {
  step: SetupStep;
  state: SetupState | null;
  orgId: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const index = setupSteps.indexOf(step);
  const me = useQuery(meOptions(currentSession())).data;
  // A half-finished setup never keeps someone from their other places.
  const switcher =
    me?.signedIn && placeEntries(me).length > 1 ? (
      <PlaceSwitcher
        me={me}
        current={`school:${orgId}`}
        label={state?.org.name}
      />
    ) : null;
  return (
    <div className={styles.frame} data-dense>
      <aside className={styles.rail}>
        <Brand />
        {switcher && <div className={styles.places}>{switcher}</div>}
        <Ledger state={state} current={step} orgId={orgId} />
      </aside>
      <header className={styles.bar}>
        <Brand />
        <span className={styles.barStep}>
          Step {index + 1} of {setupSteps.length}
        </span>
        <span
          className={styles.barMeter}
          role="progressbar"
          aria-label="Setup"
          aria-valuemin={0}
          aria-valuemax={setupSteps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Step ${index + 1} of ${setupSteps.length}, ${stepNames[step]}`}
        >
          {setupSteps.map((entry, position) => (
            <span key={entry} data-filled={position <= index || undefined} />
          ))}
        </span>
        {switcher && <div className={styles.barPlaces}>{switcher}</div>}
      </header>
      <main className={styles.main}>
        <div className={styles.question}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>{footer}</div>
      </footer>
    </div>
  );
}

function BackButton({ orgId, to }: { orgId: string; to: SetupStep }) {
  return (
    <Link
      to="/$"
      params={{ _splat: "school/new" }}
      search={{ org: orgId, step: to } as never}
      className={styles.back}
    >
      Back
    </Link>
  );
}

/** Answered when we issued the school; the admin can change any of it. */
function SchoolStep({ state, orgId }: { state: SetupState; orgId: string }) {
  const session = currentSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(state.org.name);
  const [shape, setShape] = useState<"class" | "school">(
    state.org.solo ? "class" : "school",
  );
  const [timezone, setTimezone] = useState(state.org.timezone);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useErrorState();
  const zones = useMemo(() => {
    const known = COMMON_ZONES.some(([zone]) => zone === timezone);
    return known
      ? COMMON_ZONES
      : ([[timezone, timezone.replaceAll("_", " ")], ...COMMON_ZONES] as const);
  }, [timezone]);
  const submit = async () => {
    if (!name.trim()) {
      setNameError("Enter a name. It can be your own class’s name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = { name: name.trim(), shape, timezone };
      const saved = await school.updateSchool(session, orgId, body);
      client.setQueryData(setupOptions(session, orgId).queryKey, saved);
      await refreshSchool(session);
      await navigate({
        to: "/$",
        params: { _splat: "school/new" },
        search: { org: orgId, step: "calendar" } as never,
      });
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(false);
    }
  };
  return (
    <Frame
      step="school"
      state={state}
      orgId={orgId}
      footer={
        <>
          <span />
          <Button
            variant="primary"
            aria-busy={busy}
            disabled={busy}
            className={styles.next}
            onClick={() => void submit()}
          >
            Continue
          </Button>
        </>
      }
    >
      <h1>Where will you use AMP?</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="School name"
          value={name}
          autoComplete="organization"
          placeholder="Alder Street School"
          maxLength={200}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
          }}
        />
        <div className={styles.group}>
          <span className={styles.groupLabel}>Who is this for?</span>
          <Segmented
            label="Who is this for?"
            value={shape}
            onChange={setShape}
            options={[
              {
                value: "class",
                label: "Just my class",
                detail: "One teacher and one class.",
              },
              {
                value: "school",
                label: "A school",
                detail: "Teachers, classes and a shared roster.",
              },
            ]}
          />
        </div>
        <div className={styles.timezone}>
          <span className={styles.groupLabel}>Time zone</span>
          <Select
            aria-label="Time zone"
            value={timezone}
            onValueChange={setTimezone}
          >
            {zones.map(([zone, label]) => (
              <option key={zone} value={zone}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </form>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

function CalendarStep({ state, orgId }: { state: SetupState; orgId: string }) {
  const session = currentSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const suggested = suggestedYear(today);
  const [startsOn, setStartsOn] = useState(
    state.calendar?.startsOn ?? suggested.startsOn,
  );
  const [endsOn, setEndsOn] = useState(
    state.calendar?.endsOn ?? suggested.endsOn,
  );
  const [division, setDivision] = useState<DivisionKind | null>(
    state.calendar ? state.calendar.division : "semester",
  );
  const [busy, setBusy] = useState<"save" | "later" | null>(null);
  const [error, setError] = useErrorState();
  const tooShort =
    (Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 < 30;
  const tooLong =
    (Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 > 400;
  const dateError = tooShort
    ? "The year needs to end at least a month after it starts."
    : tooLong
      ? "A school year can run at most 13 months."
      : "";
  const go = async (work: () => Promise<unknown>, which: "save" | "later") => {
    setBusy(which);
    setError("");
    try {
      await work();
      await client.invalidateQueries({
        queryKey: setupOptions(session, orgId).queryKey,
      });
      await navigate({
        to: "/$",
        params: { _splat: "school/new" },
        search: { org: orgId, step: "experience" } as never,
      });
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(null);
    }
  };
  return (
    <Frame
      step="calendar"
      state={state}
      orgId={orgId}
      footer={
        <>
          <BackButton orgId={orgId} to="school" />
          <div className={styles.footerRight}>
            <Button
              variant="quiet"
              aria-busy={busy === "later"}
              disabled={!!busy}
              onClick={() =>
                void go(() => school.defaultCalendar(session, orgId), "later")
              }
            >
              Decide later
            </Button>
            <Button
              variant="primary"
              className={styles.next}
              aria-busy={busy === "save"}
              disabled={!!busy || !!dateError}
              onClick={() =>
                void go(
                  () =>
                    school.setCalendar(session, orgId, {
                      startsOn,
                      endsOn,
                      division,
                    }),
                  "save",
                )
              }
            >
              Continue
            </Button>
          </div>
        </>
      }
    >
      <h1>When does your school year run?</h1>
      <div className={styles.dates}>
        <DatePicker label="First day" value={startsOn} onChange={setStartsOn} />
        <DatePicker
          label="Last day"
          value={endsOn}
          onChange={setEndsOn}
          error={dateError}
        />
      </div>
      <div className={styles.group}>
        <span className={styles.groupLabel}>How is it divided?</span>
        <Segmented
          label="How is it divided?"
          compact
          value={division ?? "none"}
          onChange={(value) =>
            setDivision(value === "none" ? null : (value as DivisionKind))
          }
          options={[
            { value: "none", label: "None" },
            ...divisionKinds.map((kind) => ({
              value: kind,
              label: divisionLabels[kind].plural,
            })),
          ]}
        />
      </div>
      <YearRibbon startsOn={startsOn} endsOn={endsOn} division={division} />
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** A student's screen in miniature, so the choice is seen rather than imagined. */
function ExperiencePreview({ kind }: { kind: ExperiencePreset }) {
  return (
    <span className={styles.preview} aria-hidden="true">
      <span className={styles.previewProblem} />
      <span className={styles.previewProblemShort} />
      {kind !== "quiet" && <span className={styles.previewLevel}>5.4</span>}
      {kind === "competition" && (
        <span className={styles.previewBoard}>
          <i />
          <i />
          <i data-you />
        </span>
      )}
    </span>
  );
}

function ExperienceStep({
  state,
  orgId,
}: {
  state: SetupState;
  orgId: string;
}) {
  const session = currentSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [value, setValue] = useState<ExperiencePreset>(
    state.experience ?? "quiet",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useErrorState();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await school.setExperience(session, orgId, value);
      client.setQueryData(setupOptions(session, orgId).queryKey, saved);
      await navigate({
        to: "/$",
        params: { _splat: "school/new" },
        search: { org: orgId, step: "agreement" } as never,
      });
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(false);
    }
  };
  return (
    <Frame
      step="experience"
      state={state}
      orgId={orgId}
      footer={
        <>
          <BackButton orgId={orgId} to="calendar" />
          <Button
            variant="primary"
            className={styles.next}
            aria-busy={busy}
            disabled={busy}
            onClick={() => void submit()}
          >
            Continue
          </Button>
        </>
      }
    >
      <h1>What should students see?</h1>
      <p className={styles.lede}>
        Practice is the same either way. Any class can change this later.
      </p>
      <div
        className={styles.cards}
        role="radiogroup"
        aria-label="Student experience"
      >
        {experiences.map((entry, index) => (
          <button
            key={entry.value}
            type="button"
            role="radio"
            ref={(node) => {
              buttons.current[index] = node;
            }}
            aria-checked={value === entry.value}
            tabIndex={value === entry.value ? 0 : -1}
            className={styles.card}
            onClick={() => setValue(entry.value)}
            onKeyDown={(event) => {
              const step =
                event.key === "ArrowDown" || event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowUp" || event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!step) return;
              event.preventDefault();
              const next =
                (index + step + experiences.length) % experiences.length;
              setValue(experiences[next]!.value);
              buttons.current[next]?.focus();
            }}
          >
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{entry.title}</span>
              <span className={styles.cardDetail}>{entry.detail}</span>
            </span>
            <ExperiencePreview kind={entry.value} />
          </button>
        ))}
      </div>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** The whole agreement, readable on a phone. Used here and on the privacy page. */
export function AgreementText() {
  return (
    <div className={styles.agreement}>
      <p className={styles.agreementLead}>{agreementLead}</p>
      {agreementSections.map((section) => (
        <section key={section.heading}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p className={styles.agreementVersion}>Version {AGREEMENT_VERSION}</p>
    </div>
  );
}

function AgreementStep({ state, orgId }: { state: SetupState; orgId: string }) {
  const session = currentSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const accepted = state.agreement;
  const [name, setName] = useState(accepted?.signerName ?? "");
  const [title, setTitle] = useState(accepted?.signerTitle ?? "");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; title?: string }>({});
  const [error, setError] = useErrorState();
  const next = () =>
    navigate({
      to: "/$",
      params: { _splat: "school/new" },
      search: { org: orgId, step: "students" } as never,
    });
  const accept = async () => {
    const missing = {
      ...(name.trim() ? {} : { name: "Enter your name." }),
      ...(title.trim() ? {} : { title: "Enter your role." }),
    };
    setErrors(missing);
    if (missing.name || missing.title) return;
    setBusy(true);
    setError("");
    try {
      const saved = await school.acceptAgreement(session, orgId, {
        version: AGREEMENT_VERSION,
        signerName: name.trim(),
        signerTitle: title.trim(),
      });
      client.setQueryData(setupOptions(session, orgId).queryKey, saved);
      await next();
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(false);
    }
  };
  return (
    <Frame
      step="agreement"
      state={state}
      orgId={orgId}
      footer={
        <>
          <BackButton orgId={orgId} to="experience" />
          {accepted ? (
            <Button
              variant="primary"
              className={styles.next}
              onClick={() => void next()}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              className={styles.next}
              aria-busy={busy}
              disabled={busy || !authorized}
              onClick={() => void accept()}
            >
              Accept
            </Button>
          )}
        </>
      }
    >
      <h1>Accept the data agreement</h1>
      <p className={styles.lede}>
        It covers how AMP handles student data for {state.org.name}, including
        FERPA and COPPA.
      </p>
      <ul className={styles.promises}>
        {agreementPromises.map((promise) => (
          <li key={promise.title}>
            <strong>{promise.title}</strong>
            <span>{promise.detail}</span>
          </li>
        ))}
      </ul>
      {/* The one agreement control, as a teacher's class setup has it
          (pilots/Authorization): who signs, the tick, the text a tap away. */}
      <form
        className={styles.signer}
        onSubmit={(event) => {
          event.preventDefault();
          if (!accepted && authorized) void accept();
        }}
      >
        <Authorization
          scope="school"
          acceptedAt={accepted?.acceptedAt}
          name={name}
          title={title}
          authorized={!!accepted || authorized}
          onName={(value) => {
            setName(value);
            setErrors((prior) => ({ ...prior, name: undefined }));
          }}
          onTitle={(value) => {
            setTitle(value);
            setErrors((prior) => ({ ...prior, title: undefined }));
          }}
          onAuthorized={setAuthorized}
          errors={errors}
          disabled={busy || !!accepted}
        />
      </form>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** The seats we issued, in the school's own days. */
function seatsLine(license: SetupState["license"]) {
  if (!license) return "Each student you add takes a seat.";
  const today = new Date().toISOString().slice(0, 10);
  const seats = `${license.seats.toLocaleString("en-US")} ${license.seats === 1 ? "seat is" : "seats are"}`;
  return license.startsOn > today
    ? `${seats} ready from ${formatDay(license.startsOn)} through ${formatDay(license.endsOn)}. Each student you add takes one.`
    : `${seats} ready through ${formatDay(license.endsOn)}. Each student you add takes one.`;
}

const splitLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);

function StudentsStep({
  state,
  orgId,
  method,
}: {
  state: SetupState;
  orgId: string;
  method: "names" | null;
}) {
  const session = currentSession();
  const navigate = useNavigate();
  const solo = state.org.solo;
  const [className, setClassName] = useState(
    state.firstClass?.name ?? (solo ? "My class" : ""),
  );
  const [names, setNames] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [busy, setBusy] = useState<"import" | "skip" | "names" | null>(null);
  const [classError, setClassError] = useState("");
  const [error, setError] = useErrorState();
  const typed = splitLines(names);
  const tooMany = typed.length > 500;
  const finish = async (
    which: "import" | "skip" | "names",
    body: { className?: string; names?: string[]; gradeLevel?: number },
    landing: (classId: string | null) => string,
  ) => {
    setBusy(which);
    setError("");
    try {
      const done = await school.finish(session, orgId, body);
      await refreshSchool(session);
      await navigate({
        to: "/$",
        params: { _splat: landing(done.classId) },
        replace: true,
      });
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(null);
    }
  };
  const classHome = (classId: string | null) =>
    classId ? classPath(orgId, classId) : orgPath(orgId, "classes");
  if (method === "names") {
    const submit = () => {
      if (!className.trim()) {
        setClassError("Enter a name for the class.");
        return;
      }
      void finish(
        "names",
        {
          className: className.trim(),
          ...(typed.length ? { names: typed } : {}),
          ...(grade !== null ? { gradeLevel: grade } : {}),
        },
        classHome,
      );
    };
    return (
      <Frame
        step="students"
        state={state}
        orgId={orgId}
        footer={
          <>
            <BackButton orgId={orgId} to="students" />
            <Button
              variant="primary"
              className={styles.next}
              aria-busy={busy === "names"}
              disabled={!!busy || tooMany}
              onClick={submit}
            >
              {typed.length
                ? `Add ${typed.length} ${typed.length === 1 ? "student" : "students"}`
                : "Add class"}
            </Button>
          </>
        }
      >
        <h1>Who’s in your class?</h1>
        <div className={styles.form}>
          <TextField
            label="Class name"
            value={className}
            placeholder="Grade 5 Math"
            maxLength={100}
            error={classError}
            onChange={(event) => {
              setClassName(event.target.value);
              setClassError("");
            }}
          />
          <TextArea
            label="Student names, one per line"
            maxLength={25_000}
            rows={9}
            value={names}
            placeholder={"Ana Ruiz\nNoor Haddad\nCher"}
            onChange={(event) => setNames(event.target.value)}
          />
          <p className={styles.fieldNote} role={tooMany ? "alert" : undefined}>
            {tooMany
              ? "That’s more than 500 names. Import them as a file instead."
              : "First and last, or just one name. You can add the rest later."}
          </p>
          <GradePicker label="Their grade" value={grade} onChange={setGrade} />
        </div>
        <Toast message={error} onDismiss={() => setError("")} />
      </Frame>
    );
  }
  const finishForImport = () =>
    void finish(
      "import",
      solo ? { className: className.trim() || "My class" } : {},
      () => orgPath(orgId, "import"),
    );
  const skip = () =>
    void finish(
      "skip",
      { className: className.trim() || "My class" },
      classHome,
    );
  return (
    <Frame
      step="students"
      state={state}
      orgId={orgId}
      footer={<BackButton orgId={orgId} to="agreement" />}
    >
      <h1>Add your students</h1>
      <p className={styles.lede}>{seatsLine(state.license)}</p>
      <ul className={styles.routes}>
        <li>
          <button
            type="button"
            className={styles.route}
            aria-busy={busy === "import"}
            disabled={!!busy}
            onClick={finishForImport}
          >
            <span className={styles.routeTitle}>Import a roster</span>
            <span className={styles.routeDetail}>
              A CSV, a OneRoster ZIP, or a paste from a spreadsheet. See every
              change before anything is saved.
            </span>
          </button>
        </li>
        <li>
          <Link
            to="/$"
            params={{ _splat: "school/new" }}
            search={{ org: orgId, step: "students", by: "names" } as never}
            className={styles.route}
          >
            <span className={styles.routeTitle}>Type their names</span>
            <span className={styles.routeDetail}>
              {solo ? "Good for one class." : "One class, by hand."}
            </span>
          </Link>
        </li>
        {solo && (
          <li>
            <button
              type="button"
              className={styles.route}
              aria-busy={busy === "skip"}
              disabled={!!busy}
              onClick={skip}
            >
              <span className={styles.routeTitle}>Skip for now</span>
              <span className={styles.routeDetail}>
                Go straight to your class and add them when you’re ready.
              </span>
            </button>
          </li>
        )}
      </ul>
      <Toast message={error} onDismiss={() => setError("")} />
    </Frame>
  );
}

/** Guided setup: one question a screen, each its own URL. Every answer is saved
 * as it's given, so Back, reload and coming back tomorrow all land here. */
export function SetupScreen() {
  const search = useSearch({ strict: false }) as {
    org?: unknown;
    step?: unknown;
    by?: unknown;
  };
  const session = currentSession();
  const orgs = useQuery(orgsOptions(session)).data ?? [];
  const known = orgs.find((org) => org.id === search.org);
  const orgId = known?.id ?? null;
  const setup = useQuery({
    ...setupOptions(session, orgId ?? "none"),
    enabled: !!orgId,
  });
  const state = orgId ? (setup.data ?? null) : null;
  const step: SetupStep =
    setupSteps.find((entry) => entry === search.step) ?? "school";
  // Only a school we issued has setup; the route sends anyone else on.
  if (!orgId) return <Navigate to="/schools" replace />;
  if (!state)
    return (
      <Frame
        step={step}
        state={null}
        orgId={orgId}
        footer={
          <Button variant="primary" className={styles.next} disabled aria-busy>
            Continue
          </Button>
        }
      >
        <div className={styles.waiting}>
          {setup.isError ? (
            <>
              <h1>That didn’t load</h1>
              <p className={styles.lede}>
                Your answers are saved.{" "}
                <button
                  type="button"
                  className={styles.inlineAction}
                  onClick={() => void setup.refetch()}
                >
                  Try again
                </button>
              </p>
            </>
          ) : null}
        </div>
      </Frame>
    );
  switch (step) {
    case "school":
      return <SchoolStep key={orgId} state={state} orgId={orgId} />;
    case "calendar":
      return <CalendarStep key={orgId} state={state} orgId={orgId} />;
    case "experience":
      return <ExperienceStep key={orgId} state={state} orgId={orgId} />;
    case "agreement":
      return <AgreementStep key={orgId} state={state} orgId={orgId} />;
    case "students":
      return (
        <StudentsStep
          key={orgId}
          state={state}
          orgId={orgId}
          method={search.by === "names" ? "names" : null}
        />
      );
  }
}

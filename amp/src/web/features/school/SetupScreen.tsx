import { reportError } from "../../lib/report-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Authorization } from "./pilots/Authorization";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
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
import { Button } from "../../ui/Button";
import { FlowSteps } from "../../ui/FlowSteps";
import { Page } from "../../ui/Page";
import { DatePicker } from "../../ui/DatePicker";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { TextArea, TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useLoggedError } from "../../feedback";
import { currentSession, refreshSchool, school, setupOptions } from "./api";
import { GradePicker } from "./parts";
import {
  classPath,
  orgPath,
  setupPath,
  setupSteps,
  type SetupStep,
} from "./paths";
import { YearRibbon } from "./YearRibbon";
// The dense page's element resets (lists, paragraphs, headings) arrive with
// the wizard, never later from another screen's chunk, which moved every
// step's content as they landed.
import "./SchoolFrame.module.css";
import styles from "./Setup.module.css";
import { Form } from "../../ui/Form";

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

const SETUP_FLOW = setupSteps.map((id) => ({ id, label: stepNames[id] }));

/** One step of guided setup: where it stands on the shared stepper (its done
 * steps link to their own addresses; there is no in-page Back), the step's
 * question, and what comes next at the same bottom edge on every step. The
 * app's bar above it holds the menu and the place switcher. */
function Frame({
  step,
  orgId,
  children,
  footer,
}: {
  step: SetupStep;
  state?: SetupState | null;
  orgId: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Page className={styles.page} data-dense>
      <FlowSteps
        steps={SETUP_FLOW}
        current={setupSteps.indexOf(step)}
        href={(id) => `/${setupPath(orgId, id as SetupStep)}`}
        label="Setup"
      />
      <div className={styles.question}>{children}</div>
      <div className={styles.footer}>
        <div className={styles.footerInner}>{footer}</div>
      </div>
    </Page>
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
        to: `/${setupPath(orgId, "calendar")}` as never,
      });
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "save the school's setup",
          fallback: "That didn’t save. Try again.",
        }),
      );
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
      <Form
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
                label: "One class",
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
      </Form>
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
        to: `/${setupPath(orgId, "experience")}` as never,
      });
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "save the school calendar",
          fallback: "That didn’t save. Try again.",
        }),
      );
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
        to: `/${setupPath(orgId, "agreement")}` as never,
      });
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "save the student experience",
          fallback: "That didn’t save. Try again.",
        }),
      );
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
      <p className={styles.lede}>Any class can change this later.</p>
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
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [error, setError] = useErrorState();
  const next = () =>
    navigate({
      to: `/${setupPath(orgId, "students")}` as never,
    });
  const accept = async () => {
    const missing = name.trim() ? {} : { name: "Enter your name." };
    setErrors(missing);
    if (missing.name) return;
    setBusy(true);
    setError("");
    try {
      const saved = await school.acceptAgreement(session, orgId, {
        version: AGREEMENT_VERSION,
        signerName: name.trim(),
      });
      client.setQueryData(setupOptions(session, orgId).queryKey, saved);
      await next();
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "accept the student data agreement",
          fallback: "That didn’t save. Try again.",
        }),
      );
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
      <Form
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
          authorized={!!accepted || authorized}
          onName={(value) => {
            setName(value);
            setErrors((prior) => ({ ...prior, name: undefined }));
          }}
          onAuthorized={setAuthorized}
          errors={errors}
          disabled={busy || !!accepted}
        />
      </Form>
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
    state.firstClass?.name ?? (solo ? "Math class" : ""),
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
      setError(
        reportError(failure, {
          doing: "finish school setup",
          fallback: "That didn’t save. Try again.",
        }),
      );
      setBusy(null);
    }
  };
  const classHome = (classId: string | null) =>
    classId ? classPath(orgId, classId) : orgPath(orgId, "classes");
  const finishForImport = () =>
    void finish(
      "import",
      solo ? { className: className.trim() || "Math class" } : {},
      () => orgPath(orgId, "import"),
    );
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
            {/* The other way to bring students: an alternative, never a
                way Back (the stepper and the browser go back). */}
            <Button
              variant="quiet"
              aria-busy={busy === "import"}
              disabled={!!busy}
              onClick={finishForImport}
            >
              Import a roster instead
            </Button>
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
  const skip = () =>
    void finish(
      "skip",
      { className: className.trim() || "Math class" },
      classHome,
    );
  return (
    <Frame step="students" state={state} orgId={orgId} footer={null}>
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
            to={`/${setupPath(orgId, "students", "names")}` as never}
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
 * as it's given, so the browser's Back, a reload and coming back tomorrow all
 * land here. */
export function SetupScreen() {
  const params = useParams({ strict: false }) as {
    org: string;
    step?: string;
    method?: string;
  };
  const session = currentSession();
  // The route already checked the org and the step (app/school-guards.ts).
  const orgId = params.org;
  const setup = useQuery(setupOptions(session, orgId));
  const state = setup.data ?? null;
  const step: SetupStep =
    setupSteps.find((entry) => entry === params.step) ?? "school";
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
          method={params.method === "names" ? "names" : null}
        />
      );
  }
}

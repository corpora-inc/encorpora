import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { startSchoolClassSchema } from "../../../../schools/pilot-contracts";
import { AppError } from "../../../lib/AppError";
import { meOptions } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { Select } from "../../../ui/Select";
import { TextArea, TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { deviceTimeZone, useStartDemo } from "../../onboarding/starter-api";
import { StepFrame } from "../../onboarding/setup/StepFrame";
import { currentSession, orgsOptions, refreshSchool } from "../api";
import { COURSE_OPTIONS, courseFromName } from "../courses";
import { Authorization } from "./Authorization";
import { classAuthorizationOptions, pilotApi } from "./api";
import {
  draftFor,
  NEW_SCHOOL,
  parseNames,
  START_STEPS,
  startStepUrl,
  useStartDraft,
  type StartDraft,
  type StartStep,
} from "./start-steps";
import styles from "./Start.module.css";

/** The most names one class takes at setup (the start contract's limit). */
const MAX_NAMES = 500;
const fieldOk = (
  field: "schoolName" | "className" | "signerName",
  value: string,
) => startSchoolClassSchema.shape[field].safeParse(value).success;

/** The teacher's draft and the account's schools, as each step reads them. */
function useStart() {
  const session = currentSession();
  const account = useQuery(meOptions(session));
  const orgs = useQuery(orgsOptions(session));
  const store = useStartDraft();
  const draft = draftFor(store, session.accountId);
  const schools = (orgs.data ?? []).filter(
    (org) => org.kind === "school" && !org.demo,
  );
  const school =
    draft.school === NEW_SCHOOL
      ? null
      : (schools.find((org) => org.id === draft.school) ?? schools[0] ?? null);
  const edit = (change: Partial<StartDraft>) =>
    store.edit(session.accountId, change);
  // The class's course, suggested by its name until the teacher picks one.
  const course = draft.course ?? courseFromName(draft.className) ?? "";
  // What the first step needs before the students: a school and a class.
  const classReady =
    !!draft.className.trim() && (!!school || !!draft.schoolName.trim());
  return {
    session,
    loading: account.isPending || orgs.isPending,
    draft,
    schools,
    school,
    course,
    classReady,
    edit,
    clear: store.clear,
  };
}

/** `/school/start`: a teacher's class, in two calm steps (docs/product-model.md,
 * founder ruling 2026-11-15): no confirmed mailbox, contract, card or operator
 * first. Step one names the class; step two adds its students and accepts the
 * student data agreement, which is the one tick a class needs, inside the
 * flow. The class's 30-day pilot starts as it is made. */
export function SchoolStartScreen() {
  return <TeacherStart step="" />;
}
/** `/school/start/students`: the class's students, then the class is made. */
export function SchoolStartStudentsScreen() {
  return <TeacherStart step="students" />;
}

function TeacherStart({ step }: { step: StartStep }) {
  const start = useStart();
  if (start.loading) return <LoadingScreen overlay />;
  return step === "students" ? (
    <StudentsStep start={start} />
  ) : (
    <ClassStep start={start} />
  );
}

type Start = ReturnType<typeof useStart>;
const steps = START_STEPS;
const index = (id: StartStep) => steps.findIndex((step) => step.id === id);

/** Step one: the school (a teacher's own, or a new one), the class and its
 * course. Nothing is saved until the class is made. */
function ClassStep({ start }: { start: Start }) {
  const { draft, schools, school, course, classReady, edit } = start;
  const navigate = useNavigate();
  const demo = useStartDemo(start.session);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"schoolName" | "className", string>>
  >({});
  useLoggedError(error);
  useLoggedError(Object.values(fieldErrors).filter(Boolean).join(" "));
  const formId = useId();
  const next = () => {
    const errors: typeof fieldErrors = {};
    if (!school && !fieldOk("schoolName", draft.schoolName))
      errors.schoolName = "Use letters, numbers and spaces.";
    if (!fieldOk("className", draft.className))
      errors.className = "Use letters, numbers and spaces.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    void navigate({ to: startStepUrl("students") as never });
  };
  return (
    <>
      <StepFrame
        steps={steps}
        index={index("")}
        title="Set up your class"
        href={startStepUrl}
        hint={
          classReady
            ? ""
            : school
              ? "Name your class to go on."
              : "Name your school and class to go on."
        }
        next={
          <>
            {!schools.length && (
              <Button
                type="button"
                variant="quiet"
                aria-busy={demo.isPending}
                disabled={demo.isPending}
                onClick={() =>
                  demo.mutate("class", {
                    onSuccess: (path) => void navigate({ href: `/${path}` }),
                    onError: (failure) => {
                      console.error("The demo class didn’t open", failure);
                      setError(failure.message);
                    },
                  })
                }
              >
                Explore a demo first
              </Button>
            )}
            <Button
              type="submit"
              form={formId}
              variant="primary"
              data-primary
              disabled={!classReady}
            >
              Next
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className={styles.fields}
          onSubmit={(event) => {
            event.preventDefault();
            next();
          }}
        >
          {schools.length > 0 && (
            <div className={styles.field}>
              <span className={styles.label} aria-hidden="true">
                School
              </span>
              <Select
                aria-label="School"
                value={school?.id ?? NEW_SCHOOL}
                onValueChange={(value) =>
                  // Another school has its own agreement: tick it again.
                  edit({ school: value, authorized: false, signerName: null })
                }
              >
                {schools.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
                <option value={NEW_SCHOOL}>A new school</option>
              </Select>
            </div>
          )}
          {!school && (
            <TextField
              label="School name"
              value={draft.schoolName}
              onChange={(event) => edit({ schoolName: event.target.value })}
              maxLength={200}
              autoComplete="organization"
              error={fieldErrors.schoolName}
            />
          )}
          <TextField
            label="Class name"
            value={draft.className}
            onChange={(event) => edit({ className: event.target.value })}
            maxLength={100}
            placeholder="Grade 3 Math"
            error={fieldErrors.className}
          />
          {/* Where its students begin: a grade 4 class starts at grade 4,
              never at the bottom of the curriculum (R14). */}
          <div className={styles.field}>
            <span className={styles.label} aria-hidden="true">
              Course
            </span>
            <Select
              aria-label="Course"
              value={course}
              onValueChange={(value) => edit({ course: value })}
            >
              {COURSE_OPTIONS.map(([option, label]) => (
                <option key={option} value={option}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </StepFrame>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

/** Step two: the students' names (optional: they can come later, from a
 * file or Clever), the signer, and the agreement's one tick. Then the class
 * is made, with its students. */
function StudentsStep({ start }: { start: Start }) {
  const { session, draft, schools, school, course, classReady, edit } = start;
  const navigate = useNavigate();
  const prior = useQuery({
    ...classAuthorizationOptions(session, school?.id ?? ""),
    enabled: !!school,
  });
  // An agreement this school accepted at the current version already
  // authorizes its classes: no second tick, unless the signer changes.
  const reused =
    prior.data?.authorization?.version === AGREEMENT_VERSION
      ? prior.data.authorization
      : null;
  const signerName =
    draft.signerName ?? reused?.signerName ?? session.name ?? "";
  const authorized = (!!reused && draft.signerName === null) || draft.authorized;
  const names = parseNames(draft.names);
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"signerName" | "names", string>>
  >({});
  useLoggedError(error);
  useLoggedError(prior.error?.message ?? "");
  useLoggedError(Object.values(fieldErrors).filter(Boolean).join(" "));
  if (school && prior.isPending) return <LoadingScreen overlay />;
  const tooMany = names.length > MAX_NAMES;
  const ready =
    classReady && authorized && !!signerName.trim() && !tooMany && !busy;
  async function create() {
    if (!ready) return;
    const requestId = draft.requestId ?? crypto.randomUUID();
    if (!draft.requestId) edit({ requestId });
    const parsed = startSchoolClassSchema.safeParse({
      requestId,
      schoolName: school?.name ?? draft.schoolName,
      ...(school ? { orgId: school.id } : {}),
      // Only an explicit "A new school" makes a second school.
      newSchool: !school && schools.length > 0,
      className: draft.className,
      timezone: deviceTimeZone(),
      signerName,
      agreementVersion: AGREEMENT_VERSION,
      authorized,
      names,
      ...(course ? { courseBands: [course] } : {}),
    });
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "signerName")
          errors.signerName = "Use letters, numbers and spaces.";
        else if (field === "names")
          errors.names = `Line ${Number(issue.path[1] ?? 0) + 1}: a name of up to 100 letters.`;
      }
      if (!Object.keys(errors).length)
        setError("The class didn’t save. Check its name, then try again.");
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const created = await pilotApi.start(session, parsed.data);
      await refreshSchool(session);
      start.clear();
      // With its students, the class opens on Today; without, on its
      // Students, whose first action adds them (a file, Clever, a paste).
      await navigate({
        to: names.length
          ? "/school/$org/classes/$class/today"
          : "/school/$org/classes/$class/roster",
        params: { org: created.orgId, class: created.classId },
      });
    } catch (failure) {
      console.error("The class didn’t save", failure);
      setError(
        failure instanceof AppError
          ? failure.message
          : "The class didn’t save. Check your connection and try again.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <StepFrame
        steps={steps}
        index={index("students")}
        title="Your students"
        lede={
          classReady
            ? `${draft.className.trim()}${school ? ` at ${school.name}` : draft.schoolName.trim() ? ` at ${draft.schoolName.trim()}` : ""}`
            : undefined
        }
        href={startStepUrl}
        hint={
          !classReady
            ? ""
            : tooMany
              ? `Up to ${MAX_NAMES} students here; add the rest from the class.`
              : !signerName.trim()
                ? "Add your name to accept the student data agreement."
                : !authorized
                ? "Accept the student data agreement to create the class."
                : ""
        }
        next={
          classReady ? (
            <Button
              type="submit"
              form={formId}
              variant="primary"
              data-primary
              aria-busy={busy}
              disabled={!ready}
            >
              {names.length
                ? `Create class with ${names.length} ${names.length === 1 ? "student" : "students"}`
                : "Create class"}
            </Button>
          ) : (
            // Opened without a class named (a new tab): the step that names it.
            <Link to={startStepUrl("") as never} className={buttonClass("primary")}>
              Name your class
            </Link>
          )
        }
      >
        <form
          id={formId}
          className={styles.fields}
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <TextArea
            label="Student names"
            value={draft.names}
            onChange={(event) => edit({ names: event.target.value })}
            maxLength={20_000}
            rows={6}
            hint="One per line, or paste a column from a spreadsheet. You can add students later, from a file or Clever."
            disabled={busy}
          />
          <p className={styles.error} aria-live="polite">
            {fieldErrors.names ?? ""}
          </p>
          <Authorization
            key={school?.id ?? NEW_SCHOOL}
            acceptedAt={reused?.acceptedAt}
            name={signerName}
            authorized={authorized}
            // Changing who signs asks for the agreement again.
            onName={(value) =>
              edit({
                signerName: value,
                ...(reused && draft.signerName === null
                  ? { authorized: false }
                  : {}),
              })
            }
            onAuthorized={(value) => edit({ authorized: value })}
            errors={{ name: fieldErrors.signerName }}
            disabled={busy}
          />
        </form>
      </StepFrame>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

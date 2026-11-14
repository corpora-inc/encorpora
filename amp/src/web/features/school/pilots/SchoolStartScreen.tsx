import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { appReturn } from "../../spaces/returns";
import { useState } from "react";
import { create } from "zustand";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { startSchoolClassSchema } from "../../../../schools/pilot-contracts";
import { AppError } from "../../../lib/AppError";
import { meOptions } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { Select } from "../../../ui/Select";
import { TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { VerifyEmailStep } from "../../onboarding/VerifyEmailStep";
import { deviceTimeZone, useStartDemo } from "../../onboarding/starter-api";
import { currentSession, orgsOptions, refreshSchool } from "../api";
import { Actions, Aside, PlainPage, plainStyles } from "../PlainPage";
import { Authorization } from "./Authorization";
import { classAuthorizationOptions, pilotApi } from "./api";
import { COURSE_OPTIONS, courseFromName } from "../courses";

const NEW = "new";
type Draft = {
  owner: string | null;
  originOrg: string | null;
  school: string | null;
  schoolName: string;
  className: string;
  signerName: string;
  signerTitle: string;
  signerChanged: boolean;
  authorized: boolean;
  /** The course the teacher chose; null follows the class's name. */
  course: string | null;
};
const blank: Omit<Draft, "owner"> = {
  originOrg: null,
  school: null,
  schoolName: "",
  className: "",
  signerName: "",
  signerTitle: "Teacher",
  signerChanged: false,
  authorized: false,
  course: null,
};
/** What's typed survives a trip to the agreement or the demo and back. */
const useDraft = create<
  Draft & { set: (owner: string, value: Partial<Draft>) => void }
>((set) => ({
  owner: null,
  ...blank,
  set: (owner, value) =>
    set((state) =>
      state.owner === owner ? value : { owner, ...blank, ...value },
    ),
}));
function requestId(accountId: string) {
  const key = `amp.school-start.${accountId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (
      saved &&
      startSchoolClassSchema.shape.requestId.safeParse(saved).success
    )
      return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch (failure) {
    console.warn(
      "Class setup couldn’t keep its request on this device",
      failure,
    );
    return crypto.randomUUID();
  }
}

/** `/school/start`: a teacher's class, in one short form. A teacher who
 * already has a school adds the class to it; the agreement is one tick. */
export function SchoolStartScreen() {
  const session = currentSession();
  const account = useQuery(meOptions(session));
  const orgs = useQuery(orgsOptions(session));
  const search = useSearch({ strict: false }) as {
    org?: string;
    from?: string;
  };
  // Adding a place from somewhere: Cancel goes back there.
  const from = appReturn(search.from);
  const schools = (orgs.data ?? []).filter(
    (org) => org.kind === "school" && !org.demo,
  );
  const navigate = useNavigate();
  const demo = useStartDemo(session);
  const draft = useDraft();
  const mine =
    draft.owner === session.accountId &&
    draft.originOrg === (search.org ?? null);
  const chosen = mine ? draft.school : null;
  const school =
    chosen === NEW
      ? null
      : (schools.find((org) => org.id === (chosen ?? search.org)) ??
        (chosen === null ? schools[0] : undefined) ??
        null);
  const prior = useQuery({
    ...classAuthorizationOptions(session, school?.id ?? ""),
    enabled: !!school,
  });
  const reused =
    prior.data?.authorization?.version === AGREEMENT_VERSION
      ? prior.data.authorization
      : null;
  const value = {
    schoolName: mine ? draft.schoolName : "",
    className: mine ? draft.className : "",
    signerName:
      mine && draft.signerChanged
        ? draft.signerName
        : (reused?.signerName ??
          (mine ? draft.signerName : (session.name ?? ""))),
    signerTitle:
      mine && draft.signerChanged
        ? draft.signerTitle
        : (reused?.signerTitle ?? (mine ? draft.signerTitle : "Teacher")),
    // An agreement this school accepted at the current version already
    // authorizes its classes: no second tick, unless the signer changes.
    authorized:
      (!!reused && !(mine && draft.signerChanged)) ||
      (mine && draft.authorized),
    signerChanged: mine && draft.signerChanged,
    course: mine ? draft.course : null,
  };
  // The class's course, suggested by its name until the teacher picks one.
  const course = value.course ?? courseFromName(value.className) ?? "";
  const edit = (change: Partial<Draft>) =>
    draft.set(session.accountId, {
      ...value,
      originOrg: search.org ?? null,
      school: mine ? draft.school : null,
      ...change,
    });
  const [id] = useState(() => requestId(session.accountId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<"schoolName" | "className" | "signerName" | "signerTitle", string>
    >
  >({});
  useLoggedError(error);
  useLoggedError(prior.error?.message ?? "");
  useLoggedError(Object.values(fieldErrors).filter(Boolean).join(" "));
  if (account.isPending || orgs.isPending || (school && prior.isPending))
    return <LoadingScreen overlay />;
  if (account.data?.signedIn && account.data.account.confirmationRequired)
    return (
      <PlainPage back={from ?? "/start"} backLabel={from ? "Cancel" : "Back"}>
        <VerifyEmailStep
          session={session}
          me={account.data}
          embedded
          headingLevel={1}
          // The email's link comes back to this setup, with its way back.
          continueTo={
            from
              ? `/school/start?from=${encodeURIComponent(from)}`
              : "/school/start"
          }
        />
      </PlainPage>
    );
  async function submit() {
    if (busy) return;
    const parsed = startSchoolClassSchema.safeParse({
      requestId: id,
      schoolName: school?.name ?? value.schoolName,
      ...(school ? { orgId: school.id } : {}),
      // Only an explicit "A new school" makes a second school.
      newSchool: !school && schools.length > 0,
      className: value.className,
      timezone: deviceTimeZone(),
      signerName: value.signerName,
      signerTitle: value.signerTitle,
      agreementVersion: AGREEMENT_VERSION,
      authorized: value.authorized,
      names: [],
      ...(course ? { courseBands: [course] } : {}),
    });
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "schoolName" ||
          field === "className" ||
          field === "signerName" ||
          field === "signerTitle"
        )
          errors[field] ??= "Use letters, numbers and spaces.";
      }
      if (!Object.keys(errors).length)
        setError("The class didn’t save. Try again.");
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const created = await pilotApi.start(session, parsed.data);
      await refreshSchool(session);
      try {
        sessionStorage.removeItem(`amp.school-start.${session.accountId}`);
      } catch (failure) {
        console.warn("Class setup couldn’t clear its request", failure);
      }
      draft.set(session.accountId, { ...blank, signerName: value.signerName });
      await navigate({
        to: "/school/$org/classes/$class/roster",
        params: { org: created.orgId, class: created.classId },
      });
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The class didn’t save. Try again.",
      );
      setBusy(false);
    }
  }
  const ready =
    value.authorized &&
    (!!school || !!value.schoolName.trim()) &&
    !!value.className.trim() &&
    !!value.signerName.trim() &&
    !!value.signerTitle.trim();
  return (
    <PlainPage
      title="Set up your class"
      back={from ?? (schools.length ? "/school" : "/start")}
      backLabel={from ? "Cancel" : "Back"}
    >
      <form
        className={plainStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {schools.length > 0 && (
          <div className={plainStyles.field}>
            <span className={plainStyles.label} aria-hidden="true">
              School
            </span>
            <Select
              aria-label="School"
              value={school?.id ?? NEW}
              onValueChange={(next) =>
                edit({
                  school: next,
                  authorized: false,
                  signerName: "",
                  signerTitle: "Teacher",
                  signerChanged: false,
                })
              }
              disabled={busy}
            >
              {schools.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
              <option value={NEW}>A new school</option>
            </Select>
          </div>
        )}
        {!school && (
          <TextField
            label="School name"
            value={value.schoolName}
            onChange={(event) => edit({ schoolName: event.target.value })}
            maxLength={200}
            autoComplete="organization"
            error={fieldErrors.schoolName}
            disabled={busy}
          />
        )}
        <TextField
          label="Class name"
          value={value.className}
          onChange={(event) => edit({ className: event.target.value })}
          maxLength={100}
          placeholder="Grade 3 Math"
          error={fieldErrors.className}
          disabled={busy}
        />
        {/* Where its students begin: a grade 4 class starts at grade 4,
            never at the bottom of the curriculum (R14). */}
        <div className={plainStyles.field}>
          <span className={plainStyles.label} aria-hidden="true">
            Course
          </span>
          <Select
            aria-label="Course"
            value={course}
            onValueChange={(next) => edit({ course: next })}
            disabled={busy}
          >
            {COURSE_OPTIONS.map(([option, label]) => (
              <option key={option} value={option}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Authorization
          key={school?.id ?? NEW}
          acceptedAt={reused?.acceptedAt}
          name={value.signerName}
          title={value.signerTitle}
          authorized={value.authorized}
          // Changing who signs asks for the agreement again.
          onName={(signerName) =>
            edit({
              signerName,
              signerChanged: true,
              ...(reused && !value.signerChanged ? { authorized: false } : {}),
            })
          }
          onTitle={(signerTitle) =>
            edit({
              signerTitle,
              signerChanged: true,
              ...(reused && !value.signerChanged ? { authorized: false } : {}),
            })
          }
          onAuthorized={(authorized) => edit({ authorized })}
          errors={{
            name: fieldErrors.signerName,
            title: fieldErrors.signerTitle,
          }}
          disabled={busy}
        />
        <Actions>
          <Button
            type="submit"
            variant="primary"
            data-primary
            aria-busy={busy}
            disabled={busy || !ready}
          >
            Create class
          </Button>
        </Actions>
      </form>
      {!schools.length && (
        <Aside>
          <Button
            variant="quiet"
            align="start"
            aria-busy={demo.isPending}
            disabled={demo.isPending}
            onClick={() =>
              demo.mutate("class", {
                onSuccess: (path) => void navigate({ href: `/${path}` }),
                onError: (failure) => setError(failure.message),
              })
            }
          >
            Explore a demo first
          </Button>
        </Aside>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </PlainPage>
  );
}

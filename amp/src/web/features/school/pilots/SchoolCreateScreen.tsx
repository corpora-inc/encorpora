import { reportError } from "../../../lib/report-error";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { startSchoolSchema } from "../../../../schools/pilot-contracts";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { deviceTimeZone, useStartDemo } from "../../onboarding/starter-api";
import { currentSession, refreshSchool } from "../api";
import { Actions, Aside, PlainPage, plainStyles } from "../PlainPage";
import { Authorization } from "./Authorization";
import { pilotApi } from "./api";
import { Form } from "../../../ui/Form";

/** One request per visit, kept on this device, so a retry or a reload
 * never makes a second school. */
function requestId(accountId: string) {
  const key = `amp.school-create.${accountId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && startSchoolSchema.shape.requestId.safeParse(saved).success)
      return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch (failure) {
    console.warn(
      "School setup couldn’t keep its request on this device",
      failure,
    );
    return crypto.randomUUID();
  }
}

/** `/school/start/school`: "I run a school", in one short form. The school,
 * the leader's name from the account, and one tick for the school's student
 * data agreement. No license, contract or call first: classes, teachers and
 * students come next, and each class's 30-day pilot starts as it is made.
 * The demo stays one quiet link away, never a step. */
export function SchoolCreateScreen() {
  const session = currentSession();
  const navigate = useNavigate();
  const demo = useStartDemo(session);
  const [id] = useState(() => requestId(session.accountId));
  const [schoolName, setSchoolName] = useState("");
  const [name, setName] = useState(session.name ?? "");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"schoolName" | "signerName", string>>
  >({});
  useLoggedError(error);
  useLoggedError(Object.values(fieldErrors).filter(Boolean).join(" "));
  const ready = authorized && !!schoolName.trim() && !!name.trim();
  async function submit() {
    if (busy) return;
    const parsed = startSchoolSchema.safeParse({
      requestId: id,
      schoolName,
      timezone: deviceTimeZone(),
      signerName: name,
      agreementVersion: AGREEMENT_VERSION,
      authorized,
    });
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "schoolName" || field === "signerName")
          errors[field] ??= "Use letters, numbers and spaces.";
      }
      if (!Object.keys(errors).length)
        setError("The school didn’t save. Try again.");
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const created = await pilotApi.startSchool(session, parsed.data);
      await refreshSchool(session);
      try {
        sessionStorage.removeItem(`amp.school-create.${session.accountId}`);
      } catch (failure) {
        console.warn("School setup couldn’t clear its request", failure);
      }
      // Its classes next: Add class is that page's first step.
      await navigate({
        to: `/school/${created.orgId}/classes` as never,
      });
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "save the school",
          fallback: "The school didn’t save. Try again.",
        }),
      );
      setBusy(false);
    }
  }
  return (
    <PlainPage title="Set up your school">
      <Form
        className={plainStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="School name"
          value={schoolName}
          onChange={(event) => setSchoolName(event.target.value)}
          maxLength={200}
          autoComplete="organization"
          error={fieldErrors.schoolName}
          disabled={busy}
        />
        <Authorization
          name={name}
          authorized={authorized}
          onName={setName}
          onAuthorized={setAuthorized}
          errors={{ name: fieldErrors.signerName }}
          disabled={busy}
          scope="school"
        />
        <Actions>
          <Button
            type="submit"
            variant="primary"
            data-primary
            aria-busy={busy}
            disabled={busy || !ready}
          >
            Create school
          </Button>
        </Actions>
      </Form>
      <Aside>
        <Button
          variant="quiet"
          align="start"
          aria-busy={demo.isPending}
          disabled={demo.isPending}
          onClick={() =>
            demo.mutate("school", {
              onSuccess: (path) => void navigate({ href: `/${path}` }),
              onError: (failure) => setError(failure.message),
            })
          }
        >
          Explore a demo school first
        </Button>
      </Aside>
      <Toast message={error} onDismiss={() => setError("")} />
    </PlainPage>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { create } from "zustand";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { startSchoolClassSchema } from "../../../../schools/pilot-contracts";
import { AppError } from "../../../lib/AppError";
import { meOptions } from "../../../lib/query";
import { Button, buttonClass } from "../../../ui/Button";
import { TextArea, TextField } from "../../../ui/TextField";
import { Loading } from "../../../ui/Loading";
import { VerifyEmailStep } from "../../onboarding/VerifyEmailStep";
import { deviceTimeZone, useStartDemo } from "../../onboarding/starter-api";
import { currentSession, orgsOptions, refreshSchool } from "../api";
import { GradePicker } from "../parts";
import { Authorization } from "./Authorization";
import { pilotApi } from "./api";
import styles from "./Pilot.module.css";

const useDraft = create<{
  owner: string | null;
  schoolName: string;
  className: string;
  signerName: string;
  signerTitle: string;
  names: string;
  grade: number | null;
  authorized: boolean;
  set: (owner: string, value: Record<string, unknown>) => void;
}>((set) => ({
  owner: null,
  schoolName: "",
  className: "",
  signerName: "",
  signerTitle: "Teacher",
  names: "",
  grade: null,
  authorized: false,
  set: (owner, value) =>
    set((state) =>
      state.owner === owner
        ? value
        : {
            owner,
            schoolName: "",
            className: "",
            signerName: "",
            signerTitle: "Teacher",
            names: "",
            grade: null,
            authorized: false,
            ...value,
          },
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
  } catch {
    return crypto.randomUUID();
  }
}

/** A teacher authorizes their class, then adds students or imports a roster. */
export function SchoolStartScreen() {
  const session = currentSession();
  const account = useQuery(meOptions(session));
  const orgs = useQuery(orgsOptions(session));
  const search = useSearch({ strict: false }) as { org?: string };
  const existing = orgs.data?.find(
    (org) => org.id === search.org && !org.demo && org.kind === "school",
  );
  const navigate = useNavigate();
  const demo = useStartDemo(session);
  const draft = useDraft();
  const mine = draft.owner === session.accountId;
  const value = {
    schoolName: existing?.name ?? (mine ? draft.schoolName : ""),
    className: mine ? draft.className : "",
    signerName: mine ? draft.signerName : (session.name ?? ""),
    signerTitle: mine ? draft.signerTitle : "Teacher",
    names: mine ? draft.names : "",
    grade: mine ? draft.grade : null,
    authorized: mine && draft.authorized,
  };
  const edit = (change: Record<string, unknown>) =>
    draft.set(session.accountId, { ...value, ...change });
  const [id] = useState(() => requestId(session.accountId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (account.isPending)
    return (
      <main className={styles.page}>
        <Loading>Opening classroom setup</Loading>
      </main>
    );
  if (account.data?.signedIn && account.data.account.confirmationRequired)
    return (
      <main className={styles.page}>
        <VerifyEmailStep session={session} me={account.data} embedded />
      </main>
    );
  async function submit() {
    if (busy) return;
    const names = value.names
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    const parsed = startSchoolClassSchema.safeParse({
      requestId: id,
      schoolName: value.schoolName,
      ...(existing ? { orgId: existing.id } : {}),
      className: value.className,
      timezone: deviceTimeZone(),
      signerName: value.signerName,
      signerTitle: value.signerTitle,
      agreementVersion: AGREEMENT_VERSION,
      authorized: value.authorized,
      names,
      ...(value.grade !== null ? { gradeLevel: value.grade } : {}),
    });
    if (!parsed.success) {
      setError(
        "Enter your school, class and name, and confirm your authorization. Use one student name per line, up to 500 names.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await pilotApi.start(session, parsed.data);
      await refreshSchool(session);
      try {
        sessionStorage.removeItem(`amp.school-start.${session.accountId}`);
      } catch {
        /* Storage is optional. */
      }
      draft.set(session.accountId, {
        names: "",
        authorized: false,
        className: "",
      });
      await navigate({
        to: "/$",
        params: {
          _splat: `school/${created.orgId}/classes/${created.classId}/roster`,
        },
      });
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The class didn’t save. Try again; the same request creates it only once.",
      );
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <header>
        <h1>Set up your class</h1>
        <p className={styles.lead}>
          Bring your roster, then choose when to start practice.
        </p>
      </header>
      <div className={styles.actions}>
        <Link
          to="/$"
          params={{ _splat: "school/connect" }}
          className={buttonClass("secondary")}
        >
          Use Clever
        </Link>
        <Button
          variant="quiet"
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
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className={styles.pair}>
          <TextField
            label="School name"
            value={value.schoolName}
            onChange={(event) => edit({ schoolName: event.target.value })}
            maxLength={200}
            autoComplete="organization"
            required
            disabled={busy || !!existing}
          />
          <TextField
            label="Class name"
            value={value.className}
            onChange={(event) => edit({ className: event.target.value })}
            maxLength={100}
            placeholder="Grade 3 Math"
            required
            disabled={busy}
          />
        </div>
        <Authorization
          name={value.signerName}
          title={value.signerTitle}
          authorized={value.authorized}
          onName={(signerName) => edit({ signerName })}
          onTitle={(signerTitle) => edit({ signerTitle })}
          onAuthorized={(authorized) => edit({ authorized })}
          disabled={busy}
        />
        <details>
          <summary>Add student names now (optional)</summary>
          <div className={styles.form}>
            <p className={styles.lead}>
              One name per line. You can also import Excel, CSV or OneRoster
              after creating the class.
            </p>
            <TextArea
              label="Student names"
              value={value.names}
              onChange={(event) => edit({ names: event.target.value })}
              maxLength={50_000}
              rows={6}
              disabled={busy}
            />
            <GradePicker
              label="Starting grade"
              value={value.grade}
              onChange={(grade) => edit({ grade })}
            />
          </div>
        </details>
        <p className={styles.error} role={error ? "alert" : undefined}>
          {error}
        </p>
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            aria-busy={busy}
            disabled={
              busy ||
              !value.authorized ||
              !value.schoolName.trim() ||
              !value.className.trim() ||
              !value.signerName.trim() ||
              !value.signerTitle.trim()
            }
          >
            Create class
          </Button>
          <Link
            to="/$"
            params={{ _splat: "school" }}
            className={buttonClass("quiet")}
          >
            Your classes
          </Link>
        </div>
      </form>
    </main>
  );
}

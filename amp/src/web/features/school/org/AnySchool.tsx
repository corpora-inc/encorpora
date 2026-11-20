import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { formatDay } from "../../../../schools/calendar";
import type { IntegrationsResponse } from "../../../../schools/org-contracts";
import { reportError } from "../../../lib/report-error";
import { Button, buttonClass } from "../../../ui/Button";
import { Form } from "../../../ui/Form";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { currentSession, refreshSchool } from "../api";
import { FormNote } from "../parts";
import { adoptPath } from "../paths";
import { Authorization } from "../pilots/Authorization";
import school from "../School.module.css";
import { requestAnySchool } from "./org-api";

type State = NonNullable<IntegrationsResponse["anyschool"]>;
const day = (iso: string | null) => (iso ? formatDay(iso.slice(0, 10)) : "");

/** Where a school not on Clever stands with Clever AnySchool, in one line. */
export function anySchoolDetail(state: State) {
  switch (state.status) {
    case "none":
      return "For a school not on Clever: Clever keeps your roster from a spreadsheet or your student system, and AMP syncs it.";
    case "requested":
      return `Requested ${day(state.requestedAt)}. Clever’s invitation goes to ${state.setupEmail}.`;
    case "invited":
      return `Clever’s invitation went to ${state.setupEmail} on ${day(state.invitedAt)}. Its link works for that address, for 48 hours once opened.`;
    case "connected":
      return state.imported
        ? "Connected. Your roster comes from Clever."
        : "Clever is connected. Move your classes in, and we start the import.";
  }
}

/** The one action for the row: ask, or move classes in once connected. */
export function AnySchoolAction({
  orgId,
  state,
  canManage,
  onDone,
}: {
  orgId: string;
  state: State;
  canManage: boolean;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (state.status === "connected" && !state.imported && state.districtOrgId)
    return (
      <Link
        to="/$"
        params={{ _splat: adoptPath(state.districtOrgId) }}
        className={buttonClass("secondary")}
      >
        Move classes in
      </Link>
    );
  if (state.status !== "none" || !canManage) return null;
  return (
    <>
      <Button
        variant="secondary"
        aria-label="Set up Clever AnySchool with us"
        onClick={() => setOpen(true)}
      >
        Set this up with us
      </Button>
      {open && (
        <AnySchoolRequest
          orgId={orgId}
          onClose={() => setOpen(false)}
          onDone={(message) => {
            setOpen(false);
            onDone(message);
          }}
        />
      )}
    </>
  );
}

function AnySchoolRequest({
  orgId,
  onClose,
  onDone,
}: {
  orgId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const session = currentSession();
  const [email, setEmail] = useState(""),
    [name, setName] = useState(session.name ?? ""),
    [authorized, setAuthorized] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await requestAnySchool(session, orgId, {
        setupEmail: email.trim(),
        signerName: name.trim(),
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
      });
      await refreshSchool(session);
      onDone(`Requested. Clever’s invitation goes to ${email.trim()}.`);
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "request Clever AnySchool",
          fallback: "The request didn’t send. Email support@corpora.inc.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Clever AnySchool"
      lead="Clever emails its setup link to the person who will upload your roster or connect your student system."
    >
      <Form
        className={school.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Setup email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Authorization
          name={name}
          authorized={authorized}
          onName={setName}
          onAuthorized={setAuthorized}
          disabled={busy}
          scope="school"
        />
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          className={school.sheetAction}
          aria-busy={busy}
          disabled={busy || !authorized || !name.trim() || !email.trim()}
        >
          Request invitation
        </Button>
      </Form>
    </Sheet>
  );
}

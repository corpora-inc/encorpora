import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { invalidateAccount } from "../../lib/query";
import { Button } from "../../ui/Button";
import { Disclosure } from "../../ui/Disclosure";
import { Loading } from "../../ui/Loading";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import pages from "../account/AccountPages.module.css";
import {
  canWithdraw,
  ConsentNotice,
  ConsentSummary,
  DeletionTerms,
} from "../privacy/LearningData";
import {
  canRequestConsent,
  consentOptions,
  requestConsent,
  withdrawConsent,
} from "../privacy/consent-api";
import type { FamilyChild } from "./api";
import { familyHref, type FamilyPlace } from "./FamilyFrame";

const ok = z.unknown();

function failed(failure: unknown, fallback: string) {
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
}

/** What a consent request's refusal means, for the parent. */
function consentProblem(failure: unknown) {
  const code = failure instanceof AppError ? failure.code : null;
  return code === "consent_request_limit"
    ? "That’s three requests today. Use the email we already sent, or try again tomorrow."
    : code === "notice_changed"
      ? "The privacy details just changed. Close this, open it again and read them."
      : code === "consent_already_active"
        ? "Consent is already given."
        : failed(failure, "The consent email wasn’t sent. Try again.");
}

/**
 * Consent, over the child's settings, handled in place (no address of its
 * own: closing it is the same screen, where it was). The family's consent
 * covers every child under 13, so it is the family's.
 *
 * Not given: the notice in place (Privacy details) and one action that
 * gives it. COPPA's email-plus method (16 CFR 312.5(b)(2)(vi)) takes the
 * parent's yes by email: the action sends the direct notice (312.4(c)) to
 * the address shown, and its link records consent; the delayed confirmatory
 * message follows by itself. No checkbox, no second step here, and nothing
 * for a child 13 or older (312.2), who never needs it.
 * Given: its date, and withdrawing (312.6(a)(2)), which pauses new learning.
 */
export function ConsentSheet({
  place,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = place;
  const family = place.me?.family;
  const status = family?.consent.status;
  const state = useQuery({ ...consentOptions(session), enabled: open }).data;
  const [email, setEmail] = useState(place.me?.account.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One request per address and notice: a retry is the same request.
  const sent = useRef<{ key: string; id: string } | null>(null);
  const give = async () => {
    if (!state?.noticeDigest) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      return setError("Enter your email address.");
    const key = `${address}\n${state.noticeDigest}`;
    if (sent.current?.key !== key)
      sent.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await requestConsent(session, {
        email: address,
        noticeDigest: state.noticeDigest,
        requestId: sent.current.id,
      });
    } catch (failure) {
      console.error("The consent email wasn’t sent", failure);
      setError(consentProblem(failure));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    setBusy(true);
    setError("");
    try {
      await withdrawConsent(session);
    } catch (failure) {
      console.error("Consent wasn’t withdrawn", failure);
      setError(failed(failure, "Consent wasn’t withdrawn. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const recorded = !!status && canWithdraw(status);
  const pending =
    !recorded && state?.request?.phase === "awaiting-initial"
      ? state.request
      : null;
  const ask = !recorded && !pending && !!state && canRequestConsent(state);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setError("");
        onOpenChange(next);
      }}
      title="Consent"
    >
      <div className={pages.section} data-consent-sheet="">
        {status && (recorded || status === "withdrawn") && (
          <ConsentSummary
            status={status}
            recordedAt={family?.consent.recordedAt}
            withdrawnAt={family?.consent.withdrawnAt}
          />
        )}
        {recorded && (
          <div className={pages.footActions}>
            <Button
              variant="secondary"
              className={pages.danger}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void withdraw()}
              data-consent-withdraw=""
            >
              Withdraw consent
            </Button>
          </div>
        )}
        {pending && (
          <p className={pages.prose} data-consent-pending="">
            {pending.delivery === "rejected" ||
            pending.delivery === "stopped-unknown"
              ? "The consent email didn’t reach you. Withdraw this request, check the address and send it again."
              : "We emailed you the privacy details. Open its link while signed in here to give consent; learning starts as soon as you do."}
          </p>
        )}
        {pending &&
          (pending.delivery === "rejected" ||
            pending.delivery === "stopped-unknown") && (
            <div className={pages.footActions}>
              <Button
                variant="secondary"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void withdraw()}
              >
                Withdraw this request
              </Button>
            </div>
          )}
        {ask && state.notice && (
          <>
            <p className={pages.prose}>
              Your kids under 13 save answers with your consent as their parent
              or guardian.
            </p>
            <Disclosure summary="Privacy details">
              <div className={pages.prose}>
                <ConsentNotice notice={state.notice} />
              </div>
            </Disclosure>
            <TextField
              label="Your email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              error={error}
              disabled={busy}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />
            <div className={pages.footActions}>
              <Button
                variant="primary"
                disabled={busy || !state.noticeDigest}
                aria-busy={busy || undefined}
                onClick={() => void give()}
                data-consent-give=""
              >
                Give consent
              </Button>
            </div>
            <p className={pages.quietLine}>
              I’m their parent or guardian and agree to what the privacy details
              describe. We email them to you; open the link to finish.
            </p>
          </>
        )}
        {state && !state.available && !recorded && !pending && (
          <p className={pages.prose}>
            Consent can’t be given here right now. Try again later.
          </p>
        )}
        {!status || (!recorded && !pending && !ask && !state) ? (
          <Loading>Reading your consent</Loading>
        ) : null}
        {error && !ask && (
          <p role="alert" className={pages.prose}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Delete one child's learning data, over their settings: what it removes
 * and keeps (the account's own words, privacy/LearningData), then the one
 * action. Once deleted, the child's page is gone, so the family's Today
 * replaces it.
 */
export function DeleteDataSheet({
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
  const { session, family } = place;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await request(
        `/family/learners/${encodeURIComponent(child.id)}/delete-learning-data`,
        ok,
        {
          token: session.token,
          body: { confirmation: "delete-learning-data" },
        },
      );
      await navigate({
        to: "/$",
        params: { _splat: familyHref(family) },
        replace: true,
      });
      await invalidateAccount(session.accountId);
    } catch (failure) {
      console.error(`${child.name}’s learning data wasn’t deleted`, failure);
      setError(failed(failure, "Nothing was deleted. Try again."));
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setError("");
        onOpenChange(next);
      }}
      title={`Delete ${child.name}’s learning data`}
    >
      <div className={pages.section} data-delete-sheet="">
        <DeletionTerms learner className={pages.prose} />
        <div className={pages.footActions}>
          <Button
            variant="secondary"
            className={pages.danger}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void remove()}
          >
            Delete learning data
          </Button>
        </div>
        {error && (
          <p role="alert" className={pages.prose}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppError } from "../../lib/AppError";
import { meOptions } from "../../lib/query";
import { reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { Disclosure } from "../../ui/Disclosure";
import { Loading } from "../../ui/Loading";
import { TextField } from "../../ui/TextField";
import {
  canRequestConsent,
  consentOptions,
  requestConsent,
  withdrawConsent,
} from "./consent-api";
import { canWithdraw, ConsentNotice, ConsentSummary } from "./LearningData";
import styles from "./Privacy.module.css";

/** What a consent request's refusal means, for the parent. */
function consentProblem(failure: unknown) {
  const code = failure instanceof AppError ? failure.code : null;
  return code === "consent_request_limit"
    ? "That’s three requests today. Use the email we already sent, or try again tomorrow."
    : code === "notice_changed"
      ? "The privacy details just changed. Close this, open it again and read them."
      : code === "consent_already_active"
        ? "Consent is already given."
        : null;
}

/**
 * The family's learning permission, handled in place: the Privacy overlay's
 * panel, and a child's settings show the same. The family's consent covers
 * every child under 13, so it is the family's, and only the account holder
 * gives or withdraws it.
 *
 * Requirements:
 * - Not given: the direct notice in place (16 CFR 312.4(c)) and one action.
 *   COPPA's email-plus method (16 CFR 312.5(b)(2)(vi)) takes the parent's
 *   yes by email: the action sends the notice to the address shown, and its
 *   link records consent; the delayed confirmatory message follows by
 *   itself. No checkbox, no second step, and nothing for a child 13 or
 *   older (16 CFR 312.2, "child"), who never needs it.
 * - Given: its date, and withdrawing, which refuses further use and
 *   collection (16 CFR 312.6(a)(2)) and pauses new learning. Withdrawing is
 *   destructive, so it takes the one confirm the IA's rule allows, inline
 *   (IA v2 §0, "Minimum compliance"): no dialog over the overlay.
 */
export function ConsentPanel() {
  const session = useSession();
  const me = useQuery(meOptions(session)).data;
  const signedIn = me?.signedIn ? me : null;
  const family = signedIn?.family;
  const status = family?.consent.status;
  const state = useQuery(consentOptions(session)).data;
  const [email, setEmail] = useState(signedIn?.account.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
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
      const known = consentProblem(failure);
      const message = reportError(failure, {
        doing: "send the consent email",
        fallback: "The consent email wasn’t sent. Try again.",
      });
      setError(known ?? message);
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    setBusy(true);
    setError("");
    try {
      await withdrawConsent(session);
      setConfirming(false);
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "withdraw consent",
          fallback: "Consent wasn’t withdrawn. Try again.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  const recorded = !!status && canWithdraw(status);
  const pending =
    !recorded && state?.request?.phase === "awaiting-initial"
      ? state.request
      : null;
  const undelivered =
    pending?.delivery === "rejected" || pending?.delivery === "stopped-unknown";
  const ask = !recorded && !pending && !!state && canRequestConsent(state);
  return (
    <div className={styles.panel} data-consent-panel="">
      {status && (recorded || status === "withdrawn") && (
        <ConsentSummary
          status={status}
          recordedAt={family?.consent.recordedAt}
          withdrawnAt={family?.consent.withdrawnAt}
        />
      )}
      {recorded && !confirming && (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.danger}
            disabled={busy}
            onClick={() => setConfirming(true)}
            data-consent-withdraw=""
          >
            Withdraw consent
          </Button>
        </div>
      )}
      {recorded && confirming && (
        <div className={styles.confirm} data-consent-confirm="">
          <p className={styles.prose}>
            Withdraw now? Practice pauses for children under 13 until you give
            consent again.
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              className={styles.danger}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void withdraw()}
              data-consent-withdraw-confirm=""
            >
              Withdraw consent
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep consent
            </Button>
          </div>
        </div>
      )}
      {pending && (
        <p className={styles.prose} data-consent-pending="">
          {undelivered
            ? "The consent email didn’t reach you. Withdraw this request, check the address and send it again."
            : "We emailed you the privacy details. Open its link while signed in here to give consent; learning starts as soon as you do."}
        </p>
      )}
      {pending && undelivered && (
        <div className={styles.actions}>
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
      {state?.notice && (ask || recorded) && (
        <Disclosure summary="Privacy details">
          <div className={styles.notice}>
            <ConsentNotice notice={state.notice} />
          </div>
        </Disclosure>
      )}
      {ask && state.notice && (
        <>
          <p className={styles.prose}>
            Your kids under 13 save answers with your consent as their parent or
            guardian.
          </p>
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
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={busy || !state.noticeDigest}
              aria-busy={busy || undefined}
              onClick={() => void give()}
              data-consent-give=""
            >
              {status === "withdrawn" ? "Give consent again" : "Give consent"}
            </Button>
          </div>
          <p className={styles.quiet}>
            I’m their parent or guardian and agree to what the privacy details
            describe. We email them to you; open the link to finish.
          </p>
        </>
      )}
      {state && !state.available && !recorded && !pending && (
        <p className={styles.prose}>
          Consent can’t be given here right now. Try again later.
        </p>
      )}
      {!status || (!recorded && !pending && !ask && !state) ? (
        <Loading>Reading your consent</Loading>
      ) : null}
      {error && !ask && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

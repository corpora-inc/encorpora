import { useLoggedError, requestMessage } from "./feedback";
import { useLayoutEffect, useRef, useState } from "react";
import type { ConsentView } from "../parent-consent/contracts.js";
import type { ConsentChallenge } from "./consent-link.js";
import "./parent-consent.css";
export function ParentConsentCenter({
  token,
  identity,
  onClose,
  onChanged,
  challenge: initialChallenge = null,
}: {
  token: string;
  identity: string;
  onClose: () => void;
  onChanged?: () => void;
  challenge?: ConsentChallenge | null;
}) {
  const [storedView, setView] = useState<ConsentView | null>(null),
    [viewOwner, setViewOwner] = useState(identity),
    [email, setEmail] = useState(""),
    [attest, setAttest] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState(initialChallenge);
  useLoggedError(error);
  const view = viewOwner === identity ? storedView : null;
  const epoch = useRef(0),
    tokenRef = useRef(token),
    identityRef = useRef(identity),
    pending = useRef(false),
    controller = useRef<AbortController | null>(null),
    heading = useRef<HTMLHeadingElement>(null),
    emailInput = useRef<HTMLInputElement>(null),
    retry = useRef<{ email: string; digest: string; id: string } | null>(null);
  tokenRef.current = token;
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    epoch.current++;
    controller.current?.abort();
    pending.current = false;
  }
  async function load() {
    const current = epoch.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/consent", {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        signal: abort.signal,
      });
      if (!response.ok)
        throw new Error("Consent details are unavailable. Try again.");
      const data = (await response.json()) as ConsentView;
      if (current === epoch.current && !abort.signal.aborted) {
        setView(data);
        if (
          data.request &&
          ["expired", "withdrawn", "replaced", "policy-changed"].includes(
            data.request.phase,
          )
        )
          retry.current = null;
      }
    } catch (e) {
      if (current === epoch.current && !abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Unable to load consent.");
    } finally {
      if (current === epoch.current && !abort.signal.aborted) setBusy(false);
    }
  }
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    if (previousIdentity.current !== identity) {
      setChallenge(null);
      previousIdentity.current = identity;
    }
    setView(null);
    setViewOwner(identity);
    setEmail("");
    setAttest(false);
    setError("");
    retry.current = null;
    void load();
    heading.current?.focus();
    return () => {
      epoch.current++;
      controller.current?.abort();
    };
  }, [identity]);
  async function act(kind: "begin" | "ack" | "withdraw") {
    if (kind === "begin" && !emailInput.current?.reportValidity()) return;
    if (pending.current) return;
    pending.current = true;
    const current = epoch.current;
    setBusy(true);
    setError("");
    try {
      let body: unknown = {},
        path = "/api/v1/family/consent/withdraw";
      if (kind === "begin") {
        if (!view?.noticeDigest)
          throw new Error("Review the current notice first.");
        if (
          !retry.current ||
          retry.current.email !== email ||
          retry.current.digest !== view.noticeDigest
        )
          retry.current = {
            email,
            digest: view.noticeDigest,
            id: crypto.randomUUID(),
          };
        path = "/api/v1/consent/requests";
        body = {
          email,
          requestId: retry.current.id,
          noticeDigest: view.noticeDigest,
          parentAttestation: attest,
        };
      }
      if (kind === "ack") {
        path = "/api/v1/consent/acknowledge";
        body = { ...challenge, parentAttestation: attest };
      }
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(
          data.error === "consent_link_expired"
            ? "This link expired. Request a new notice."
            : data.error === "confirmation_not_ready"
              ? "The confirmation is not ready. Refresh after the delivery completes."
              : data.error === "notice_changed"
                ? "The privacy notice changed. Refresh and review it again."
                : data.error === "consent_link_invalid"
                  ? "This link cannot be used for this account. Sign in to the requesting parent account or request a new notice."
                  : "Your response could not be saved. Refresh and try again.",
        );
      }
      const data =
        kind === "withdraw" ? null : ((await response.json()) as ConsentView);
      if (current !== epoch.current) return;
      setAttest(false);
      setChallenge(null);
      if (kind === "withdraw") {
        retry.current = null;
        onChanged?.();
        await load();
      } else {
        setView(data);
        onChanged?.();
      }
    } catch (e) {
      if (current === epoch.current)
        setError(
          e instanceof Error ? e.message : "Your response could not be saved.",
        );
    } finally {
      if (current === epoch.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  const phase = view?.consentActive ? "active" : view?.request?.phase,
    canStart =
      view?.available &&
      !view.consentActive &&
      (!view.request ||
        ["withdrawn", "expired", "replaced", "policy-changed"].includes(
          phase!,
        )),
    canAck = !!(
      challenge &&
      view?.available &&
      challenge.noticeDigest === view.noticeDigest &&
      challenge.requestId === view.request?.id &&
      view.request?.delivery !== "stopped-unknown" &&
      ((challenge.stage === "initial" && phase === "awaiting-initial") ||
        (challenge.stage === "confirmation" &&
          phase === "awaiting-confirmation"))
    );
  const consumedInitial = !!(
    challenge?.stage === "initial" &&
    challenge.requestId === view?.request?.id &&
    challenge.noticeDigest === view?.noticeDigest &&
    phase === "awaiting-confirmation"
  );
  return (
    <section className="parent-consent-center" aria-label="Parent consent">
      <header>
        <button type="button" onClick={onClose}>
          Back
        </button>
        <h1 ref={heading} tabIndex={-1}>
          Learning consent
        </h1>
      </header>
      <div className="parent-consent-body">
        {error && (
          <div role="alert" className="consent-alert">
            <p>{error}</p>
            <button type="button" disabled={busy} onClick={() => void load()}>
              Refresh details
            </button>
          </div>
        )}
        {!view && !error && <p role="status">Loading privacy details…</p>}
        {view && !view.available && !view.consentActive && (
          <>
            <h2>Enrollment is unavailable</h2>
            <p>
              Consent enrollment is not available here. No new learning consent
              can be recorded. Return to your family settings or check again
              later.
            </p>
          </>
        )}
        {view && (view.available || view.consentActive) && (
          <>
            <h2>
              {canAck
                ? "Review and respond"
                : phase === "active"
                  ? "Consent is active"
                  : canStart
                    ? "Your permission comes first"
                    : phase === "awaiting-confirmation"
                      ? "One more confirmation"
                      : "Your privacy notice"}
            </h2>
            {canStart && (
              <>
                <p>
                  Use your own email. Two responses are required, at least{" "}
                  {view.confirmationDelayHours} hours apart.
                </p>
                <label>
                  Email address
                  <input
                    ref={emailInput}
                    required
                    aria-label="Parent email address"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </>
            )}
            {phase === "awaiting-initial" && !canAck && (
              <p>
                {view.request?.delivery === "accepted"
                  ? "The email provider accepted your notice. Open its link while signed in to this parent account."
                  : view.request?.delivery === "stopped-unknown"
                    ? "We could not confirm delivery. Automatic retries have stopped. Withdraw this request before starting again."
                    : view.request?.delivery === "rejected"
                      ? "Delivery could not be confirmed. Withdraw this request and check the address before starting again."
                      : "Your notice is queued for delivery. Refresh to check its progress."}
              </p>
            )}
            {phase === "awaiting-confirmation" && !canAck && (
              <>
                <p>
                  Your first response is recorded. Learning access has not
                  started.
                </p>
                <p>
                  {view.request?.delivery === "accepted"
                    ? "Open the delayed confirmation email to finish."
                    : view.request?.delivery === "stopped-unknown"
                      ? "We could not confirm delivery. Automatic retries have stopped. Withdraw this request before starting again."
                      : view.request?.delivery === "rejected"
                        ? "Delivery could not be confirmed. Withdraw this request and start again."
                        : `The next notice is scheduled no earlier than ${view.request?.confirmationAfter ? new Date(view.request.confirmationAfter).toLocaleString() : "the confirmation time"}.`}
                </p>
              </>
            )}
            {phase === "active" && (
              <p>
                You can create a learner and use available learning access.
                Consent does not purchase a subscription. Withdrawing consent
                does not cancel paid renewal.
              </p>
            )}
            {consumedInitial && (
              <p>
                Your first response is already recorded. Use the second
                confirmation email when it arrives.
              </p>
            )}
            {challenge && !canAck && !consumedInitial && phase !== "active" && (
              <p>
                This email link does not match an available request for this
                account. Request a new notice if needed.
              </p>
            )}
            {view.notice && (
              <details>
                <summary>Read the complete privacy notice</summary>
                <p>
                  <strong>{view.notice.operator.name}</strong>
                  <br />
                  {view.notice.operator.address}
                  <br />
                  {view.notice.operator.telephone}
                  <br />
                  {view.notice.operator.email}
                </p>
                <p>
                  Notice {view.notice.version}. Your contact address is used to
                  request permission before collecting child information.
                </p>
                <h3>Information and purposes</h3>
                {view.notice.childData.map((d, i) => (
                  <p key={i}>
                    <strong>{d.category}</strong>: {d.purpose}. Retention:{" "}
                    {d.retention}.
                  </p>
                ))}
                <h3>Internal service providers</h3>
                {view.notice.processors.map((d, i) => (
                  <p key={i}>
                    <strong>{d.name}</strong> ({d.service}): {d.data}.{" "}
                    {d.purpose}. Retention: {d.retention}.
                  </p>
                ))}
                <p>
                  This method permits only the reviewed internal-use practices,
                  not other disclosure of children’s personal information.
                </p>
                <p>{view.notice.reviewAndDeletion}</p>
                <p>
                  You may withdraw at any time. Pending contact is deleted after{" "}
                  {view.notice.pendingContactDays} days if consent is not
                  completed. Evidence is kept while consent is active and for{" "}
                  {view.notice.withdrawnEvidenceDays} days after withdrawal:{" "}
                  {view.notice.evidenceRetentionPurpose}
                </p>
                <a
                  href={view.notice.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Full privacy policy
                </a>
              </details>
            )}
            {(canStart || canAck) && (
              <label className="consent-attestation">
                <input
                  type="checkbox"
                  checked={attest}
                  onChange={(e) => setAttest(e.target.checked)}
                />
                <span>
                  I am the parent or legal guardian. I have reviewed this notice
                  and agree to the described collection and use.
                </span>
              </label>
            )}
          </>
        )}{" "}
        {view?.request && phase !== "withdrawn" && (
          <details>
            <summary>Withdraw this consent or request</summary>
            <p>
              Withdrawal stops pending confirmation and future learning access.
              Learning data deletion is available separately in the Privacy
              workspace.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("withdraw")}
            >
              Withdraw consent
            </button>
          </details>
        )}
      </div>
      <footer>
        {view?.consentActive ? (
          <button type="button" onClick={onClose}>
            Continue to family
          </button>
        ) : canStart ? (
          <button
            type="button"
            disabled={busy || !attest || !email.includes("@")}
            onClick={() => void act("begin")}
          >
            {busy ? "Saving…" : "Email my privacy notice"}
          </button>
        ) : view?.request?.delivery === "stopped-unknown" &&
          phase !== "withdrawn" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("withdraw")}
          >
            {busy ? "Withdrawing…" : "Withdraw this request"}
          </button>
        ) : canAck ? (
          <button
            type="button"
            disabled={busy || !attest}
            onClick={() => void act("ack")}
          >
            {busy
              ? "Saving…"
              : challenge?.stage === "initial"
                ? "Record my first response"
                : "Confirm learning consent"}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void load()}>
            {busy ? "Refreshing…" : "Refresh status"}
          </button>
        )}
      </footer>
    </section>
  );
}

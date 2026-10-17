import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  FamilySummary,
  FamilyLearner,
  DeletionReceipt,
} from "../family/contracts.js";
import "./family-center.css";
interface Props {
  token: string;
  onChanged: (summary: FamilySummary) => void;
  onClose: () => void;
  onLearningInvalidated: () => void;
}
type Confirmation =
  { kind: "withdraw" } | { kind: "delete"; learner?: FamilyLearner };
const messages: Record<string, string> = {
  sign_in_required: "Sign in again to manage your family.",
  learner_not_found:
    "This learner is no longer available. Refresh your family details.",
  invalid_family_request: "Check the name and try again.",
  family_service_unavailable:
    "Family settings could not be confirmed. Refresh your family details before retrying.",
  billing_account_not_found:
    "There is no linked Stripe billing account. Contact your purchase provider for billing help.",
  billing_unavailable:
    "Billing management is unavailable. Try again or contact your purchase provider; renewal has not been canceled.",
};
export function FamilyCenter({
  token,
  onChanged,
  onClose,
  onLearningInvalidated,
}: Props) {
  const [family, setFamily] = useState<FamilySummary | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [rename, setRename] = useState<string | null>(null),
    [name, setName] = useState("");
  const heading = useRef<HTMLHeadingElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    dialogHeading = useRef<HTMLHeadingElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const mounted = useRef(false),
    generation = useRef(0);
  useLayoutEffect(() => {
    mounted.current = true;
    generation.current++;
    setFamily(null);
    setError("");
    setNotice("");
    setConfirmation(null);
    setRename(null);
    setBusy(false);
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [token]);
  const current = (epoch: number) =>
    mounted.current && generation.current === epoch;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  async function api<T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const epoch = generation.current;
    const response = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
    const data = await response.json();
    if (!current(epoch) || tokenRef.current !== token)
      throw new Error("Your account session changed.");
    if (!response.ok)
      throw new Error(
        messages[data.error] ??
          "This action could not be completed. Try again or contact support.",
      );
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setFamily(null);
    setError("");
    setNotice("");
    setConfirmation(null);
    setRename(null);
    void api<FamilySummary>("/family", undefined, controller.signal)
      .then((next) => {
        setFamily(next);
        onChanged(next);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load family settings.",
          );
      });
    return () => controller.abort();
  }, [token]);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    if (!confirmation) return;
    const element = dialog.current;
    element?.showModal();
    dialogHeading.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      const previous = trigger.current;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        else heading.current?.focus({ preventScroll: true });
      });
    };
  }, [confirmation]);
  async function action(run: () => Promise<void>) {
    if (busy) return;
    const epoch = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
    } catch (e) {
      if (current(epoch))
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (current(epoch)) setBusy(false);
    }
  }
  async function refresh() {
    const epoch = generation.current;
    const next = await api<FamilySummary>("/family");
    if (!current(epoch)) return;
    setFamily(next);
    onChanged(next);
  }
  function ask(value: Confirmation) {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(value);
  }
  async function confirm() {
    const selected = confirmation;
    if (!selected) return;
    await action(async () => {
      if (selected.kind === "withdraw") {
        await api("/family/consent/withdraw", {});
        setConfirmation(null);
        setFamily(null);
        onLearningInvalidated();
        setNotice(
          "Consent withdrawn. New learning activity is paused. You can still export or delete learning data and manage billing. Renewal has not been canceled.",
        );
      } else {
        const receipt = await api<DeletionReceipt>(
          selected.learner
            ? `/family/learners/${encodeURIComponent(selected.learner.id)}/delete-learning-data`
            : "/family/delete-learning-data",
          { confirmation: "delete-learning-data" },
        );
        setConfirmation(null);
        setFamily(null);
        onLearningInvalidated();
        setNotice(
          `${receipt.deletedLearners} learner ${receipt.deletedLearners === 1 ? "history was" : "histories were"} removed from the live application. ${receipt.retainedBillingReferences ? "Only the linked billing references remain. " : ""}${receipt.consentWithdrawn ? "Consent is withdrawn. " : ""}${receipt.billingManagementRequired ? "A billing link remains: check and cancel renewal in billing if needed." : "Check your purchase provider for any renewal commitments."}`,
        );
      }
      const epoch = generation.current;
      try {
        await refresh();
      } catch {
        if (current(epoch))
          setError(
            "Your change was saved, but refreshed family details could not be loaded. Try refreshing; do not repeat the deletion.",
          );
      }
    });
  }
  async function exportData() {
    await action(async () => {
      await api("/family/export-ticket", {});
      const link = document.createElement("a");
      link.href = "/api/v1/family/export";
      link.download = `amp-family-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
      document.body.append(link);
      link.click();
      link.remove();
      setNotice(
        "Your download has started. Keep this file private. If the download is interrupted, try again.",
      );
    });
  }
  async function billing() {
    await action(async () => {
      const result = await api<{ url: string }>("/billing/portal", {});
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error(
          "The billing link could not be verified. Contact support.",
        );
      window.location.assign(url.href);
    });
  }
  return (
    <section className="family-center" aria-labelledby="family-title">
      <div className="family-heading">
        <div>
          <p className="eyebrow">PARENT ACCOUNT</p>
          <h1 id="family-title" ref={heading} tabIndex={-1}>
            Your family, your choices.
          </h1>
        </div>
        <button onClick={onClose} disabled={busy}>
          Back to learning
        </button>
      </div>
      <p className="family-intro">
        Manage learner names and learning records. Payment, privacy and practice
        are separate controls.
      </p>
      {error && (
        <p className="family-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="family-notice" role="status">
          {notice}
        </p>
      )}
      {!family ? (
        <div aria-busy="true">
          <p>Loading family details…</p>
          {error && (
            <button onClick={() => void action(refresh)}>Try again</button>
          )}
        </div>
      ) : (
        <>
          <section className="family-section">
            <h2>Learners</h2>
            {!family.learners.length && (
              <p>No learner profiles are stored in this account.</p>
            )}
            <div className="family-learners">
              {family.learners.map((learner) => (
                <article className="family-learner" key={learner.id}>
                  <h3>
                    {learner.deletedAt
                      ? "Deleted learner · billing reference"
                      : learner.name}
                  </h3>
                  {learner.deletedAt ? (
                    <p>
                      The name and learning history were removed. This reference
                      keeps payment and refund records connected.
                    </p>
                  ) : rename === learner.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void action(async () => {
                          await api(
                            `/family/learners/${encodeURIComponent(learner.id)}/rename`,
                            { name },
                          );
                          setRename(null);
                          await refresh();
                          setNotice("Learner name updated.");
                        });
                      }}
                    >
                      <label htmlFor={`rename-${learner.id}`}>
                        Learner display name
                      </label>
                      <input
                        id={`rename-${learner.id}`}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={80}
                        autoComplete="off"
                        autoFocus
                        disabled={busy}
                      />
                      <div className="family-actions">
                        <button disabled={busy || !name.trim()}>
                          Save name
                        </button>
                        <button
                          type="button"
                          onClick={() => setRename(null)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="family-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setRename(learner.id);
                          setName(learner.name);
                        }}
                      >
                        Edit name
                      </button>
                      <button
                        className="family-danger-link"
                        disabled={busy}
                        onClick={() => ask({ kind: "delete", learner })}
                      >
                        Delete learning data
                      </button>
                    </div>
                  )}
                  {!!learner.access.length && (
                    <ul className="family-access">
                      {learner.access.map((access, index) => (
                        <li key={index}>
                          {access.channel.toUpperCase()} ·{" "}
                          {access.status === "revoked"
                            ? "Access revoked"
                            : `Term ends ${new Date(access.endsAt).toLocaleDateString()}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {learner.stripeLinked && (
                    <div className="family-billing">
                      <p>
                        A Stripe purchase is linked. Check billing for its
                        current renewal status; deleting learning data does not
                        cancel it.
                      </p>
                      <button onClick={() => void billing()} disabled={busy}>
                        Manage billing and renewal
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="family-section">
            <h2>Your learning records</h2>
            <p>
              Download an NDJSON file containing this account’s learners,
              problems, answers, licenses, orders and privacy activity. This is
              a data export, not a printable workbook.
            </p>
            <button disabled={busy} onClick={() => void exportData()}>
              Download family data
            </button>
            <p className="family-secondary">
              The browser saves the streamed file without loading your entire
              history into this page. A large history may take longer to
              download.
            </p>
          </section>
          <section className="family-section">
            <h2>Consent for learning</h2>
            <p className="family-consent-status">
              {family.consent.status === "active"
                ? "Consent is active."
                : family.consent.status === "withdrawn"
                  ? "Consent is withdrawn. New learning activity is paused."
                  : family.consent.status === "development"
                    ? "Local development access. No verified consent record is present."
                    : "Verified parent consent is not recorded."}
            </p>
            {family.consent.status !== "withdrawn" ? (
              <>
                <p>
                  Withdrawal stops new learning activity. It does not delete
                  existing records or cancel payment renewal.
                </p>
                <button
                  disabled={busy}
                  onClick={() => ask({ kind: "withdraw" })}
                >
                  Withdraw consent
                </button>
              </>
            ) : (
              <p>
                To resume, ask the account administrator to verify consent. Your
                billing controls and data export stay available.
              </p>
            )}
          </section>
          <section className="family-section family-delete">
            <h2>Delete all learning data</h2>
            <p>
              Remove every learner’s name, saved problems and answer history
              from the live application, and withdraw consent. This cannot be
              undone through AMP.
            </p>
            <button
              className="family-danger"
              disabled={busy}
              onClick={() => ask({ kind: "delete" })}
            >
              Review deletion
            </button>
          </section>
          <section className="family-section family-retention">
            <h2>What these controls do not delete</h2>
            <p>{family.retained.identity}</p>
            <p>{family.retained.financial}</p>
            <p>{family.retained.backups}</p>
            <p>
              Privacy action records contain no learner names or answer history
              and expire after {family.retained.privacyAuditDays} days. An
              operational retention job removes expired records.
            </p>
          </section>
        </>
      )}
      {confirmation && (
        <dialog
          ref={dialog}
          className="family-dialog"
          aria-labelledby="family-confirm-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setConfirmation(null);
          }}
        >
          <h2 id="family-confirm-title" ref={dialogHeading} tabIndex={-1}>
            {confirmation.kind === "withdraw"
              ? "Pause new learning activity?"
              : confirmation.learner
                ? `Delete ${confirmation.learner.name}’s learning data?`
                : "Delete all family learning data?"}
          </h2>
          {confirmation.kind === "withdraw" ? (
            <p>
              Existing learning records stay available to export or delete.
              Practice pauses after withdrawal. Payment renewal continues unless
              you cancel it separately.
            </p>
          ) : (
            <>
              <p>
                Saved problems, answers and the learner name will be removed
                from the live application. This cannot be undone. Download your
                family data first if you want to keep a copy.
              </p>
              <p>
                Payment records and your parent sign-in remain.{" "}
                <strong>This does not cancel a subscription.</strong> Use
                billing management to check renewal.{" "}
                {confirmation.learner
                  ? "Other learners are not affected."
                  : "Consent will be withdrawn for this account."}
              </p>
            </>
          )}
          <div className="family-actions">
            <button disabled={busy} onClick={() => setConfirmation(null)}>
              Keep my settings
            </button>
            <button
              className="family-danger"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy
                ? "Saving…"
                : confirmation.kind === "withdraw"
                  ? "Withdraw consent"
                  : "Delete learning data"}
            </button>
          </div>
          {error && (
            <p role="alert" className="family-error">
              {error}
            </p>
          )}
        </dialog>
      )}
    </section>
  );
}

import { AccountSecurity } from "./AccountSecurity";
import { PaymentHistoryCenter } from "./PaymentHistoryCenter";
import { FocusDialog } from "./PracticeWorkspace";
import { licenseSummary, licenseChannel } from "./family-access";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  FamilySummary,
  FamilyLearner,
  DeletionReceipt,
} from "../family/contracts.js";
import "./family-center.css";
import { nativeRuntime } from "./native-runtime";
interface Props {
  token: string;
  accountsEnabled?: boolean;
  identity?: string;
  onChanged: (summary: FamilySummary) => void;
  onClose: () => void;
  onLearningInvalidated: () => void;
  initialSection?: "learners" | "access" | "privacy";
  onConsentEnrollment?: () => void;
  returnToConsent?: boolean;
  selectedLearnerId?: string;
  onSelectLearner?: (id: string) => void;
  returnFocus?: "annual" | "funded";
  onAnnualPurchase?: () => void;
  onFundedPurchase?: () => void;
  /** Opens "choose how to pay" for the selected learner. */
  onChoosePayment?: () => void;
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
  accountsEnabled = false,
  identity = token,
  onChanged,
  onClose,
  onLearningInvalidated,
  initialSection = "learners",
  onConsentEnrollment,
  returnToConsent = false,
  selectedLearnerId,
  onSelectLearner,
  returnFocus,
  onAnnualPurchase,
  onFundedPurchase,
  onChoosePayment,
}: Props) {
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const paymentTrigger = useRef<HTMLButtonElement>(null);
  const paymentWasOpen = useRef(false);
  useLayoutEffect(() => {
    if (paymentWasOpen.current && !paymentHistoryOpen)
      paymentTrigger.current?.focus({ preventScroll: true });
    paymentWasOpen.current = paymentHistoryOpen;
  }, [paymentHistoryOpen]);
  const [section, setSection] = useState<
    "learners" | "access" | "privacy" | "security"
  >(initialSection);
  const [localLearnerId, setLocalLearnerId] = useState("");
  const [accessDetails, setAccessDetails] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthYear, setNewBirthYear] = useState("");
  const accessTrigger = useRef<HTMLElement | null>(null);
  const [purchaseChooser, setPurchaseChooser] = useState(!!returnFocus);
  const [privacy, setPrivacy] = useState<
    "export" | "consent" | "delete" | "retention" | null
  >(returnToConsent ? "consent" : null);
  const [family, setFamily] = useState<FamilySummary | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [rename, setRename] = useState<string | null>(null),
    [name, setName] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const previousPrivacy = useRef(privacy),
    previousRename = useRef(rename);
  const heading = useRef<HTMLHeadingElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    dialogHeading = useRef<HTMLHeadingElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const mounted = useRef(false),
    generation = useRef(0);
  const downloadFrame = useRef<HTMLIFrameElement | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    generation.current++;
    setPaymentHistoryOpen(false);
    setFamily(null);
    setLocalLearnerId("");
    setAccessDetails(false);
    setSection(initialSection);
    setPurchaseChooser(!!returnFocus);
    setPrivacy(returnToConsent ? "consent" : null);
    setError("");
    setNotice("");
    setConfirmation(null);
    setRename(null);
    setBusy(false);
    return () => {
      mounted.current = false;
      generation.current++;
      downloadFrame.current?.remove();
      downloadFrame.current = null;
    };
  }, [identity]);
  useLayoutEffect(() => {
    if (family && returnFocus)
      document
        .querySelector<HTMLButtonElement>(
          `[data-purchase-entry="${returnFocus}"]`,
        )
        ?.focus({ preventScroll: true });
  }, [!!family, returnFocus]);
  useLayoutEffect(() => {
    if (family && returnToConsent)
      document
        .querySelector<HTMLElement>("[data-consent-enrollment]")
        ?.focus({ preventScroll: true });
  }, [!!family, returnToConsent]);
  function closeChooser() {
    setPurchaseChooser(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>("[data-purchase-options]")
        ?.focus({ preventScroll: true }),
    );
  }
  useLayoutEffect(() => {
    if (purchaseChooser && !returnFocus)
      document
        .querySelector<HTMLElement>(".family-purchase-options h2")
        ?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = 0;
  }, [purchaseChooser]);
  const profileId = selectedLearnerId ?? localLearnerId;
  const selectedLearner =
    family?.learners.find((entry) => entry.id === profileId) ??
    family?.learners.find((entry) => !entry.deletedAt) ??
    family?.learners[0];
  function selectLearner(id: string) {
    setLocalLearnerId(id);
    onSelectLearner?.(id);
    setRename(null);
    setAccessDetails(false);
    setError("");
    setNotice("");
    if (body.current) body.current.scrollTop = 0;
  }
  useLayoutEffect(() => {
    if (selectedLearner && selectedLearner.id !== profileId) {
      setLocalLearnerId(selectedLearner.id);
      onSelectLearner?.(selectedLearner.id);
    }
  }, [selectedLearner?.id, profileId, onSelectLearner]);
  const access = licenseSummary(selectedLearner?.access ?? []);
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
        authorization: `Bearer ${tokenRef.current}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
    const data = await response.json();
    if (!current(epoch)) {
      throw new Error("Your account session changed.");
    }
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
  }, [identity]);
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
  useLayoutEffect(() => {
    if (previousPrivacy.current === privacy) return;
    const previous = previousPrivacy.current;
    previousPrivacy.current = privacy;
    if (body.current) body.current.scrollTop = 0;
    const target = privacy
      ? body.current?.querySelector<HTMLElement>(".family-section h2")
      : body.current?.querySelector<HTMLElement>(
          `[data-privacy-choice="${previous}"]`,
        );
    target?.focus({ preventScroll: true });
  }, [privacy]);
  useLayoutEffect(() => {
    if (rename) {
      previousRename.current = rename;
      return;
    }
    if (!busy && previousRename.current) {
      body.current
        ?.querySelector<HTMLElement>(
          `[data-rename-id="${CSS.escape(previousRename.current)}"]`,
        )
        ?.focus({ preventScroll: true });
      previousRename.current = null;
    }
  }, [rename, busy]);
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
  function ask(value: Confirmation, source: HTMLElement) {
    trigger.current = source;
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
        setLocalLearnerId("");
        onSelectLearner?.("");
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
      const epoch = generation.current;
      const { ticket } = await api<{ ticket: string }>(
        "/family/export-ticket",
        {},
      );
      if (!current(epoch)) return;
      if (!/^[A-Za-z0-9_-]{43}$/.test(ticket))
        throw new Error("The download could not be prepared. Try again.");
      downloadFrame.current?.remove();
      const frame = document.createElement("iframe");
      frame.name = `family-download-${crypto.randomUUID()}`;
      frame.title = "Family data download";
      frame.hidden = true;
      downloadFrame.current = frame;
      frame.onload = () => {
        if (!current(epoch) || downloadFrame.current !== frame) return;
        // An attachment leaves the frame blank. A failed request returns an
        // error document here instead of replacing the learning application.
        if (frame.contentDocument?.body.textContent?.trim()) {
          setNotice("");
          setError(
            "The download could not be completed. Request a fresh download and try again.",
          );
        }
      };
      const form = document.createElement("form"),
        field = document.createElement("input");
      form.hidden = true;
      form.method = "POST";
      form.action = "/api/v1/family/export";
      form.target = frame.name;
      field.type = "hidden";
      field.name = "ticket";
      field.value = ticket;
      form.append(field);
      document.body.append(frame, form);
      form.submit();
      form.remove();
      setTimeout(() => frame.remove(), 120_000);
      setNotice(
        "Download requested. Check your browser’s downloads and keep the file private. If it is interrupted, request a fresh download.",
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
  if (paymentHistoryOpen)
    return (
      <PaymentHistoryCenter
        token={token}
        identity={identity}
        onClose={() => setPaymentHistoryOpen(false)}
      />
    );
  return (
    <section className="family-center" aria-labelledby="family-title">
      <div className="family-heading">
        <div>
          <h1 id="family-title" ref={heading} tabIndex={-1}>
            Family
          </h1>
        </div>
        <button
          onClick={purchaseChooser ? closeChooser : onClose}
          disabled={busy}
          className="family-back"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      </div>
      <nav className="family-tabs" aria-label="Family sections">
        {(
          [
            "learners",
            "access",
            "privacy",
            ...(accountsEnabled ? ["security" as const] : []),
          ] as const
        ).map((value) => (
          <button
            key={value}
            data-security-tab={value === "security" ? "" : undefined}
            aria-current={section === value ? "page" : undefined}
            onClick={() => {
              setSection(value);
              setPurchaseChooser(false);
              setRename(null);
              setPrivacy(null);
              setError("");
              setNotice("");
            }}
            disabled={busy}
          >
            {value === "learners"
              ? "Learners"
              : value === "access"
                ? "Access"
                : value === "privacy"
                  ? "Privacy"
                  : "Security"}
          </button>
        ))}
      </nav>
      {accessDetails && selectedLearner && (
        <FocusDialog
          title="License history"
          close={() => setAccessDetails(false)}
          returnFocus={accessTrigger.current}
        >
          <p>
            {selectedLearner.deletedAt
              ? "Retained billing reference"
              : selectedLearner.name}
          </p>
          <ul className="family-license-history">
            {selectedLearner.access.map((entry, index) => (
              <li key={index}>
                <strong>
                  {licenseChannel(entry.channel)}
                  {entry.status === "revoked" ? " · revoked" : ""}
                </strong>
                <br />
                {new Date(entry.startsAt).toLocaleDateString()} –{" "}
                {new Date(entry.endsAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
          <p>
            A license term does not confirm automatic renewal. Use your
            provider’s billing controls to check or cancel renewal.
          </p>
        </FocusDialog>
      )}
      <div className="family-body" ref={body}>
        {section === "security" && <AccountSecurity />}
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
        ) : purchaseChooser ? (
          <section
            className="family-purchase-options"
            aria-label="Purchase options"
          >
            <h2 tabIndex={-1}>Purchases and records</h2>
            <p>
              Review payment records or choose a purchase route for your
              learner.
            </p>
            <div className="family-purchase-buttons">
              <button
                ref={paymentTrigger}
                data-payment-history
                onClick={() => setPaymentHistoryOpen(true)}
              >
                Payment records <span>Paid receipts and refund PDFs</span>
              </button>
              {onAnnualPurchase && (
                <button data-purchase-entry="annual" onClick={onAnnualPurchase}>
                  Annual subscription{" "}
                  <span>Card payment · current price and terms</span>
                </button>
              )}
              {onFundedPurchase && (
                <button data-purchase-entry="funded" onClick={onFundedPurchase}>
                  Education funds{" "}
                  <span>Program options · quotes and requests</span>
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            {(section === "learners" || section === "access") && (
              <section className="family-section family-focused-section">
                <h2
                  tabIndex={-1}
                  className={section === "access" ? "sr-only" : undefined}
                >
                  {section === "learners"
                    ? "Who’s learning?"
                    : "Learning access"}
                </h2>
                {!family.learners.length && (
                  <p>No learner profiles are stored in this account.</p>
                )}
                {!!family.learners.length && (
                  <label className="family-profile-select">
                    <span>Learner or billing reference</span>
                    <select
                      aria-label="Family learner"
                      value={selectedLearner?.id ?? ""}
                      disabled={busy}
                      onChange={(event) => selectLearner(event.target.value)}
                    >
                      {family.learners.map((entry, index) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.deletedAt
                            ? `Deleted learner · reference ${index + 1}`
                            : entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="family-learners">
                  {(selectedLearner ? [selectedLearner] : []).map((learner) => (
                    <article className="family-learner" key={learner.id}>
                      <h3
                        className={section === "access" ? "sr-only" : undefined}
                      >
                        {learner.deletedAt
                          ? "Deleted learner · billing reference"
                          : learner.name}
                      </h3>
                      {learner.deletedAt ? (
                        <p>
                          Learning data was deleted. Billing records are
                          retained.
                        </p>
                      ) : section !== "learners" ? null : rename ===
                        learner.id ? (
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
                            data-rename-id={learner.id}
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
                            onClick={(event) =>
                              ask(
                                { kind: "delete", learner },
                                event.currentTarget,
                              )
                            }
                          >
                            Delete learning data
                          </button>
                        </div>
                      )}
                      {section === "access" && (
                        <div className="family-license-summary">
                          <strong>
                            {access.kind === "active"
                              ? "License active"
                              : access.kind === "scheduled"
                                ? "License scheduled"
                                : "No current license"}
                          </strong>
                          {access.license && (
                            <p>
                              {licenseChannel(access.license.channel)} ·{" "}
                              {access.kind === "scheduled"
                                ? `Starts ${new Date(access.license.startsAt).toLocaleDateString()}`
                                : `Ends ${new Date(access.license.endsAt).toLocaleDateString()}`}
                            </p>
                          )}
                          {access.kind === "active" &&
                            !["active", "development"].includes(
                              family.consent.status,
                            ) && <p>Learning paused: consent needed.</p>}
                          {!!learner.access.length && (
                            <button
                              className="text-button"
                              onClick={(event) => {
                                accessTrigger.current = event.currentTarget;
                                setAccessDetails(true);
                              }}
                            >
                              License history and dates
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {section === "access" && (
                  <div className="family-profile-actions">
                    {selectedLearner?.stripeLinked && (
                      <div className="family-billing">
                        <button
                          aria-label="Manage billing and renewal"
                          disabled={busy}
                          onClick={() => void billing()}
                        >
                          Manage billing
                        </button>
                      </div>
                    )}
                    {onChoosePayment &&
                      selectedLearner &&
                      access.kind === "none" && (
                        <button
                          className="go-button family-get-access"
                          onClick={onChoosePayment}
                        >
                          Get a year of AMP
                        </button>
                      )}
                    <button
                      className="family-purchase-open"
                      data-purchase-options
                      onClick={() => setPurchaseChooser(true)}
                    >
                      Purchases &amp; records
                    </button>
                  </div>
                )}
                {section === "learners" && !nativeRuntime && !adding && (
                  <button
                    className="secondary family-add-toggle"
                    disabled={busy}
                    onClick={() => setAdding(true)}
                  >
                    <span aria-hidden="true">+</span> Add learner
                  </button>
                )}
                {section === "learners" && !nativeRuntime && adding && (
                  <form
                    className="family-add-learner"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = newName.trim();
                      if (!name) return;
                      void action(async () => {
                        await api("/learners", {
                          name,
                          ...(newBirthYear
                            ? { birthYear: Number(newBirthYear) }
                            : {}),
                        });
                        await refresh();
                        setNewName("");
                        setNewBirthYear("");
                        setAdding(false);
                        setNotice(`${name} added.`);
                      });
                    }}
                  >
                    <label>
                      <span>Name</span>
                      <input
                        value={newName}
                        maxLength={60}
                        placeholder="First name or nickname"
                        onChange={(event) => setNewName(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Birth year</span>
                      <select
                        value={newBirthYear}
                        onChange={(event) =>
                          setNewBirthYear(event.target.value)
                        }
                      >
                        <option value="">Choose</option>
                        {Array.from(
                          { length: 16 },
                          (_, i) => new Date().getFullYear() - 4 - i,
                        ).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                        <option value={new Date().getFullYear() - 25}>
                          Adult
                        </option>
                      </select>
                    </label>
                    <button disabled={busy || !newName.trim()}>
                      Add learner
                    </button>
                  </form>
                )}
              </section>
            )}
            {section === "privacy" && !privacy && (
              <section className="family-section privacy-choices">
                <h2 tabIndex={-1}>Your learning records</h2>
                {(
                  [
                    [
                      "export",
                      "Download your records",
                      "Keep a personal copy of your family’s data.",
                    ],
                    [
                      "consent",
                      "Learning consent",
                      "Review consent or pause new activity.",
                    ],
                    [
                      "delete",
                      "Delete learning data",
                      "Review what will be permanently removed.",
                    ],
                    [
                      "retention",
                      "What is retained?",
                      "Understand billing, sign-in, and backups.",
                    ],
                  ] as const
                ).map(([key, title, detail]) => (
                  <button
                    key={key}
                    data-privacy-choice={key}
                    onClick={() => setPrivacy(key)}
                  >
                    <strong>{title}</strong>
                    <span>{detail}</span>
                    <b aria-hidden="true">›</b>
                  </button>
                ))}
              </section>
            )}
            {section === "privacy" && privacy && (
              <button
                className="privacy-back text-button"
                onClick={() => setPrivacy(null)}
              >
                ← Privacy choices
              </button>
            )}
            {section === "privacy" && privacy === "export" && (
              <section className="family-section">
                <h2 tabIndex={-1}>Your learning records</h2>
                <p>
                  Download an NDJSON file containing this account’s learners,
                  problems, answers, licenses, orders and privacy activity. This
                  is a data export, not a printable workbook.
                </p>
                <button disabled={busy} onClick={() => void exportData()}>
                  Download family data
                </button>
                <p className="family-secondary">
                  The browser saves the streamed file without loading your
                  entire history into this page. A large history may take longer
                  to download.
                </p>
              </section>
            )}
            {section === "privacy" && privacy === "consent" && (
              <section className="family-section">
                <h2 tabIndex={-1}>Consent for learning</h2>
                <p className="family-consent-status">
                  {family.consent.status === "active"
                    ? "Consent is active."
                    : family.consent.status === "withdrawn"
                      ? "Consent is withdrawn. New learning activity is paused."
                      : family.consent.status === "development"
                        ? "Local development access. No verified consent record is present."
                        : "Verified parent consent is not recorded."}
                </p>
                {onConsentEnrollment && (
                  <button data-consent-enrollment onClick={onConsentEnrollment}>
                    {family.consent.status === "active"
                      ? "Review consent enrollment"
                      : "Review consent options"}
                  </button>
                )}
                {family.consent.status === "active" ||
                family.consent.status === "development" ? (
                  <>
                    <p>
                      Withdrawal stops new learning activity. It does not delete
                      existing records or cancel payment renewal.
                    </p>
                    <button
                      disabled={busy}
                      onClick={(event) =>
                        ask({ kind: "withdraw" }, event.currentTarget)
                      }
                    >
                      Withdraw consent
                    </button>
                  </>
                ) : (
                  <p>
                    Review consent options to check enrollment availability.
                    Your billing controls and data export stay available.
                    Pausing learning does not cancel paid subscriptions.
                  </p>
                )}
              </section>
            )}
            {section === "privacy" && privacy === "delete" && (
              <section className="family-section family-delete">
                <h2 tabIndex={-1}>Delete all learning data</h2>
                <p>
                  Remove every learner’s name, saved problems and answer history
                  from the live application, and withdraw consent. This cannot
                  be undone through AMP.
                </p>
                <button
                  className="family-danger"
                  disabled={busy}
                  onClick={(event) =>
                    ask({ kind: "delete" }, event.currentTarget)
                  }
                >
                  Review deletion
                </button>
              </section>
            )}
            {section === "privacy" && privacy === "retention" && (
              <section className="family-section family-retention">
                <h2 tabIndex={-1}>What these controls do not delete</h2>
                <p>{family.retained.identity}</p>
                <p>{family.retained.financial}</p>
                <p>{family.retained.backups}</p>
                <p>
                  Privacy action records contain no learner names or answer
                  history and expire after {family.retained.privacyAuditDays}{" "}
                  days. An operational retention job removes expired records.
                </p>
              </section>
            )}
          </>
        )}
      </div>
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
          <div className="family-dialog-copy">
            <h2 id="family-confirm-title" ref={dialogHeading} tabIndex={-1}>
              {confirmation.kind === "withdraw"
                ? "Pause new learning activity?"
                : confirmation.learner
                  ? "Delete this learner’s data?"
                  : "Delete all family learning data?"}
            </h2>
            {confirmation.kind === "delete" && confirmation.learner && (
              <p className="family-confirm-learner">
                <strong>Learner:</strong> {confirmation.learner.name}
              </p>
            )}
            {confirmation.kind === "withdraw" ? (
              <p>
                Existing learning records stay available to export or delete.
                Practice pauses after withdrawal. Payment renewal continues
                unless you cancel it separately.
              </p>
            ) : (
              <>
                <p>
                  Saved problems, answers and the learner name will be removed
                  from the live application. This cannot be undone. Download
                  your family data first if you want to keep a copy.
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
          </div>
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

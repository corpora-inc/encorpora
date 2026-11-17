import { useSettingsFamily } from "./features/family/account-settings";
import { pastCoppaAge } from "../privacy/coppa-age";
import { Page } from "./ui/Page";
import { PageHeader } from "./ui/PageHeader";
import { requestFetch } from "./lib/request-transport";
import { namedByTab as titleNamedByTab } from "./features/navigation/shell-frame";
import screenTitle from "./ui/ScreenTitle.module.css";
import { SatMathFocus } from "./features/practice/SatMathFocus";
import { workbooksEnabled } from "./features/workbooks/config";
import { canReadWorkbooks } from "./features/workbooks/model";
import { DeletionTerms } from "./features/privacy/LearningData";
import { Toast } from "./ui/Toast";
import { useLoggedError, requestMessage } from "./feedback";
import { useAppRoute, type FamilySection } from "./app-routes";
import { useAccountCache, useFamilyCache } from "./lib/family-cache";
import { YearField } from "./ui/YearField";
import { OwnStartSetting } from "./features/me/OwnStartSetting";
import { AccountSecurity } from "./AccountSecurity";
import { YourName } from "./features/account/YourName";
import { PaymentHistoryCenter } from "./PaymentHistoryCenter";
import { FocusDialog } from "./PracticeWorkspace";
import { licenseChannel } from "./family-access";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  FamilySummary,
  FamilyLearner,
  DeletionReceipt,
} from "../family/contracts.js";
import "./family-center.css";
import { nativeRuntime } from "./native-runtime";
import { Loading } from "./ui/Loading";
import { Sheet } from "./ui/Sheet";
import { Button, buttonClass } from "./ui/Button";
import { TextField } from "./ui/TextField";
import { Link, useLocation } from "@tanstack/react-router";
import { BillingList, Chevron } from "./features/account/BillingList";
import { LearnerList } from "./features/account/LearnerList";
import { DeleteAccountEntry } from "./features/account/DeleteAccountEntry";
import pages from "./features/account/AccountPages.module.css";
import {
  CHILD_NAME_MAX,
  childNameProblem,
  PARENT_ENTRY_LINE,
} from "../learning/nickname";
import { useLearnerStore } from "./learner-store";
import { invalidateAccount, refreshMe } from "./lib/query";
import { rememberPlace } from "./features/onboarding/place-memory";
import { deviceTimeZone } from "./features/onboarding/starter-api";
import { SecondParent } from "./features/second-parent/SecondParent";
import { SecondParentNote } from "./features/second-parent/SecondParentNote";
import { secondParentOnly } from "./features/second-parent/api";
interface Props {
  token: string;
  onSectionChange?: (section: FamilySection) => void;
  accountsEnabled?: boolean;
  identity?: string;
  onChanged: () => void | Promise<void>;
  onClose: () => void;
  onLearningInvalidated: () => void;
  initialSection?: "learners" | "access" | "privacy" | "security";
  onConsentEnrollment?: () => void;
  /** First-run setup (plan, payment, learner); defaults to consent review. */
  onContinueSetup?: () => void;
  returnToConsent?: boolean;
  selectedLearnerId?: string;
  onSelectLearner?: (id: string) => void;
  returnFocus?: "annual" | "funded";
  onAnnualPurchase?: () => void;
  onFundedPurchase?: () => void;
  /** Opens "choose how to pay" for the selected learner. */
  onChoosePayment?: () => void;
}
type Confirmation = { kind: "delete"; learner?: FamilyLearner };
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
  onSectionChange,
  accountsEnabled = false,
  identity = token,
  onChanged,
  onClose,
  onLearningInvalidated,
  initialSection = "learners",
  onConsentEnrollment,
  onContinueSetup,
  returnToConsent = false,
  selectedLearnerId,
  onSelectLearner,
  returnFocus,
  onAnnualPurchase,
  onFundedPurchase,
  onChoosePayment,
}: Props) {
  const route = useAppRoute();
  const settingsFamily = useSettingsFamily();
  // The family's second parent (docs/families.md): the account holder invites
  // her here; she, with no family of her own, finds hers described instead.
  const session = { accountId: identity, token };
  const account = useAccountCache(nativeRuntime ? null : identity);
  const secondOnly = secondParentOnly(account);
  const learnerSections =
    (initialSection === "learners" || initialSection === "access") &&
    !secondOnly;
  const paymentHistoryOpen = route.parts[2] === "records";
  const setPaymentHistoryOpen = (open: boolean) =>
    route.navigate(
      open ? "/account/billing/records" : "/account/billing/purchases",
    );
  const paymentTrigger = useRef<HTMLButtonElement>(null);
  const paymentWasOpen = useRef(false);
  const section = initialSection;
  const [localLearnerId, setLocalLearnerId] = useState("");
  const [historyFor, setHistoryFor] = useState<FamilyLearner | null>(null);
  /** The child whose settings are open in Learners. */
  const [openLearner, setOpenLearner] = useState<string | null>(null);
  const adding = route.parts[2] === "new";
  const setAdding = (open: boolean) =>
    route.navigate(open ? "/family/learners/new" : "/family/learners");
  const [newName, setNewName] = useState("");
  const [newBirthYear, setNewBirthYear] = useState("");
  /** An adult's birth year in Add learner: asked once whether it is them. */
  const [askSelf, setAskSelf] = useState<string | null>(null);
  const accessTrigger = useRef<HTMLElement | null>(null);
  const purchaseChooser = route.parts[2] === "purchases";
  const setPurchaseChooser = (open: boolean) => {
    if (open) route.navigate("/account/billing/purchases");
  };
  // Family is about the family's learners; the adult's own learner is its
  // own place.
  const cached = useFamilyCache(identity);
  const family = useMemo(
    () =>
      cached && {
        ...cached,
        learners: cached.learners.filter((learner) => !learner.adult),
      },
    [cached],
  );
  // A parent adds a child with or without verified consent; withdrawal
  // stops collection. With none yet, the starter's first step adds them.
  const canAddChild =
    !!family &&
    family.consent.status !== "withdrawn" &&
    (["active", "development"].includes(family.consent.status) ||
      family.learners.some((entry) => !entry.deletedAt && !entry.adult));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    /** A corrected birth year, said over the page so nothing moves. */
    [yearSaved, setYearSaved] = useState("");
  useLoggedError(error);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [rename, setRename] = useState<string | null>(null),
    [name, setName] = useState(""),
    [nameError, setNameError] = useState(""),
    [newNameError, setNewNameError] = useState("");
  const body = useRef<HTMLElement>(null);
  const previousRename = useRef(rename);
  const heading = useRef<HTMLHeadingElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    dialogHeading = useRef<HTMLHeadingElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  const mounted = useRef(false),
    generation = useRef(0);
  useLayoutEffect(() => {
    mounted.current = true;
    generation.current++;

    setLocalLearnerId("");
    setHistoryFor(null);

    setError("");
    setNotice("");
    setConfirmation(null);
    setRename(null);
    setBusy(false);
    return () => {
      mounted.current = false;
      generation.current++;
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
  const chooserWasOpen = useRef(purchaseChooser);
  useLayoutEffect(() => {
    if (chooserWasOpen.current && !purchaseChooser)
      document
        .querySelector<HTMLButtonElement>("[data-purchase-options]")
        ?.focus({ preventScroll: true });
    chooserWasOpen.current = purchaseChooser;
  }, [purchaseChooser]);
  useLayoutEffect(() => {
    if (purchaseChooser && !returnFocus)
      heading.current?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = 0;
  }, [purchaseChooser]);
  useLayoutEffect(() => {
    if (paymentWasOpen.current && !paymentHistoryOpen)
      paymentTrigger.current?.focus({ preventScroll: true });
    paymentWasOpen.current = paymentHistoryOpen;
  }, [paymentHistoryOpen]);
  const profileId = selectedLearnerId ?? localLearnerId;
  const selectedLearner =
    family?.learners.find((entry) => entry.id === profileId) ??
    family?.learners.find((entry) => !entry.deletedAt) ??
    family?.learners[0];
  function selectLearner(id: string) {
    setLocalLearnerId(id);
    onSelectLearner?.(id);
    setRename(null);
    setHistoryFor(null);
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
    const response = await requestFetch(`/api/v1${path}`, {
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
          requestMessage(
            data.error,
            body === undefined
              ? "Loading family details"
              : path === "/learners"
                ? "Saving this learner"
                : "Saving your family change",
          ),
      );
    return data;
  }
  useLayoutEffect(() => {
    if (!returnToConsent && !returnFocus)
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
    await onChanged();
  }
  function ask(value: Confirmation, source: HTMLElement) {
    trigger.current = source;
    setConfirmation(value);
  }
  async function confirm() {
    const selected = confirmation;
    if (!selected) return;
    await action(async () => {
      {
        const receipt = await api<DeletionReceipt>(
          selected.learner
            ? `/family/learners/${encodeURIComponent(selected.learner.id)}/delete-learning-data`
            : "/family/delete-learning-data",
          { confirmation: "delete-learning-data" },
        );
        setConfirmation(null);

        setLocalLearnerId("");
        onSelectLearner?.("");
        onLearningInvalidated();
        setNotice(
          `${receipt.deletedLearners} learner ${receipt.deletedLearners === 1 ? "history was" : "histories were"} removed from the live application. ${receipt.retainedBillingReferences ? "Linked financial records remain, including any student name required on an invoice. " : ""}${receipt.consentWithdrawn ? "Consent is withdrawn. " : ""}${receipt.billingManagementRequired ? "A billing link remains: check and cancel renewal in billing if needed." : "Check your purchase provider for any renewal commitments."}`,
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
  // Read before any early return: the open tab may already say the title.
  const pathname = useLocation({ select: (location) => location.pathname });
  if (paymentHistoryOpen)
    return (
      <PaymentHistoryCenter
        token={token}
        identity={identity}
        onClose={() => setPaymentHistoryOpen(false)}
      />
    );
  const ownLearner = cached?.learners.find(
    (entry) => entry.adult && !entry.simulation && !entry.deletedAt,
  );
  const consentActive = ["active", "development"].includes(
    family?.consent.status ?? "",
  );
  const hasChildren = !!family?.learners.some((entry) => !entry.deletedAt);
  const title = purchaseChooser
    ? "Purchases and records"
    : section === "security"
      ? "Profile"
      : section === "learners"
        ? "Learners"
        : "Billing";
  const namedByTab = !settingsFamily && titleNamedByTab(pathname, title);
  const addChild = () =>
    consentActive ? setAdding(true) : route.navigate("/start/parent");
  /** The account holder corrects a child's year; a second parent reads it. */
  const canChangeYear = !secondOnly;
  const saveBirthYear = (learner: FamilyLearner, birthYear: number) =>
    void action(async () => {
      if (learner.birthYear === birthYear) return;
      try {
        await api(
          `/family/learners/${encodeURIComponent(learner.id)}/birth-year`,
          { birthYear },
        );
      } catch (failure) {
        console.error("The birth year did not save", failure);
        throw new Error(
          failure instanceof Error &&
            failure.message !== messages.invalid_family_request
            ? failure.message
            : "That year didn’t save. Choose it again from the list.",
        );
      }
      await refresh();
      // The level, the class's grade and practice read the year: one store.
      void invalidateAccount(identity);
      setYearSaved(`${learner.name}’s birth year is ${birthYear}.`);
    });
  /** One child's settings, opened under their row in Learners. */
  const learnerDetail = (learner: FamilyLearner) => {
    const age = learner.birthYear
      ? new Date().getFullYear() - learner.birthYear
      : null;
    // 13 or older is outside COPPA (16 CFR 312.2): named like any learner.
    const canName =
      !learner.namePending || consentActive || pastCoppaAge(learner.birthYear);
    return (
      <>
        {!nativeRuntime && (age === null || age >= 13) && (
          <SatMathFocus
            key={`${identity}:${learner.id}`}
            learner={learner}
            token={token}
            identity={identity}
            onSaved={refresh}
          />
        )}
        {rename === learner.id ? (
          <form
            className={pages.renameForm}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const problem = childNameProblem(name);
              if (problem) return setNotice(problem);
              void action(async () => {
                await api(
                  `/family/learners/${encodeURIComponent(learner.id)}/rename`,
                  { name },
                );
                setRename(null);
                await refresh();
                setNotice("Name saved.");
              });
            }}
          >
            <TextField
              label={learner.namePending ? "Their name" : "Name"}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={CHILD_NAME_MAX}
              autoComplete="off"
              placeholder="First name or nickname"
              title={PARENT_ENTRY_LINE}
              autoFocus
              disabled={busy}
            />
            <div className={pages.detailActions}>
              <Button variant="primary" disabled={busy || !name.trim()}>
                Save name
              </Button>
              <Button
                variant="quiet"
                type="button"
                onClick={() => setRename(null)}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* The year sets where practice starts and the grade the class
                shows; a parent corrects it here (Q-56). Answers stay. */}
            <div className={pages.yearRow}>
              <span id={`birth-year-${learner.id}`}>Birth year</span>
              <YearField
                label={`Birth year, ${learner.name}`}
                earlier
                value={learner.birthYear ? String(learner.birthYear) : ""}
                placeholder="Choose a year"
                disabled={busy || !canChangeYear}
                onChange={(year) => saveBirthYear(learner, Number(year))}
              />
            </div>
            <div className={pages.detailActions}>
              {!nativeRuntime &&
                workbooksEnabled &&
                canReadWorkbooks(learner) && (
                  <Link
                    to="/learners/$learnerId/workbooks"
                    params={{ learnerId: learner.id }}
                    className={buttonClass("secondary")}
                  >
                    Workbooks
                  </Link>
                )}
              {canName && (
                <Button
                  variant="secondary"
                  data-rename-id={learner.id}
                  disabled={busy}
                  onClick={() => {
                    setRename(learner.id);
                    setName(learner.namePending ? "" : learner.name);
                  }}
                >
                  {learner.namePending ? "Add their name" : "Edit name"}
                </Button>
              )}
            </div>
          </>
        )}
        {rename !== learner.id && (
          <div>
            <Button
              variant="quiet"
              align="start"
              className={pages.danger}
              disabled={busy}
              onClick={(event) =>
                ask({ kind: "delete", learner }, event.currentTarget)
              }
            >
              Delete {learner.name}’s learning data
            </Button>
          </div>
        )}
      </>
    );
  };
  return (
    <Page
      ref={body}
      data-family-center=""
      data-account-body=""
      aria-labelledby="family-title"
    >
      {historyFor && (
        <FocusDialog
          title="Plan dates"
          close={() => setHistoryFor(null)}
          returnFocus={accessTrigger.current}
        >
          <p>
            {historyFor.deletedAt
              ? "Retained billing reference"
              : historyFor.adult
                ? "Your practice"
                : historyFor.name}
          </p>
          <ul className="family-license-history">
            {historyFor.access.map((entry, index) => (
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
            A plan’s dates don’t show whether it renews. Your payment provider’s
            billing page shows renewal and lets you cancel it.
          </p>
        </FocusDialog>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
      <Toast
        message={yearSaved}
        tone="status"
        onDismiss={() => setYearSaved("")}
      />
      {/* The open tab already says Sign-in, Learners, Billing or
            Privacy: the title stays for screen readers and focus only. */}
      {namedByTab ? (
        <h1
          id="family-title"
          ref={heading}
          tabIndex={-1}
          className={screenTitle.hidden}
        >
          {title}
        </h1>
      ) : (
        <PageHeader title={title} titleId="family-title" titleRef={heading} />
      )}
      {/* Every adult's own name, as others see it (R9, R12). */}
      {section === "security" && <YourName />}
      {section === "security" && accountsEnabled && <AccountSecurity />}
      {/* With AMP accounts, the row follows Sign-in's settings once they
            load (AccountSecurity), so nothing below them moves. */}
      {section === "security" && !accountsEnabled && <DeleteAccountEntry />}
      {notice && (
        <p className="family-notice" role="status">
          {notice}
        </p>
      )}
      {/* Sign-in shows no family details: no family wait sits below its
            settings to be pushed down when they arrive. */}
      {section === "security" && accountsEnabled ? null : !family ? (
        <div aria-busy="true" className={pages.section}>
          <div className={`${pages.reserve} amp-skeleton`} />
          <div className={`${pages.reserve} amp-skeleton`} />
          {error && (
            <div className={pages.footActions}>
              <Button variant="secondary" onClick={() => void action(refresh)}>
                Try again
              </Button>
            </div>
          )}
        </div>
      ) : purchaseChooser ? (
        <>
          <section
            className={`family-purchase-options ${pages.section}`}
            aria-labelledby="family-title"
          >
            <ul className={pages.list}>
              <li className={pages.linkItem}>
                <button
                  type="button"
                  ref={paymentTrigger}
                  className={pages.linkRow}
                  data-payment-history
                  onClick={() => setPaymentHistoryOpen(true)}
                >
                  <span className={pages.rowText}>
                    <span className={pages.rowTitle}>Payment records</span>
                    <span className={pages.rowMeta}>
                      Paid receipts and refund PDFs
                    </span>
                  </span>
                  <Chevron />
                </button>
              </li>
              {onAnnualPurchase && (
                <li className={pages.linkItem}>
                  <button
                    type="button"
                    className={pages.linkRow}
                    data-purchase-entry="annual"
                    onClick={onAnnualPurchase}
                  >
                    <span className={pages.rowText}>
                      <span className={pages.rowTitle}>
                        Annual subscription
                      </span>
                      <span className={pages.rowMeta}>
                        Card payment, with the current price and terms
                      </span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              )}
              {onFundedPurchase && (
                <li className={pages.linkItem}>
                  <button
                    type="button"
                    className={pages.linkRow}
                    data-purchase-entry="funded"
                    onClick={onFundedPurchase}
                  >
                    <span className={pages.rowText}>
                      <span className={pages.rowTitle}>Education funds</span>
                      <span className={pages.rowMeta}>
                        Program options, quotes and requests
                      </span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              )}
            </ul>
          </section>
        </>
      ) : (
        <>
          {(section === "learners" || section === "access") &&
            secondOnly &&
            account && <SecondParentNote me={account} />}
          {learnerSections && section === "learners" && (
            <section className={pages.section} aria-label="Learners">
              {!consentActive && nativeRuntime ? (
                <div className={pages.section}>
                  <p className={pages.lede}>
                    Learning consent is completed in the AMP web application.
                  </p>
                  <div className={pages.footActions}>
                    <Button
                      variant="primary"
                      onClick={onContinueSetup ?? onConsentEnrollment}
                    >
                      Continue setup
                    </Button>
                  </div>
                </div>
              ) : null}
              <LearnerList
                own={ownLearner}
                ownDetail={
                  ownLearner && !nativeRuntime ? (
                    <OwnStartSetting
                      session={session}
                      start={ownLearner.start}
                    />
                  ) : undefined
                }
                children={family.learners}
                selectedId={openLearner ?? undefined}
                onSelect={(id) => {
                  setOpenLearner(id || null);
                  // The adult's own practice opens its settings here; it
                  // isn't chosen as the family's learner.
                  if (id && id !== ownLearner?.id) selectLearner(id);
                }}
                detail={learnerDetail}
              />
              {!nativeRuntime && !adding && (
                <div className={pages.footActions}>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={addChild}
                  >
                    Add a child
                  </Button>
                </div>
              )}
              {!nativeRuntime && adding && (
                <form
                  id="family-add-learner"
                  className={pages.addForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = newName.trim();
                    if (!name || !newBirthYear) return;
                    // An adult may be adding themselves: their own
                    // practice is their own learner, not a family one.
                    if (
                      askSelf === null &&
                      newBirthYear &&
                      Number(newBirthYear) <= new Date().getFullYear() - 18
                    )
                      return setAskSelf(name);
                    setAskSelf(null);
                    void action(async () => {
                      await api("/learners", {
                        name,
                        birthYear: Number(newBirthYear),
                      });
                      await refresh();
                      setNewName("");
                      setNewBirthYear("");
                      setAdding(false);
                      setNotice(`${name} added.`);
                    });
                  }}
                >
                  <h2 className={pages.sectionTitle}>Add a child</h2>
                  <TextField
                    label="Name"
                    value={newName}
                    maxLength={CHILD_NAME_MAX}
                    placeholder="First name or nickname"
                    onChange={(event) => setNewName(event.target.value)}
                  />
                  <div className={pages.fieldLabel}>
                    <span>Birth year</span>
                    <YearField
                      label={
                        newName.trim()
                          ? `Birth year, ${newName.trim()}`
                          : "Birth year"
                      }
                      value={newBirthYear}
                      placeholder="Choose a year"
                      onChange={setNewBirthYear}
                      disabled={busy}
                      earlier
                    />
                  </div>
                  {/* The birth year sets where practice starts. */}
                  <div className={pages.detailActions}>
                    <Button
                      variant="primary"
                      disabled={busy || !newName.trim() || !newBirthYear}
                    >
                      Add
                    </Button>
                    <Button
                      variant="quiet"
                      type="button"
                      disabled={busy}
                      onClick={() => setAdding(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <Sheet
                    open={askSelf !== null}
                    onOpenChange={(open) => {
                      if (!open) setAskSelf(null);
                    }}
                    title="Is this you?"
                  >
                    <div className="family-sheet-actions">
                      <Button
                        variant="primary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const { learnerId } = await api<{
                              learnerId: string;
                            }>("/me/practice", {
                              timezone: deviceTimeZone(),
                              // Sets where their own practice starts.
                              birthYear: Number(newBirthYear),
                            });
                            useLearnerStore.getState().select(learnerId);
                            rememberPlace(identity, "me");
                            await refreshMe({ accountId: identity, token });
                            setAskSelf(null);
                            setAdding(false);
                            setNewName("");
                            setNewBirthYear("");
                            route.navigate("/me");
                          })
                        }
                      >
                        Yes, it’s me
                      </Button>
                      <Button
                        variant="secondary"
                        type="submit"
                        form="family-add-learner"
                        disabled={busy}
                      >
                        No, add {askSelf ?? "them"}
                      </Button>
                    </div>
                  </Sheet>
                </form>
              )}
            </section>
          )}
          {learnerSections &&
            section === "learners" &&
            !adding &&
            !nativeRuntime &&
            account?.familyClass && (
              <SecondParent
                session={session}
                className="family-second-parent"
                headingClassName={pages.sectionTitle}
              />
            )}
          {learnerSections && section === "access" && (
            <section className={pages.section} aria-label="Billing">
              <BillingList
                learners={cached?.learners ?? family.learners}
                consentActive={consentActive}
                busy={busy}
                recordsRef={paymentTrigger}
                onContinue={(learner) => {
                  if (nativeRuntime && onChoosePayment) {
                    selectLearner(learner.id);
                    onChoosePayment();
                  } else route.navigate(`/pay/${learner.id}`);
                }}
                onManage={() => void billing()}
                onHistory={(learner, trigger) => {
                  accessTrigger.current = trigger;
                  setHistoryFor(learner);
                }}
                onRecords={() => setPurchaseChooser(true)}
              />
            </section>
          )}
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
          <div className="family-dialog-copy">
            <h2 id="family-confirm-title" ref={dialogHeading} tabIndex={-1}>
              {confirmation.learner
                ? "Delete this learner’s data?"
                : hasChildren
                  ? "Delete all family learning data?"
                  : "Delete your learning data?"}
            </h2>
            {confirmation.learner && (
              <p className="family-confirm-learner">
                <strong>Learner:</strong> {confirmation.learner.name}
              </p>
            )}
            <DeletionTerms learner={!!confirmation.learner} />
          </div>
          <div className="family-actions">
            <button disabled={busy} onClick={() => setConfirmation(null)}>
              Keep these settings
            </button>
            <button
              className="family-danger"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Saving…" : "Delete learning data"}
            </button>
          </div>
          {error && (
            <p role="alert" className="family-error">
              {error}
            </p>
          )}
        </dialog>
      )}
    </Page>
  );
}

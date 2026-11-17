import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { fundedPrograms } from "../../lib/funded-entry";
import { recordPurchaseAction } from "../../lib/purchase-analytics";
import { stateNames } from "../../us-states";
import { Button, buttonClass } from "../../ui/Button";
import { PageSection } from "../../ui/PageSection";
import { TextField } from "../../ui/TextField";
import { TileChoice } from "../../ui/TileChoice";
import { Toast } from "../../ui/Toast";
import { PlanTerms } from "../billing/PlanChoice";
import { emailConsentOptions } from "../billing";
import { InvoicePractice } from "../funding/InvoicePractice";
import {
  fundingOffersOptions,
  fundingPrograms,
  fundingRequestOptions,
  invoiceEmailOptions,
  invoiceFailure,
  money,
  offerInterval,
  startOwnPractice,
  useCreateInvoice,
  useDownloadInvoice,
  useReportSubmitted,
  type FundingOffer,
} from "./api";
import { Panel, Retry } from "./CardPanel";
import { usePay, type PayLearner } from "./context";
import { invoicePath } from "./paths";
import { PlanPicker, useChosenInterval } from "./PlanPicker";
import {
  draftKey,
  useInvoiceDraft,
  useLearnerChoice,
  usePayStore,
} from "./store";
import styles from "./Pay.module.css";

/* ---------- the education-funds tab ---------- */

/** A funding offer in the card plan's shape, so both use one control. */
const asPlan = (offer: FundingOffer): AnnualOffer => ({
  id: offer.id,
  mode: "live",
  currency: "USD",
  amountMinor: offer.totalMinor,
  formattedAmount: money(offer.totalMinor),
  interval: offerInterval(offer),
  learnerCount: 1,
});

/** A program's short name ("Arizona ESA"), else its full one. */
const shortName = (program: { id: string; name: string }) =>
  Object.values(fundedPrograms).find((entry) => entry.id === program.id)?.name ??
  program.name;

/** The learner's name as the invoice's first guess: never a placeholder
 * ("Child 2") and never "Me". */
export const billingNameGuess = (learner: PayLearner) =>
  learner.adult || learner.defaultName || /^Child \d+$/.test(learner.name)
    ? ""
    : learner.name;

/**
 * The education-funds tab, a little wizard on one screen: the plan (the
 * same control and choice as card), the program, the student's name as the
 * program account has it, then Create invoice. Creating it gives the
 * learner access at once and emails the invoice; the invoice's own page
 * then shows how to submit it.
 */
export function EsaPanel() {
  const { session, me, learner } = usePay();
  const offers = useQuery(fundingOffersOptions);
  const choice = useLearnerChoice(session.accountId, learner.id);
  const interval = useChosenInterval();
  const choose = usePayStore((state) => state.choose);
  const key = draftKey(session.accountId, learner.id);
  const typed = useInvoiceDraft((state) => state.names[key]);
  const setName = useInvoiceDraft((state) => state.setName);
  const clearDraft = useInvoiceDraft((state) => state.clear);
  const navigate = useNavigate();
  const create = useCreateInvoice(session, ({ invoiceId }) => {
    clearDraft(key);
    void navigate({ to: invoicePath(learner.id, invoiceId) as never });
  });
  // One key per exact request, so a retry never makes a second invoice.
  const attempt = useRef<{ payload: string; key: string; invoiceId?: string } | null>(
    null,
  );
  if (offers.error) return <Retry error={offers.error} onRetry={() => void offers.refetch()} />;
  if (!offers.data) return <RowsSkeleton rows={4} />;
  const programs = fundingPrograms(offers.data);
  if (!programs.length)
    return <Panel text="No education-funds program is taking invoices right now. Card works today." />;
  // One program needs no choosing.
  const program =
    programs.find((entry) => entry.id === choice.program) ??
    (programs.length === 1 ? programs[0] : undefined);
  const plans = (program ?? programs[0]!).offers;
  const offer = plans.find((entry) => offerInterval(entry) === interval) ?? plans[0]!;
  const email = me.account.email ?? "";
  const name = typed ?? billingNameGuess(learner);
  const own = learner.simulation ? null : learner.id;
  const ready = !!program && !!name.trim() && !!email;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (create.isPending || !program) return;
        const fields = { offer: offer.id, revision: offer.revision, name: name.trim(), email };
        const payload = JSON.stringify(fields);
        if (attempt.current?.payload !== payload)
          attempt.current = { payload, key: crypto.randomUUID() };
        create.mutate(
          {
            offer,
            studentBillingName: fields.name,
            parentEmail: email,
            learnerId: own,
            prepare: () => startOwnPractice(session),
            idempotencyKey: attempt.current.key,
            invoiceId: attempt.current.invoiceId,
            onInvoice: (invoiceId) => {
              if (attempt.current?.payload === payload) attempt.current.invoiceId = invoiceId;
            },
          });
      }}
    >
      <PlanPicker
        offers={plans.map(asPlan)}
        disabled={create.isPending}
        terms={<FundsTerms offer={offer} />}
      />
      <fieldset className={styles.group} disabled={create.isPending}>
        <legend id={`${key}-program`} className={styles.legend}>
          Your program
        </legend>
        <TileChoice
          labelledBy={`${key}-program`}
          className={styles.programs}
          columns={{ narrow: 1, wide: Math.min(programs.length, 3) }}
          value={program?.id ?? null}
          onChange={(id) => {
            if (id) choose(session.accountId, learner.id, { program: id });
          }}
          tiles={programs.map((entry) => ({
            value: entry.id,
            name: entry.name,
            label: (
              <span className={styles.program}>
                <span className={styles.programName}>{shortName(entry)}</span>
                <span className={styles.programMeta}>
                  {entry.statusLabel ?? stateNames[entry.jurisdiction] ?? entry.name}
                </span>
              </span>
            ),
          }))}
        />
      </fieldset>
      <div className={styles.field}>
        <TextField
          label="Student’s name on the invoice"
          value={name}
          onChange={(event) => setName(key, event.target.value)}
          required
          maxLength={180}
          autoComplete="off"
          disabled={create.isPending}
        />
        <p className={styles.hint}>
          As it appears in your {program ? shortName(program) : "program"} account.
        </p>
      </div>
      {learner.learningAllowed === false ? (
        <ConsentFirst />
      ) : (
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          disabled={create.isPending || !ready}
          aria-busy={create.isPending || undefined}
        >
          Create invoice
        </Button>
        <p className={styles.fine}>
          {learner.adult ? "You get" : `${learner.name} gets`} full access as
          soon as it’s created. We email the invoice to {email}.
        </p>
        {/* Reserved: a failure appears here without moving anything. */}
        <p className={styles.error} role="alert">
          {create.error ? invoiceFailure(create.error) : ""}
        </p>
      </div>
      )}
    </form>
  );
}

/**
 * A named child under 13 learns on the parent's verified consent, so an
 * invoice can't start their access until it is given: 16 CFR 312.5(a)(1)
 * (consent before collecting a child's personal information), checked by
 * the server's claim (`purchaseConsentSatisfied`, docs/funded-purchases.md).
 * A program's payment is not a parent's own card, so it can't verify consent
 * the way card checkout does (312.5(b)(2)(ii)). This is shown only where
 * `/me` says the learner can't learn now (`learningAllowed`), in place of an
 * action that would fail, with the step that works.
 */
function ConsentFirst() {
  const { session, learner } = usePay();
  const email = useQuery(emailConsentOptions(session));
  return (
    <div className={styles.actions}>
      <p className={styles.text}>
        Before {learner.name} can learn, confirm you’re their parent.
        {email.data?.available
          ? " It takes one email. Then create the invoice here."
          : " Card checkout confirms it as you pay."}
      </p>
      {email.data?.available && (
        <Link to="/$" params={{ _splat: "consent" }} className={buttonClass("primary")}>
          Confirm by email
        </Link>
      )}
    </div>
  );
}

/** What an invoice buys: one learner, one term, no renewal; when its term
 * starts; and the program's refund terms (docs/funded-purchases.md). */
function FundsTerms({ offer }: { offer: FundingOffer }) {
  const unit = offer.termMonths === 1 ? "month" : "year";
  return (
    <PlanTerms>
      One learner, one {unit}, no automatic renewal.
      {offer.termPolicy?.endsWith("-from-invoice") &&
        ` The ${unit} starts the day you create the invoice.`}
      {offer.refundSummary && ` ${offer.refundSummary}`}
      {offer.refundPolicy === "none" &&
        ` ${offer.programName} doesn’t allow refunds or cancellations.`}
    </PlanTerms>
  );
}

/* ---------- 5. done ---------- */

/** "ClassWallet" for its address, else the program's name. */
export function providerName(url: string, program: string) {
  try {
    return new URL(url).hostname === "app.classwallet.com" ? "ClassWallet" : program;
  } catch {
    return program;
  }
}

/** The program's own submission instructions (the offer's `instructions`,
 * docs/funded-purchases.md), one sentence to a step. Nothing is added. */
export function instructionSteps(instructions: string) {
  return (instructions.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [])
    .map((step) => step.trim())
    .filter(Boolean);
}

const day = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** Whether the invoice's learner has access: the grant, or its pending
 * bridge (docs/funded-purchases.md). */
export function invoiceGivesAccess(
  invoice: { accessStatus?: string; fundedPending?: { status: string } | null } | undefined,
  learner: PayLearner,
) {
  return (
    !!learner.hasAccess ||
    invoice?.accessStatus === "active" ||
    invoice?.fundedPending?.status === "funded-pending"
  );
}

export function InvoiceDone({ invoiceId }: { invoiceId: string }) {
  const { session, me, learner } = usePay();
  const invoice = useQuery(fundingRequestOptions(session, invoiceId));
  const email = useQuery(invoiceEmailOptions(session, invoiceId));
  const download = useDownloadInvoice(session);
  const submitted = useReportSubmitted(session);
  if (invoice.error)
    return <Retry error={invoice.error} onRetry={() => void invoice.refetch()} />;
  if (!invoice.data) return <RowsSkeleton rows={4} />;
  const record = invoice.data;
  const provider = providerName(record.offer.destinationUrl, record.offer.programName);
  const paid = record.paymentStatus === "settled";
  const reported = record.status === "parent-reported-submitted";
  const deadline = record.fundedPending?.endsAt;
  const address = me.account.email;
  return (
    <>
      <div className={styles.lead}>
        <p className={styles.text} role="status">
          {email.data === "sent"
            ? `We emailed the invoice to ${address}.`
            : email.data === "failed"
              ? `The email to ${address} didn’t go through. Download the invoice here instead.`
              : `We’re emailing the invoice to ${address}.`}
        </p>
        <div className={styles.actions}>
          <InvoicePractice
            session={session}
            learnerId={learner.id}
            adult={!!learner.adult}
          />
          <Button
            variant="secondary"
            aria-busy={download.isPending || undefined}
            disabled={download.isPending}
            onClick={() => {
              recordPurchaseAction("document_download");
              download.mutate({ id: record.id, documentPolicy: record.offer.documentPolicy });
            }}
          >
            Download invoice
          </Button>
        </div>
      </div>
      <Toast message={download.error?.message ?? ""} onDismiss={() => download.reset()} />
      <Toast
        message={submitted.error ? "Your submission wasn’t recorded. Try again." : ""}
        onDismiss={() => submitted.reset()}
      />
      <PageSection
        title={
          paid
            ? "Payment received"
            : reported
              ? `Submitted to ${provider}`
              : `Submit it on ${provider}`
        }
      >
        {paid ? (
          <p className={styles.text}>
            {record.offer.programName} paid this invoice. Its receipt is in Billing.
          </p>
        ) : reported ? (
          <p className={styles.text}>
            {record.offer.programName} reviews and pays it.
            {deadline && ` Access continues through ${day(deadline)} while it does.`}{" "}
            Billing shows when it’s paid.
          </p>
        ) : (
          <>
            <ol className={styles.steps}>
              {instructionSteps(record.offer.instructions).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            {deadline && (
              <p className={styles.text}>
                Submit it by <strong>{day(deadline)}</strong> to keep access
                while your program reviews it.
              </p>
            )}
            <div className={styles.actions}>
              <a
                href={record.offer.destinationUrl}
                className={buttonClass("secondary")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordPurchaseAction("funding_provider_open")}
              >
                Open {provider}
              </a>
              <Button
                variant="secondary"
                aria-busy={submitted.isPending || undefined}
                disabled={submitted.isPending}
                onClick={() => submitted.mutate(record.id)}
              >
                I’ve submitted it
              </Button>
            </div>
          </>
        )}
      </PageSection>
    </>
  );
}

/** Rows' place while they load, the size of what replaces them. */
export function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="amp-skeleton" data-part="row" />
      ))}
    </div>
  );
}

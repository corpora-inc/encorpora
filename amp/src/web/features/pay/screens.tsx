import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { licenseChannel, licenseSummary } from "../../family-access";
import { useSettingsHref } from "../spaces/settings-hub";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Sheet } from "../../ui/Sheet";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing";
import { payAddress } from "./address";
import {
  fundingOffersOptions,
  fundingPrograms,
  fundingRequestOptions,
} from "./api";
import { CardDone, useCardOutcome } from "./CardDone";
import { CardPanel } from "./CardPanel";
import {
  usePay,
  usePayClose,
  usePayState,
  type PayContext,
  type PayLearner,
} from "./context";
import {
  EsaPanel,
  InvoiceDone,
  invoiceGivesAccess,
  RowsSkeleton,
} from "./EsaPanel";
import { forWhom, whoName } from "./paths";
import { MethodTabs, useMethod } from "./PlanPicker";
import { usePayStore } from "./store";
import styles from "./Pay.module.css";

/*
 * Paying is an overlay over the screen it was opened from (address.ts): the
 * shared Sheet, beside that screen on a wide screen, over it on a phone.
 * There is no Back: the cross, Escape or the scrim close it, to exactly the
 * screen behind. Its title says what is happening and who it is for; only
 * the body changes. The method tab and the education-funds step are state
 * in the pay store, never an address or a history entry.
 */

const hasFull = (learner: PayLearner) =>
  `${whoName(learner)} ${learner.adult ? "have" : "has"} full access`;

/** The overlay: its title, then its body once the account and learner are
 * known (the sheet is its full height from the start, so nothing moves). */
function PayOverlay({
  title,
  screen,
  children,
}: {
  title: (context: PayContext) => string;
  screen: string;
  children: () => ReactNode;
}) {
  const close = usePayClose();
  const { me, account, learner, ready } = usePayState();
  // Billing at the account's own settings hub, never `/account` for a family.
  const billing = useSettingsHref("billing");
  return (
    <Sheet
      open
      // Choosing a plan fills the sheet from the start, so nothing moves as
      // its panels arrive; a learner who already has access has only their
      // plan to show, and the sheet is its content's size.
      tall={!learner?.hasAccess}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={ready ? title(ready) : " "}
      description={learner ? forWhom(learner) : " "}
    >
      <div className={styles.overlay} data-pay={screen}>
        {ready ? (
          children()
        ) : me.error && !account ? (
          <EmptyState
            title="This didn’t load"
            action={
              <Button variant="primary" onClick={() => void me.refetch()}>
                Try again
              </Button>
            }
          >
            Check your connection, then try again.
          </EmptyState>
        ) : account && !learner ? (
          <EmptyState
            title="This learner isn’t in your account"
            action={
              <Link to={billing as never} className={buttonClass("primary")}>
                Open billing
              </Link>
            }
          >
            Billing lists each of your learners and their plans.
          </EmptyState>
        ) : (
          <RowsSkeleton rows={3} />
        )}
      </div>
    </Sheet>
  );
}

/* ---------- …/pay: choose ---------- */

export function PayScreen() {
  return (
    <PayOverlay
      title={({ learner }) =>
        learner.hasAccess ? "Current plan" : "Choose your plan"
      }
      screen="choose"
    >
      {() => <Choose />}
    </PayOverlay>
  );
}

function Choose() {
  const { me, learner } = usePay();
  if (learner.hasAccess) return <HasAccess />;
  if (me.unassignedPurchase)
    return <UsePaidPlan purchaseId={me.unassignedPurchase.id} />;
  return <Methods />;
}

/**
 * The two ways to pay as tabs of this one overlay. Both panels are drawn in
 * the same place, the one not chosen hidden, so the area is always the
 * taller one's height and switching moves nothing.
 */
function Methods() {
  const offers = useQuery(fundingOffersOptions);
  const funds = fundingPrograms(offers.data ?? []).length > 0;
  // Tabs while the programs load too, so their row never appears late.
  const tabs = funds || offers.isPending;
  const method = useMethod(funds);
  return (
    <>
      {tabs && <MethodTabs />}
      <div className={styles.panels}>
        <section
          className={styles.panelArea}
          aria-label="Card"
          data-method="card"
          data-active={method === "card"}
          inert={method !== "card"}
          aria-hidden={method !== "card"}
        >
          <CardPanel />
        </section>
        {tabs && (
          <section
            className={styles.panelArea}
            aria-label="Education funds"
            data-method="esa"
            data-active={method === "esa"}
            inert={method !== "esa"}
            aria-hidden={method !== "esa"}
          >
            <EsaPanel />
          </section>
        )}
      </div>
    </>
  );
}

/** A learner who already has access: their plan as it is (what it is and
 * its dates), and Billing, where its receipts and changes are. */
function HasAccess() {
  const { learner } = usePay();
  const close = usePayClose();
  const billing = useSettingsHref("billing");
  const access = licenseSummary(learner.access);
  const license = access.license;
  return (
    <div className={styles.panel} data-pay-current="">
      {license ? (
        <dl className={styles.summary}>
          <div>
            <dt>Plan</dt>
            <dd>{licenseChannel(license.channel)}</dd>
          </div>
          <div>
            <dt>{access.kind === "scheduled" ? "Starts" : "Access through"}</dt>
            <dd>
              {longDate(
                access.kind === "scheduled" ? license.startsAt : license.endsAt,
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className={styles.text}>{hasFull(learner)}.</p>
      )}
      <div className={styles.actions}>
        {/* Billing takes this overlay's place over the same settings. */}
        <Link
          to="/$"
          params={{ _splat: billing.slice(1) }}
          replace
          className={buttonClass("primary")}
          data-pay-billing=""
        >
          Manage in Billing
        </Link>
        <Button variant="quiet" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** A plan already paid for that no learner holds yet: it becomes this
 * learner's, never a second checkout. */
function UsePaidPlan({ purchaseId }: { purchaseId: string }) {
  const { session, learner } = usePay();
  const claim = useClaimEnrollment(session);
  const paid = usePayStore((state) => state.paid);
  return (
    <div className={styles.panel}>
      <Toast
        message={claim.error?.message ?? ""}
        onDismiss={() => claim.reset()}
      />
      <p className={styles.text}>
        Your plan is paid and isn’t anyone’s yet. It can be{" "}
        {learner.adult ? "yours" : `${learner.name}’s`}.
      </p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          aria-busy={claim.isPending || undefined}
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(
              { purchaseId, learnerId: learner.id },
              {
                onSuccess: () => paid(session.accountId),
                onError: (error) =>
                  console.error("The paid plan wasn’t assigned", error),
              },
            )
          }
        >
          Use it for {learner.adult ? "your practice" : learner.name}
        </Button>
      </div>
    </div>
  );
}

/* ---------- …/pay/done: back from Stripe ---------- */

export function PayCardDoneScreen() {
  return (
    <PayOverlay
      title={({ learner }) =>
        learner.hasAccess ? hasFull(learner) : "Confirming your payment"
      }
      screen="card-done"
    >
      {() => <CardDoneBody />}
    </PayOverlay>
  );
}
function CardDoneBody() {
  const { session, me, learner } = usePay();
  const { outcome, retry } = useCardOutcome(session, me, learner);
  return <CardDone learner={learner} outcome={outcome} retry={retry} />;
}

/* ---------- …/pay/invoice/<invoice> ---------- */

export function PayInvoiceScreen() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const address = payAddress(pathname);
  const invoiceId =
    address?.view.kind === "invoice" ? address.view.invoiceId : "";
  // The title follows the same cached record the body reads.
  const { session } = usePayState();
  const record = useQuery({
    ...fundingRequestOptions(
      session ?? { accountId: "", token: "" },
      invoiceId,
    ),
    enabled: !!session && !!invoiceId,
  }).data;
  return (
    <PayOverlay
      title={({ learner }) =>
        invoiceGivesAccess(record, learner)
          ? `${hasFull(learner)} now`
          : "Your invoice is ready"
      }
      screen="invoice"
    >
      {() => <InvoiceDone invoiceId={invoiceId} />}
    </PayOverlay>
  );
}

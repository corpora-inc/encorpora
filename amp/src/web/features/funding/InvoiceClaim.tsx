import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { continuationSearch, type FundedProgram } from "../../lib/funded-entry";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import { TileChoice } from "../../ui/TileChoice";
import { useStartOwnPractice } from "../me/api";
import styles from "./InvoiceClaim.module.css";
const invoicesSchema = z.object({
  invoices: z.array(
    z.object({
      id: z.string(),
      studentBillingName: z.string(),
      state: z.enum(["prepared", "claimed", "cancelled"]),
      expiresAt: z.string(),
      offer: z.object({ programId: z.string() }),
    }),
  ),
});
/** The account holder's own learner, before it exists: started on use. */
const NEW_OWN = "own:new";

/**
 * Connects an invoice made out before sign-in to a learner: the account
 * holder's own ("Me", started here if she has none yet) or one of her
 * children. Buying for herself needs no parental consent; a child does, so a
 * child chosen without it leads to the consent step instead of a claim that
 * would fail. With no invoice waiting and no learner at all, it asks who's
 * learning first.
 */
export function InvoiceClaim({
  session,
  program,
  learners,
  own,
  consentActive,
  preferredLearnerId,
  children,
}: {
  session: AuthSession;
  program: FundedProgram;
  /** The account's children. */
  learners: readonly { id: string; name: string }[];
  /** The account holder's own adult learner, when she has one. */
  own: { id: string } | null;
  consentActive: boolean;
  preferredLearnerId?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const search = {
    ...continuationSearch(location.search),
    return: program.slug,
  };
  const invoices = useQuery({
    queryKey: ["account", session.accountId, "invoice-intents"],
    queryFn: ({ signal }) =>
      request("/funding/invoices", invoicesSchema, {
        token: session.token,
        signal,
      }),
  });
  const startOwn = useStartOwnPractice(session);
  const choices = [
    { value: own?.id ?? NEW_OWN, label: "Me" },
    ...learners.map((l) => ({ value: l.id, label: l.name })),
  ];
  const [learner, setLearner] = useState(
    choices.find((c) => c.value === preferredLearnerId)?.value ??
      (choices.length === 1 ? choices[0]!.value : ""),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Once started, "Me" is the account holder's learner itself.
  const value = learner === NEW_OWN && own ? own.id : learner;
  const forChild = learners.some((l) => l.id === value);
  const needsConsent = forChild && !consentActive;
  const pending =
    invoices.data?.invoices.filter(
      (i) => i.offer.programId === program.id && i.state === "prepared",
    ) ?? [];
  if (invoices.isPending)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <p role="status">Checking your invoices…</p>
        </section>
      </PageFrame>
    );
  if (invoices.error)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <p>Your invoices could not be loaded.</p>
          <Button onClick={() => void invoices.refetch()}>Try again</Button>
        </section>
      </PageFrame>
    );
  /** The chosen learner's id, starting the account holder's own if needed. */
  const chosen = async () =>
    value === NEW_OWN ? startOwn.mutateAsync(undefined) : value;
  const consentLink = (
    <Link
      to="/start/consent"
      search={search}
      className={buttonClass("primary")}
    >
      Continue to parent consent
    </Link>
  );
  if (!pending.length) {
    if (own || learners.length) return children;
    // No invoice and no learner yet: who is this for?
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <h1>Who’s learning?</h1>
          <p>
            Buy {program.name} access for yourself, or for your child. A child
            needs a parent’s consent first.
          </p>
          <div className={styles.who}>
            <Button
              variant="primary"
              disabled={startOwn.isPending}
              aria-busy={startOwn.isPending || undefined}
              onClick={() =>
                startOwn.mutate(undefined, {
                  onError: (reason) => {
                    console.error("Own learner did not start", reason);
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Your learner didn’t start. Try again.",
                    );
                  },
                })
              }
            >
              For me
            </Button>
            <Link
              to={consentActive ? "/start/name" : "/start/consent"}
              search={search}
              className={buttonClass("secondary")}
            >
              For my child
            </Link>
          </div>
          <p role="alert">{error}</p>
        </section>
      </PageFrame>
    );
  }
  return (
    <PageFrame centered>
      <section className={frameCard}>
        <h1>Connect your invoice</h1>
        <p id="invoice-learner">
          Who is this {program.name} invoice for? This does not make another
          payment.
        </p>
        <TileChoice
          className={styles.choices}
          labelledBy="invoice-learner"
          tiles={choices}
          value={value || null}
          onChange={(next) => {
            setError("");
            if (next) setLearner(next);
          }}
          columns={{ narrow: 2, wide: 3 }}
          disabled={busy}
        />
        {pending.map((invoice) => (
          <div key={invoice.id}>
            <h2>{invoice.studentBillingName}</h2>
            {Date.parse(invoice.expiresAt) <= Date.now() ? (
              <p>
                This invoice needs a billing review. Contact support with
                invoice {invoice.id}; do not pay again.
              </p>
            ) : needsConsent ? (
              consentLink
            ) : (
              <Button
                disabled={busy || !value}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const learnerId = await chosen();
                    await request(
                      `/funding/invoices/${invoice.id}/claim`,
                      z.object({ id: z.string() }),
                      { token: session.token, body: { learnerId } },
                    );
                    await invoices.refetch();
                  } catch (reason) {
                    console.error("Invoice claim failed", reason);
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "The invoice could not be connected. Try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Connecting…" : "Use this invoice"}
              </Button>
            )}
            <Button
              variant="quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await request(
                    `/funding/invoices/${invoice.id}/discard`,
                    z.object({ discarded: z.boolean() }),
                    { token: session.token, body: { notSubmitted: true } },
                  );
                  await invoices.refetch();
                } catch (reason) {
                  console.error("Invoice discard failed", reason);
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "The invoice could not be discarded.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Not submitted? Discard this invoice
            </Button>
          </div>
        ))}
        <p role="alert">{error}</p>
        <Link to="/">Back to practice</Link>
      </section>
    </PageFrame>
  );
}

import { useState } from "react";
import { z } from "zod";
import { request } from "../../lib/api";
import { invalidateAccount } from "../../lib/query";
import { reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { DeletionTerms } from "./LearningData";
import styles from "./Privacy.module.css";

const receiptSchema = z.object({
  deletedLearners: z.number(),
  retainedBillingReferences: z.number(),
  billingManagementRequired: z.boolean(),
  consentWithdrawn: z.boolean(),
});
type Receipt = z.infer<typeof receiptSchema>;

/** What the server removed and kept, said once it is done. */
function receiptText(receipt: Receipt) {
  return [
    `${receipt.deletedLearners} learner ${receipt.deletedLearners === 1 ? "history was" : "histories were"} removed.`,
    receipt.retainedBillingReferences
      ? "Payment records remain, including any student name on an invoice."
      : "",
    receipt.consentWithdrawn ? "Consent is withdrawn." : "",
    receipt.billingManagementRequired
      ? "A plan may still renew: check it in Billing."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Delete learning data: what goes and what stays (DeletionTerms), then one
 * red button. The panel is the confirmation: the words are read before the
 * one action, with no dialog, typed word or second click.
 *
 * Requirement: a parent may refuse further use and maintenance of their
 * child's information and direct its deletion (COPPA, 16 CFR 312.6(a)(2)),
 * and a consumer may request deletion (CCPA, Cal. Civ. Code 1798.105).
 * `confirmation: "delete-learning-data"` is the API's own guard against a
 * stray call (src/family/routes.ts), not a step for the person.
 *
 * With `learner`, one child's data (their settings); otherwise everything
 * the account's learners hold (`family`: it has children), which also
 * withdraws consent.
 */
export function LearningDataDelete({
  learner,
  family = false,
  onDeleted,
}: {
  learner?: { id: string; name: string };
  family?: boolean;
  /** Runs before the account refreshes: a child's page leaves first. */
  onDeleted?: () => Promise<unknown> | void;
}) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const receipt = await request(
        learner
          ? `/family/learners/${encodeURIComponent(learner.id)}/delete-learning-data`
          : "/family/delete-learning-data",
        receiptSchema,
        {
          token: session.token,
          body: { confirmation: "delete-learning-data" },
        },
      );
      setDone(receiptText(receipt));
      await onDeleted?.();
      await invalidateAccount(session.accountId);
    } catch (failure) {
      setError(
        reportError(failure, {
          doing: "delete learning data",
          fallback: "Nothing was deleted. Try again.",
          details: { learner: learner?.id ?? "all" },
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  if (done)
    return (
      <div className={styles.panel} data-privacy-panel-body="delete">
        <p className={styles.prose} role="status" data-delete-done="">
          {done}
        </p>
      </div>
    );
  return (
    <div className={styles.panel} data-privacy-panel-body="delete">
      {!learner && (
        <p className={styles.prose}>
          {family
            ? "Removes every learner’s name, saved problems and answers from AMP."
            : "Removes your saved problems and answers from AMP."}
        </p>
      )}
      <DeletionTerms learner={!!learner} className={styles.prose} />
      <div className={styles.actions}>
        <Button
          variant="secondary"
          className={styles.danger}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void remove()}
          data-delete-learning=""
        >
          {learner
            ? `Delete ${learner.name}’s learning data`
            : "Delete learning data"}
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

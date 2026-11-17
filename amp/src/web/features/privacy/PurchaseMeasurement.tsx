import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  measurementNotice,
  type AdvertisingProvider,
  purchaseMeasurementSchema,
  currentMeasurementNotice,
  type PurchaseMeasurement as View,
  type PermissionChange,
} from "../../../advertising/permission-contracts";
import { request } from "../../lib/api";
import { refreshMe } from "../../lib/query";
import { useSession } from "../../lib/session";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import styles from "./Privacy.module.css";

const POLICY: Record<AdvertisingProvider, { name: string; url: string }> = {
  google: { name: "Google", url: "https://policies.google.com/privacy" },
  meta: { name: "Meta", url: "https://www.facebook.com/privacy/policy/" },
  openai: { name: "OpenAI", url: "https://openai.com/policies/privacy-policy/" },
};

/** The browser's Global Privacy Control signal. */
const globalPrivacyControl = () =>
  typeof navigator !== "undefined" &&
  (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true;

/**
 * One advertising recipient's purchase sharing: its notice, its state, and
 * the switch.
 *
 * Requirements:
 * - Sharing personal information for cross-context advertising can be
 *   refused at any time (CCPA, Cal. Civ. Code 1798.120(a)), and the notice
 *   says so before it happens (1798.120(b), 1798.135(a)).
 * - A Global Privacy Control signal is a valid opt-out of sale and sharing
 *   (Cal. Civ. Code 1798.135(e); 11 CCR 7025(b)-(c); and the same in the
 *   states whose laws name universal opt-out signals, e.g. Colo. Rev. Stat.
 *   6-1-1306(1)(a)(IV)). With the signal on, AMP records it as a withdrawal
 *   and offers no way to allow sharing.
 * - Allowing again is an adult's own opt-in for their own email (1798.120(c)
 *   forbids sharing a minor's information without it): the attestation.
 */
export function PurchaseMeasurement({
  view,
  provider = "google",
}: {
  view: View;
  provider?: AdvertisingProvider;
}) {
  const session = useSession();
  const notice = measurementNotice(provider);
  const [agreed, setAgreed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const optedOut = globalPrivacyControl();
  const mutation = useMutation({
    mutationKey: ["account", session.accountId, "purchase-measurement", provider],
    mutationFn: (body: PermissionChange) =>
      request(
        provider === "openai"
          ? "/family/openai-purchase-measurement"
          : provider === "meta"
            ? "/family/meta-purchase-measurement"
            : "/family/purchase-measurement",
        purchaseMeasurementSchema,
        { token: session.token, body },
      ),
    onSuccess: (result) => {
      setAgreed(false);
      setFeedback(
        result.status === "active"
          ? "Purchase measurement is allowed."
          : "Purchase sharing is off.",
      );
    },
    onError: (error) => {
      console.error(`The ${provider} purchase-sharing choice didn’t save`, error);
      setFeedback("");
    },
    onSettled: () => refreshMe(session),
  });
  // The signal is recorded once per showing: an opt-out request the
  // business must honour (11 CCR 7025(c)(1)), not a preference to ask about.
  const { mutate } = mutation;
  const privacySignalRecorded = useRef(false);
  useEffect(() => {
    if (optedOut && !privacySignalRecorded.current) {
      privacySignalRecorded.current = true;
      mutate({ action: "withdraw" });
    }
  }, [optedOut, mutate]);
  const active = view.status === "active";
  const matchingNotice = currentMeasurementNotice(view) === notice.version;
  const offerAllow = !active && view.eligible && !optedOut && matchingNotice;
  return (
    <section className={styles.provider} data-purchase-measurement={provider}>
      <h3 className={styles.providerTitle}>{notice.title}</h3>
      <p className={styles.prose}>{notice.purpose}</p>
      <p className={styles.prose}>{notice.disclosure}</p>
      <p className={styles.prose}>{notice.boundary}</p>
      <p className={styles.prose}>{notice.choice}</p>
      <p className={styles.prose}>
        {notice.retention}{" "}
        <a href={POLICY[provider].url} target="_blank" rel="noopener noreferrer">
          {POLICY[provider].name} privacy policy
        </a>
      </p>
      <p className={styles.prose} data-measurement-status={view.status}>
        <strong>
          {active
            ? "Allowed"
            : view.status === "expired"
              ? "Expired"
              : view.status === "review-required"
                ? "Review required"
                : "Off"}
        </strong>
        {active && view.expiresAt && view.expiresAt < "9000"
          ? ` until ${new Date(view.expiresAt).toLocaleDateString()}.`
          : "."}
      </p>
      {optedOut && (
        <p className={styles.prose} data-global-privacy-control="">
          Your browser sends Global Privacy Control, so AMP keeps purchase
          sharing off.
        </p>
      )}
      {!matchingNotice && (
        <p className={styles.prose}>
          Reload to review the current purchase-sharing notice. You can always
          withdraw permission.
        </p>
      )}
      {!view.eligible && (
        <p className={styles.prose}>
          A confirmed AMP account email is required to allow sharing. You can
          always withdraw an existing preference.
        </p>
      )}
      {offerAllow && (
        <Checkbox
          checked={agreed}
          disabled={mutation.isPending}
          onChange={setAgreed}
        >
          {notice.attestation}
        </Checkbox>
      )}
      <div className={styles.actions}>
        {offerAllow && (
          <Button
            variant="primary"
            disabled={!agreed || mutation.isPending}
            onClick={() =>
              mutate({
                action: "allow",
                revision: view.revision,
                noticeVersion: notice.version,
                adultAttestation: true,
              })
            }
          >
            Allow purchase measurement
          </Button>
        )}
        {(active ||
          view.status === "review-required" ||
          view.status === "expired") && (
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => mutate({ action: "withdraw" })}
          >
            Withdraw permission
          </Button>
        )}
      </div>
      <p
        className={`${styles.result} ${mutation.error ? styles.error : styles.quiet}`}
        role="status"
        aria-live="polite"
      >
        {mutation.isPending
          ? "Saving your preference…"
          : mutation.error instanceof Error
            ? mutation.error.message
            : feedback}
      </p>
    </section>
  );
}

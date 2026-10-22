import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  PURCHASE_MEASUREMENT_NOTICE as notice,
  purchaseMeasurementSchema,
  type PurchaseMeasurement as View,
  type PermissionChange,
} from "../../../advertising/permission-contracts";
import { request } from "../../lib/api";
import { refreshMe } from "../../lib/query";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";

export function PurchaseMeasurement({
  view,
  token,
  identity,
}: {
  view: View;
  token: string;
  identity: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const optedOut =
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true || navigator.doNotTrack === "1";
  const mutation = useMutation({
    mutationKey: ["account", identity, "purchase-measurement"],
    mutationFn: (body: PermissionChange) =>
      request("/family/purchase-measurement", purchaseMeasurementSchema, {
        token,
        body,
        headers: optedOut ? { DNT: "1" } : undefined,
      }),
    onSuccess: (result) => {
      setAgreed(false);
      setFeedback(
        result.status === "active"
          ? "Purchase measurement is allowed."
          : "Purchase sharing is off.",
      );
    },
    onError: () => setFeedback(""),
    onSettled: () => refreshMe({ accountId: identity, token }),
  });
  const privacySignalRecorded = useRef(false);
  useEffect(() => {
    if (optedOut && !privacySignalRecorded.current) {
      privacySignalRecorded.current = true;
      mutation.mutate({ action: "withdraw" });
    }
  }, [optedOut]);
  const active = view.status === "active";
  return (
    <section className="family-section" data-purchase-measurement>
      <h2 tabIndex={-1}>{notice.title}</h2>
      <p>{notice.purpose}</p>
      <p>{notice.disclosure}</p>
      <p>{notice.boundary}</p>
      <p>{notice.choice}</p>
      <p>
        {notice.retention}{" "}
        <a
          style={{ color: "var(--color-primary)" }}
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google privacy policy
        </a>
      </p>
      <p>
        <strong>
          {active
            ? "Allowed"
            : view.status === "expired"
              ? "Expired"
              : view.status === "review-required"
                ? "Review required"
                : "Off"}
        </strong>
        {active && view.expiresAt
          ? ` until ${new Date(view.expiresAt).toLocaleDateString()}.`
          : "."}
      </p>
      {optedOut && (
        <p>
          Your browser requests privacy protection. AMP will save that choice as
          a withdrawal.
        </p>
      )}
      {!view.eligible && (
        <p>
          A confirmed AMP account email is required to allow sharing. You can
          always withdraw an existing preference.
        </p>
      )}
      {!active && view.eligible && !optedOut && (
        <Checkbox
          checked={agreed}
          disabled={mutation.isPending}
          onChange={setAgreed}
        >
          {notice.attestation}
        </Checkbox>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginTop: "1rem",
        }}
      >
        {!active && view.eligible && !optedOut && (
          <Button
            disabled={!agreed || mutation.isPending}
            onClick={() =>
              mutation.mutate({
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
            onClick={() => mutation.mutate({ action: "withdraw" })}
          >
            Withdraw permission
          </Button>
        )}
      </div>
      <div
        style={{ minHeight: "3.5rem", marginTop: "0.75rem" }}
        role="status"
        aria-live="polite"
      >
        {mutation.isPending
          ? "Saving your preference…"
          : mutation.error instanceof Error
            ? mutation.error.message
            : feedback}
      </div>
    </section>
  );
}

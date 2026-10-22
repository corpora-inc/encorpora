import { useEffect } from "react";
import type { AuthSession } from "../../auth";
import type { PurchaseMeasurement } from "../../../advertising/permission-contracts";
import {
  META_PURCHASE_MEASUREMENT_NOTICE,
  currentMeasurementNotice,
} from "../../../advertising/permission-contracts";
import { metaContextResultSchema } from "../../../advertising/meta-context-contracts";
import { AppError } from "../../lib/AppError";
import { nativeRuntime } from "../../native-runtime";

/** Only the adult payment-confirmation screen calls this. A local request,
 * never a Meta browser SDK; server-owned payment evidence is authoritative. */
export function useMetaPurchaseContext(
  session: AuthSession,
  checkoutId: string | undefined,
  phase: string | undefined,
  permission: PurchaseMeasurement | undefined,
  returnedFrom: string | null,
  returned: string | null,
) {
  const active =
    permission?.status === "active" &&
    currentMeasurementNotice(permission) ===
      META_PURCHASE_MEASUREMENT_NOTICE.version;
  useEffect(() => {
    if (
      nativeRuntime ||
      !active ||
      !checkoutId ||
      phase !== "paid" ||
      returned !== "processing" ||
      returnedFrom !== checkoutId ||
      location.pathname !== "/start/purchase" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl === true ||
      navigator.doNotTrack === "1"
    )
      return;
    // Let this small, account-bound request finish when the parent continues
    // to learner setup. Its response never updates account or learner state.
    let observing = true;
    void fetch("/api/v1/advertising/meta/purchase-context", {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ checkoutId }),
    })
      .then(async (response) => {
        if (!observing) return;
        if (
          !response.ok ||
          !metaContextResultSchema.safeParse(await response.json()).success
        )
          throw new Error("unavailable");
      })
      .catch(() => {
        if (observing)
          new AppError(
            "unavailable",
            "Purchase measurement could not be prepared.",
            true,
          ).log();
      });
    return () => {
      observing = false;
    };
  }, [
    session.accountId,
    session.token,
    checkoutId,
    phase,
    active,
    permission?.revision,
    returnedFrom,
    returned,
  ]);
}

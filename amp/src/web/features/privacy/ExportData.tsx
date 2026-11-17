import { useState } from "react";
import { reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { downloadAccountData } from "./export";
import styles from "./Privacy.module.css";

/**
 * Download your data: one button, one file.
 *
 * Requirement: a parent may review the personal information collected from
 * their child (COPPA, 16 CFR 312.6(a)(3)), and a consumer may know and
 * receive the personal information collected about them (CCPA, Cal. Civ.
 * Code 1798.110 and 1798.130(a)(2)). One click, no confirmation: reading
 * your own data changes nothing.
 */
export function ExportData({ family }: { family: boolean }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadAccountData(session, () => {
        setRequested(false);
        setError(
          reportError(new Error("The export frame received an error page"), {
            doing: "download the account's data",
            fallback:
              "The download didn’t finish. Download again for a fresh file.",
          }),
        );
      });
      setRequested(true);
    } catch (cause) {
      setError(
        reportError(cause, {
          doing: "download the account's data",
          fallback: "The download didn’t start. Try again.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.panel} data-privacy-panel-body="export">
      <p className={styles.prose}>
        One NDJSON file with {family ? "your learners’" : "your"} problems and
        answers, plans, orders and privacy activity.
      </p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void download()}
          data-privacy-export=""
        >
          {family ? "Download family data" : "Download your data"}
        </Button>
      </div>
      {/* Its line is reserved, so what happened appears without moving. */}
      <p
        className={`${styles.result} ${error ? styles.error : styles.quiet}`}
        role={error ? "alert" : "status"}
      >
        {error ||
          (requested
            ? "Download requested. Check your browser’s downloads."
            : "")}
      </p>
    </div>
  );
}

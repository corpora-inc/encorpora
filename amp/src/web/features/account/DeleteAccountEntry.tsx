import { Link } from "@tanstack/react-router";
import { Chevron } from "./BillingList";
import pages from "./AccountPages.module.css";

/** Account → Sign-in's last row: "Delete my account", which opens its own
 * screen (`/family/security/delete`). `continues` when it follows Sign-in's
 * own rows, so one hairline sits between them. */
export function DeleteAccountEntry({
  continues = false,
}: {
  continues?: boolean;
}) {
  return (
    <ul
      className={`${pages.list} ${continues ? pages.continues : ""}`}
      aria-label="Your account"
    >
      <li className={pages.linkItem}>
        <Link
          to="/family/security/delete"
          className={pages.linkRow}
          data-delete-account-entry
        >
          <span className={pages.rowText}>
            <span className={`${pages.rowTitle} ${pages.danger}`}>
              Delete my account
            </span>
            <span className={pages.rowMeta}>
              Your account, learners and practice, for good
            </span>
          </span>
          <Chevron />
        </Link>
      </li>
    </ul>
  );
}

import { dropAllCapabilities } from "../../capability-entry";
import { rememberApproval } from "../family-approval/api";
import { forgetInvite } from "../school/paths";

/**
 * Every invitation or approval this device holds goes: this page's memory,
 * and the carry a sign-in started from a link keeps (`rememberInvite`,
 * `rememberApproval`). For an account that signs out or changes, and for a
 * child's session beginning or ending on the device. A sign-in that a
 * link itself started (no account before it) keeps its carry: that is the
 * continuation it was kept for.
 */
export function forgetEveryLink() {
  dropAllCapabilities();
  forgetInvite();
  rememberApproval(null);
}

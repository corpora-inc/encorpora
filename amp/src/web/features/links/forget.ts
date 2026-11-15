import { dropAllCapabilities } from "../../capability-entry";
import { forgetCarries } from "../../lib/link-carry";
import { approvalSignup } from "../family-approval/api";
import { markSchoolSignup } from "../school/paths";

/**
 * Every invitation or approval this device holds goes: this page's memory,
 * and the carry a sign-in started from a link keeps (`lib/link-carry.ts`),
 * with its proof for account creation. For an account that signs out or
 * changes, and for a child's session beginning or ending on the device.
 * Only "Use another account" from the link itself survives this exit, and
 * only this one. A sign-in that a link itself started (no account before
 * it) keeps its carry: that is the continuation it was kept for.
 */
export function forgetEveryLink() {
  dropAllCapabilities();
  const kept = forgetCarries();
  if (!kept.includes("/school/invite")) markSchoolSignup(null);
  if (!kept.includes("/family/approve")) approvalSignup(null);
}

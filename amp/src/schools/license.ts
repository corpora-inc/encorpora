/** A school exists once we issue it a license: `scripts/school-admin.ts`
 * `create-school` makes the org, the license and its admin's setup invitation
 * together. `set-seats`, `extend-license` and `issue-license` change it after. */
export const INVITE_DAYS = 30;
/** Mail a school can send through us in a day. Past this an invitation still
 * stands, with its link to copy, so a school can't be a mail relay. */
export const INVITE_MAILS_PER_DAY = 200;
export const SEAT_REQUESTS_PER_HOUR = 5;
/** The company mailbox "Request more seats" writes to. */
export const SEAT_REQUEST_MAILBOX = "support@corpora.inc";

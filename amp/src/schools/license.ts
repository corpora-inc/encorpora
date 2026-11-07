/** What self-serve setup starts with. `scripts/school-admin.ts` changes a
 * school's license afterwards: `set-seats`, `extend-license`, `issue-license`. */
export const EVALUATION_SEATS = 30;
export const EVALUATION_DAYS = 30;
/** How many schools one account can set up on its own. Past this, an operator
 * creates them. */
export const SELF_SERVE_ORG_LIMIT = 5;
export const INVITE_DAYS = 30;
/** Mail a school can send through us in a day. Past this an invitation still
 * stands, with its link to copy, so a free evaluation can't be a mail relay. */
export const INVITE_MAILS_PER_DAY = 200;
export const SEAT_REQUESTS_PER_HOUR = 5;
/** The company mailbox "Request more seats" writes to. */
export const SEAT_REQUEST_MAILBOX = "support@corpora.inc";

/** How WebKit reports a request cut off by leaving the page (an unhandled
 * rejection from a fetch the next document cancelled). It is no failure of
 * the page that was left. */
export const CANCELLED_BY_NAVIGATION = /due to access control checks/;

/** A response that arrived after the parent's sign-in changed (sign-out,
 * another account, an expired session replaced). It belongs to an account
 * that is no longer on screen: callers discard it; it is not a failure. */
export class AccountSessionChanged extends Error {
  constructor() {
    super("Your account session changed.");
    this.name = "AccountSessionChanged";
  }
}

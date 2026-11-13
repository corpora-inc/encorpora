import type { AuthSession } from "../../../auth";
import { connectionApi } from "./api";

/** Links a Clever sign-in to this AMP account: Clever's own page confirms
 * it, then comes back. A refusal is thrown for the caller to say in place. */
export async function linkClever(session: AuthSession) {
  const next = await connectionApi.link(session);
  window.location.assign(next.url);
}

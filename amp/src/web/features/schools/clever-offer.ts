import type { AuthConfig } from "../../auth";
import { cleverEnabled } from "../school/clever/enabled";

/** Whether `/schools` offers "Use Clever". Until the sign-in methods are
 * known, or if they can't be read, it does: Clever is on in production.
 * `/school/connect` reads them itself: with Clever it connects, without it
 * opens class setup, and if they still can't be read it says so with a way
 * to try again. Only a deployment that says Clever is off goes without it. */
export const offersClever = (config: AuthConfig | undefined) =>
  !config || cleverEnabled(config);

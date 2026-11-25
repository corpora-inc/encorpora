import type { AuthConfig } from "../../auth";
import { cleverEnabled } from "../school/clever/enabled";

/** Whether `/schools` offers "Use Clever". Until the sign-in methods answer,
 * or if they can't be read, it does: Clever is on in production, and
 * `/school/connect` reads the methods itself and, without Clever, opens class
 * setup, so the link never leads nowhere. Only a deployment that says Clever
 * is off goes without it. */
export const offersClever = (config: AuthConfig | undefined) =>
  !config || cleverEnabled(config);

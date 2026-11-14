import type { AuthConfig } from "../../../auth";

/** Whether Clever is on for this deployment. Every Clever entry point asks,
 * so with Clever off a person sees no trace of it. */
export const cleverEnabled = (config: AuthConfig | undefined) =>
  config?.mode === "accounts" && !!config.clever;

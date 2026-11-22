import { z } from "zod";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import type { PilotInterest } from "../../../research/pilot";

const messages: Record<string, string> = {
  too_many_requests: "Too many sign-ups from here just now. Try again later.",
  invalid_pilot_signup: "Check the details and try again.",
  pilot_signup_unavailable: "That didn’t save. Try again in a minute.",
  request_origin_invalid: "Reload the page and try again.",
};

/** The pilot interest list on `/research/pilot`. */
export async function joinPilotList(signup: PilotInterest) {
  try {
    await request("/research/pilot", z.unknown(), { body: signup });
  } catch (error) {
    const code = error instanceof AppError ? (error.code ?? "") : "";
    throw new AppError(
      error instanceof AppError ? error.kind : "network",
      messages[code] ??
        (error instanceof AppError
          ? error.message
          : "That didn’t send. Check your connection and try again."),
      true,
    );
  }
}

import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { requestWith } from "../../lib/request-transport";

const ticketSchema = z.object({ ticket: z.string() });

/**
 * Downloads the account's data (`POST /family/export`): one NDJSON file
 * with the learners' problems and answers, plans, orders and privacy
 * activity. A one-time ticket authorizes the browser's own streaming POST,
 * which a hidden frame receives, so the file saves as an attachment and the
 * app stays where it is.
 *
 * Resolves once the browser has been asked to download. `onFailed` runs if
 * the frame then receives an error document instead of the attachment.
 */
export async function downloadAccountData(
  session: AuthSession,
  onFailed: () => void,
) {
  const { ticket } = await request("/family/export-ticket", ticketSchema, {
    token: session.token,
    body: {},
  });
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket))
    throw new AppError(
      "contract",
      "The download couldn’t be prepared. Try again.",
      true,
    );
  const frame = document.createElement("iframe");
  frame.name = `family-download-${crypto.randomUUID()}`;
  frame.title = "Data download";
  frame.hidden = true;
  frame.onload = () => {
    // An attachment leaves the frame blank. A failed request returns an
    // error document here instead of replacing the application.
    if (frame.contentDocument?.body.textContent?.trim()) onFailed();
  };
  const form = document.createElement("form"),
    field = document.createElement("input");
  form.hidden = true;
  form.method = "POST";
  form.action = "/api/v1/family/export";
  form.target = frame.name;
  field.type = "hidden";
  field.name = "ticket";
  field.value = ticket;
  form.append(field);
  // The ticket request and the browser's streaming POST are separate sends;
  // a sign-in renewal can begin between them. Gate the actual submission.
  await requestWith(
    async () => {
      document.body.append(frame, form);
      try {
        form.submit();
      } finally {
        form.remove();
        setTimeout(() => frame.remove(), 120_000);
      }
    },
    { token: session.token, method: form.method },
  );
}

import { createHash } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";
import type {
  ConsentPolicy,
  ConsentTransport,
  ConsentMail,
  DeliveryResult,
} from "./contracts.js";

const senderSchema = z
  .email()
  .max(254)
  .refine((v) => !/[\r\n]/.test(v));
export interface ResendConfiguration {
  apiKey: string;
  sender: string;
}
/** No constructor sends mail. The worker is the sole external-send entry point. */
export function resendConfiguration(
  env: NodeJS.ProcessEnv,
  policy: ConsentPolicy | null,
): ResendConfiguration | null {
  if (
    env.AMP_CONSENT_DELIVERY === undefined ||
    env.AMP_CONSENT_DELIVERY === "disabled"
  )
    return null;
  if (env.AMP_CONSENT_DELIVERY !== "resend")
    throw new Error("Unsupported consent delivery provider");
  if (env.NODE_ENV !== "production")
    throw new Error("Real consent delivery requires production runtime");
  if (env.AMP_CONSENT_RESEND_TRACKING_DISABLED !== "true")
    throw new Error("Consent delivery requires disabled tracking confirmation");
  const apiKey = env.AMP_CONSENT_RESEND_API_KEY;
  if (!apiKey || !/^re_[A-Za-z0-9_-]{16,200}$/.test(apiKey))
    throw new Error("Consent delivery credential is missing or invalid");
  const sender = senderSchema.safeParse(env.AMP_CONSENT_SENDER);
  if (!sender.success)
    throw new Error("Consent delivery sender is missing or invalid");
  if (!policy?.notice.processors.some((p) => p.name === "Resend"))
    throw new Error(
      "Consent notice must disclose the configured mail processor",
    );
  return { apiKey, sender: sender.data };
}

export class ResendConsentTransport implements ConsentTransport {
  readonly binding: ConsentTransport["binding"];
  private readonly client: Resend;
  private readonly config: Readonly<ResendConfiguration>;
  constructor(config: ResendConfiguration) {
    this.config = Object.freeze({ ...config });
    // SDK development logging includes raw API errors. Never construct a real
    // adapter in that mode or inherit an environment-controlled API endpoint.
    if (process.env.NODE_ENV !== "production")
      throw new Error("Real consent delivery requires production runtime");
    this.client = new Resend(config.apiKey, {
      baseUrl: "https://api.resend.com",
      userAgent: "amp-consent-delivery/1",
    });
    this.binding = Object.freeze({
      provider: "resend",
      sender: config.sender,
      credentialFingerprint: createHash("sha256")
        .update(config.apiKey)
        .digest("hex"),
    });
  }
  async send(
    mail: ConsentMail,
    options: { signal: AbortSignal },
  ): Promise<DeliveryResult> {
    if (process.env.NODE_ENV !== "production" || options.signal.aborted)
      return { kind: "unknown" };
    try {
      // The SDK spreads options into fetch RequestInit. Its public typing exposes
      // signal but omits redirect; this local intersection pins redirect behavior.
      const requestOptions = {
        idempotencyKey: mail.idempotencyKey,
        signal: options.signal,
        redirect: "error" as const,
      };
      const result = await this.client.emails.send(
        {
          from: this.config.sender,
          to: [mail.recipient],
          subject: mail.subject,
          text: mail.text,
        },
        requestOptions,
      );
      if (
        result.data &&
        typeof result.data.id === "string" &&
        z.uuid().safeParse(result.data.id).success
      )
        return { kind: "accepted", receipt: result.data.id };
      const name = result.error?.name;
      if (name === "invalid_idempotent_request") return { kind: "conflict" };
      // Only documented definitive validation/authorization failures are treated
      // as rejection. Unknown provider messages and all network failures stay unknown.
      if (
        name &&
        [
          "validation_error",
          "missing_required_field",
          "invalid_parameter",
          "invalid_api_key",
          "missing_api_key",
          "restricted_api_key",
          "not_found",
        ].includes(name)
      )
        return { kind: "rejected" };
      return { kind: "unknown" };
    } catch {
      return { kind: "unknown" };
    }
  }
}

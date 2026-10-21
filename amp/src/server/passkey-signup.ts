import type { AuthContext } from "@better-auth/core";
import {
  getCurrentAdapter,
  runWithTransaction,
} from "@better-auth/core/context";
import { base64 } from "@better-auth/utils/base64";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  APIError,
  createAuthEndpoint,
  createEmailVerificationToken,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { z } from "zod";

/** A passkey sign-up ceremony must finish within this many seconds. */
export const PASSKEY_SIGNUP_SECONDS = 5 * 60;
/** The email already belongs to a parent; the screen routes to sign-in. */
export const ACCOUNT_EXISTS = "ACCOUNT_EXISTS";
const STATE_PREFIX = "passkey-signup:";
const COOKIE = "passkey_signup";
export const PASSKEY_SIGNUP_PATHS = [
  "/passkey-signup/options",
  "/passkey-signup/verify",
] as const;

const accountExists = () =>
  new APIError("CONFLICT", {
    code: ACCOUNT_EXISTS,
    message: "An AMP account already uses this email. Sign in instead.",
  });
const expired = () =>
  new APIError("BAD_REQUEST", {
    code: "PASSKEY_SIGNUP_EXPIRED",
    message: "This passkey request expired. Try again.",
  });

/**
 * Create a parent account with a passkey and no prior session.
 *
 * `options` checks the email, then binds a WebAuthn challenge and the email to
 * a single-use server record, referenced by a signed, HttpOnly cookie that
 * expires with it. `verify` consumes that record, verifies the attestation,
 * then creates the parent (unconfirmed email), the passkey and the session in
 * one transaction. A parent never exists without its credential: an abandoned
 * or failed ceremony writes nothing, and the record expires. An existing email
 * is never taken over: both steps refuse it, and the unique email index
 * refuses a concurrent sign-up for the same address.
 *
 * The library's own pre-session registration (`registration.requireSession:
 * false`) is not used: AMP keeps `/passkey/*` registration behind a fresh,
 * serialized session for adding passkeys from Security.
 */
export function passkeySignup(config: {
  enabled: boolean;
  rpID: string;
  rpName: string;
  origin: string;
}) {
  const disabled = () =>
    new APIError("NOT_FOUND", {
      code: "PASSKEY_SIGNUP_UNAVAILABLE",
      message: "Create an account another way.",
    });
  return {
    id: "amp-passkey-signup",
    endpoints: {
      passkeySignupOptions: createAuthEndpoint(
        "/passkey-signup/options",
        {
          method: "POST",
          body: z.object({ email: z.email().max(254) }),
        },
        async (ctx) => {
          if (!config.enabled) throw disabled();
          const email = ctx.body.email.trim().toLowerCase();
          if (await ctx.context.internalAdapter.findUserByEmail(email))
            throw accountExists();
          const options = await generateRegistrationOptions({
            rpName: config.rpName,
            rpID: config.rpID,
            userID: new TextEncoder().encode(
              generateRandomString(32, "a-z", "0-9"),
            ),
            userName: email,
            userDisplayName: email,
            attestationType: "none",
            timeout: PASSKEY_SIGNUP_SECONDS * 1000,
            // Discoverable, so the parent can later sign in without typing.
            authenticatorSelection: {
              residentKey: "required",
              userVerification: "preferred",
            },
          });
          const token = generateRandomString(32);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${STATE_PREFIX}${token}`,
            value: JSON.stringify({ challenge: options.challenge, email }),
            expiresAt: new Date(Date.now() + PASSKEY_SIGNUP_SECONDS * 1000),
          });
          const cookie = ctx.context.createAuthCookie(COOKIE);
          await ctx.setSignedCookie(cookie.name, token, ctx.context.secret, {
            ...cookie.attributes,
            maxAge: PASSKEY_SIGNUP_SECONDS,
          });
          return ctx.json(options);
        },
      ),
      passkeySignupVerify: createAuthEndpoint(
        "/passkey-signup/verify",
        {
          method: "POST",
          body: z.object({
            response: z.object({ id: z.string().min(1).max(1024) }).loose(),
          }),
        },
        async (ctx) => {
          if (!config.enabled) throw disabled();
          const cookie = ctx.context.createAuthCookie(COOKIE);
          const token = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          );
          ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });
          if (!token) throw expired();
          const record =
            await ctx.context.internalAdapter.consumeVerificationValue(
              `${STATE_PREFIX}${token}`,
            );
          if (!record || new Date(record.expiresAt).getTime() <= Date.now())
            throw expired();
          const { challenge, email } = JSON.parse(record.value) as {
            challenge: string;
            email: string;
          };
          let verification;
          try {
            verification = await verifyRegistrationResponse({
              response: ctx.body.response as never,
              expectedChallenge: challenge,
              expectedOrigin: config.origin,
              expectedRPID: config.rpID,
              requireUserVerification: false,
            });
          } catch (error) {
            console.error("[accounts] passkey sign-up not verified", error);
            verification = null;
          }
          if (!verification?.verified || !verification.registrationInfo)
            throw new APIError("BAD_REQUEST", {
              code: "PASSKEY_NOT_VERIFIED",
              message: "This passkey could not be verified. Try again.",
            });
          const info = verification.registrationInfo;
          const adapter: AuthContext["adapter"] = ctx.context.adapter;
          const internal = ctx.context.internalAdapter;
          let created;
          try {
            created = await runWithTransaction(adapter, async () => {
              const transaction = await getCurrentAdapter(adapter);
              if (await internal.findUserByEmail(email)) throw accountExists();
              if (
                await transaction.findOne({
                  model: "passkey",
                  where: [{ field: "credentialID", value: info.credential.id }],
                })
              )
                throw new APIError("BAD_REQUEST", {
                  code: "PASSKEY_NOT_VERIFIED",
                  message: "This passkey could not be verified. Try again.",
                });
              const user = await internal.createUser(
                { email, name: "", emailVerified: false },
                { method: "passkey" },
              );
              if (!user) throw new Error("The parent was not created");
              await transaction.create({
                model: "passkey",
                data: {
                  name: "Passkey",
                  userId: user.id,
                  credentialID: info.credential.id,
                  publicKey: base64.encode(info.credential.publicKey),
                  counter: info.credential.counter,
                  deviceType: info.credentialDeviceType,
                  transports:
                    (
                      ctx.body.response as { response?: { transports?: [] } }
                    ).response?.transports?.join(",") ?? "",
                  backedUp: info.credentialBackedUp,
                  createdAt: new Date(),
                  aaguid: info.aaguid,
                },
              });
              // The session trigger rechecks this passkey under the parent lock.
              const session = await internal.createSession(user.id);
              if (!session) throw new Error("The session was not created");
              return { user, session };
            });
          } catch (error) {
            // A concurrent sign-up for the same email loses on the unique index.
            if (
              !(error instanceof APIError) &&
              (await internal.findUserByEmail(email))
            )
              throw accountExists();
            throw error;
          }
          await setSessionCookie(ctx, created);
          // The account works now; confirming the email unlocks consent and
          // purchase. A failed send is logged; the parent can resend in place.
          try {
            const verify = ctx.context.options.emailVerification;
            const emailToken = await createEmailVerificationToken(
              ctx.context.secret,
              email,
              undefined,
              verify?.expiresIn,
            );
            await verify?.sendVerificationEmail?.(
              {
                user: created.user,
                url: `${ctx.context.baseURL}/verify-email?token=${emailToken}&callbackURL=${encodeURIComponent("/start")}`,
                token: emailToken,
              },
              ctx.request,
            );
          } catch (error) {
            console.error(
              "[accounts] passkey sign-up confirmation email not sent",
              error,
            );
          }
          return ctx.json({
            user: {
              id: created.user.id,
              email: created.user.email,
              emailVerified: false,
            },
          });
        },
      ),
    },
  };
}

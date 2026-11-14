import { requestFetch } from "../../lib/request-transport";
import { measureAuth } from "../../lib/auth-measurement";
import { track as trackAuth, googleSignupContext } from "../../lib/analytics";
import { entryCapture } from "../../lib/openai-acquisition";
import {
  isPitchEntry,
  signupNotice,
  type PitchEntry,
} from "../../../parent-followup/contracts";
import styles from "./Auth.module.css";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { Button, buttonClass } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { authConfigOptions } from "../../lib/query";
import { useLoggedError } from "../../feedback";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountClient } from "../../account-client";
import { signIn, accessSession, notifyAccountSessionChanged } from "../../auth";
import {
  EmailDivider,
  ProviderButtons,
  isProvider,
  providerNames,
  type Provider,
} from "./ProviderButtons";
import { socialCopyFor, socialErrorMessage } from "./social-copy";
import { passkeysAvailable, signUpWithPasskey } from "./passkey";
import {
  lookUpSignInMethods,
  methodList,
  type SignInMethod,
} from "./sign-in-methods";
import {
  continuationSearch,
  continuationUrl,
  fundedAttribution,
  fundedPrograms,
  isFundedReturn,
} from "../../lib/funded-entry";
import { useAuthDraft } from "./draft";

type Step =
  "sign-in" | "create" | "forgot" | "reset" | "check-email" | "two-factor";
const titles: Record<Step, string> = {
  "sign-in": "Sign in",
  create: "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
  "check-email": "Check your email",
  "two-factor": "Enter your code",
};
/** Arriving from the pitch, account creation names what the parent chose.
 * Trying it free keeps the free-practice heading, "Try AMP free". */
const pitchCreate: Partial<
  Record<PitchEntry, { title: string; detail: string }>
> = {
  "pitch-workbook": {
    title: "Get your free workbook",
    detail:
      "Next, choose the learner’s birth year. The workbook starts at that level.",
  },
  "pitch-buy": {
    title: "Create your account to buy",
    detail:
      "Next, tell us who’s learning, then choose annual or monthly and pay securely with Stripe.",
  },
};

/** Account sign-in with URL-backed steps and account-scoped session refresh. */
export function SignInScreen() {
  const routeLocation = useLocation(),
    navigate = useNavigate();
  const params = new URLSearchParams(routeLocation.searchStr);
  const resetToken = params.get("token");
  const invalidReset =
    routeLocation.pathname === "/reset-password" &&
    (!resetToken || params.has("error"));
  useEffect(() => {
    if (invalidReset)
      void navigate({
        to: "/sign-in/$step",
        params: { step: "forgot" },
        search: {
          ...continuationSearch(routeLocation.search),
          error: "reset_link_invalid",
        },
        replace: true,
      });
  }, [invalidReset]);
  const step: Step = invalidReset
    ? "forgot"
    : (params.has("reset-password") && resetToken) ||
        routeLocation.pathname === "/reset-password"
      ? "reset"
      : routeLocation.pathname === "/sign-up" ||
          params.get("sign-in") === "create"
        ? "create"
        : ["forgot", "check-email", "two-factor"].includes(
              routeLocation.pathname.split("/")[2],
            )
          ? (routeLocation.pathname.split("/")[2] as Step)
          : "sign-in";
  const setStep = (next: Step | "create-password") => {
    const search = continuationSearch(routeLocation.search);
    if (next === "create") void navigate({ to: "/sign-up", search });
    else if (next === "sign-in") void navigate({ to: "/sign-in", search });
    else if (next === "create-password")
      void navigate({
        to: "/sign-up",
        search: { ...search, method: "password" },
      });
    else if (next === "reset")
      void navigate({
        to: "/reset-password",
        search: { ...search, token: resetToken ?? undefined },
      });
    else
      void navigate({ to: "/sign-in/$step", params: { step: next }, search });
  };
  const { data: config } = useSuspenseQuery(authConfigOptions);
  const accounts = config.mode === "accounts";
  const providers = accounts ? config.providers.filter(isProvider) : [];
  const passwords = accounts ? config.passwords : true;
  // Passkey-first sign-up wherever this browser and deployment support it;
  // a password is the secondary choice (`?method=password`).
  const passkeyCreate =
    step === "create" &&
    accounts &&
    !!config.passkeySignup &&
    passkeysAvailable();
  const passkeyMethod = passkeyCreate && params.get("method") !== "password";
  const copy = socialCopyFor(document.documentElement.lang);
  const errorProvider = params.get("provider");
  const [pending, setPending] = useState<Provider | null>(null);
  const [handoffReady, setHandoffReady] = useState(false);
  const { email, setEmail } = useAuthDraft();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  // An account without a password, answered in place of the password form
  // (at the form's height, so nothing moves) with the methods that work.
  const [methodHint, setMethodHint] = useState<{
    step: Step;
    methods: SignInMethod[];
    minHeight?: number;
  } | null>(null);
  const hinted = methodHint?.step === step ? methodHint : null;
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState(
    invalidReset || params.get("error") === "reset_link_invalid"
      ? "That password reset link expired or is invalid. Request a new link."
      : params.get("error") === "clever_sign_in_failed"
        ? "Clever sign-in didn’t finish."
        : params.get("error") === "clever_sign_in_busy"
          ? "Clever sign-in is busy. Try again in a moment."
          : params.get("error") === "link_failed"
            ? "That login could not be linked. Sign in again, then try linking it from Security."
            : params.get("error") && isProvider(errorProvider)
              ? socialErrorMessage(
                  copy,
                  params.get("error")!,
                  providerNames[errorProvider],
                )
              : params.get("error")
                ? "That sign-in did not complete. Try again."
                : "",
  );
  useLoggedError(error);
  // A notice carried from another screen (an email that already has an
  // account) shows once, on arrival.
  const [notice, setNotice] = useState(() => useAuthDraft.getState().notice);
  useEffect(() => void useAuthDraft.getState().takeNotice(), []);
  useEffect(() => {
    if (!accounts) {
      history.replaceState({}, "", "/");
      void signIn();
    }
  }, [accounts]);
  // A provider's error is shown once; refresh and history do not replay it.
  useEffect(() => {
    if (!isProvider(errorProvider)) return;
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        error: undefined,
        provider: undefined,
      }),
      replace: true,
    });
  }, []);
  function go(next: Step | "create-password") {
    setStep(next);
    setError("");
    setNotice("");
    setMethodHint(null);
  }
  const carry = continuationSearch(routeLocation.search);
  const freeEntry = carry.return === "free-practice";
  const pitchEntry = isPitchEntry(carry.entry) ? carry.entry : undefined;
  // Every pitch path is a parent signup, so it records the same intent.
  const signupEntry = freeEntry || !!pitchEntry;
  const pitchCopy =
    step === "create" && pitchEntry ? pitchCreate[pitchEntry] : undefined;
  const buying = pitchEntry === "pitch-buy" && !freeEntry;
  const schoolEntry =
    carry.return === "school" || carry.return === "school-invite";
  const parentEntry = signupEntry && step === "create";
  // Parents sent to sign in from /access get the parent signup layout:
  // "Continue with Google" in full on its own row.
  const parentLayout = parentEntry || carry.return === "access";
  const primaryProviders =
    parentLayout && providers.some((p) => p !== "github")
      ? providers.filter((p) => p !== "github")
      : providers;
  const additionalProviders = providers.filter(
    (p) => !primaryProviders.includes(p),
  );
  const followupEnabled = accounts && config.parentFollowup;
  // A route arrival does not prove these controls rendered. This uses the
  // existing first-party batch and contains no field contents or URL values.
  useEffect(() => {
    let frame = 0,
      recorded = false;
    const ready = () => {
      if (recorded || document.visibilityState !== "visible") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (document.visibilityState !== "visible") return;
          recorded = true;
          trackAuth("auth_request", {
            attemptId: crypto.randomUUID(),
            stage: "screen",
            outcome: "succeeded",
          });
        });
      });
    };
    ready();
    document.addEventListener("visibilitychange", ready);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", ready);
    };
  }, [step]);
  // A successful redirect request is not a completed sign-in. Recover if an
  // in-app browser keeps this page open, or Back restores a pending form.
  useEffect(() => {
    if (!pending) return;
    let active = true,
      checking = false;
    const deadline = Date.now() + 15000;
    const recover = async (timedOut: boolean) => {
      if (!active || checking) return;
      checking = true;
      try {
        const session = await measureAuth("session", accessSession);
        if (!active) return;
        if (session) {
          notifyAccountSessionChanged(session);
          await continueAfterSignIn();
          return;
        }
        trackAuth("auth_failure", {
          method: "social",
          provider: pending,
          reason: "incomplete",
          ...(timedOut ? { category: "timeout" as const } : {}),
        });
        setError(
          `${providerNames[pending]} sign-in didn’t finish here. Try again or choose another option.`,
        );
      } catch {
        if (active)
          setError(
            "Your sign-in could not be checked. Try again or choose another option.",
          );
      } finally {
        if (active) {
          setPending(null);
          setHandoffReady(false);
          setBusy(false);
        }
      }
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) void recover(false);
    };
    const visible = () => {
      if (
        handoffReady &&
        document.visibilityState === "visible" &&
        Date.now() >= deadline
      )
        void recover(true);
    };
    const timer = handoffReady ? setTimeout(visible, 15000) : undefined;
    addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearTimeout(timer);
      removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pending, handoffReady]);
  async function prepareFreeSignup() {
    if (!signupEntry || !followupEnabled) return;
    await measureAuth("prepare", async () => {
      await Promise.race([
        entryCapture,
        new Promise<void>((resolve) => setTimeout(resolve, 1800)),
      ]);
      const response = await requestFetch("/api/v1/parent-followup/intent", {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notice: signupNotice,
          analytics: googleSignupContext(),
          // Opted in by default; every email carries a one-click unsubscribe.
          newsletter: true,
          entry: carry.entry,
          program: carry.program,
          campaign: fundedAttribution(carry),
        }),
      });
      if (!response.ok)
        throw new Error(
          "We couldn’t prepare your free account. Please try again.",
        );
    });
  }
  const returnTo = continuationUrl(carry, "/");
  // A new account answers "What brings you to AMP?" first.
  const newUserReturn = continuationUrl(carry, "/start");
  const done = async () => {
    const session = await measureAuth("session", accessSession);
    if (!session) throw new Error("Sign-in didn’t finish. Please try again.");
    notifyAccountSessionChanged(session);
    await continueAfterSignIn();
  };
  async function continueAfterSignIn() {
    if (schoolEntry || carry.return === "family-approval")
      await navigate({ href: continuationUrl(carry), replace: true });
    else if (carry.return === "security")
      await navigate({
        href: continuationUrl(carry),
        replace: true,
      });
    else
      await navigate({
        to:
          carry.return === "free-practice"
            ? "/start"
            : carry.return === "access"
              ? "/access"
              : isFundedReturn(carry.return)
                ? fundedPrograms[carry.return].path
                : step === "create"
                  ? "/start"
                  : "/",
        search: carry,
        replace: true,
      });
  }
  async function run(
    work: () => Promise<void>,
    stage: "password" | "passkey" | null = "password",
  ) {
    setBusy(true);
    setError("");
    try {
      if (stage) await measureAuth(stage, work);
      else await work();
    } catch (failure) {
      setPending(null);
      setError(
        failure instanceof TypeError
          ? "We couldn’t connect. Check your connection and try again."
          : failure instanceof Error
            ? failure.message
            : "That request didn’t finish. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  /** A password cannot work for an account that has none: show the methods
   * that will, in place of the form. False when there is nothing better to
   * offer than the ordinary path (no answer, a password exists, or no
   * account; at sign-in, no account is said plainly). */
  async function offerAccountMethods(address: string) {
    const methods = await lookUpSignInMethods(address);
    if (!methods) return false;
    if (!methods.length) {
      if (step === "sign-in")
        throw new Error(
          "No AMP account uses that email. Check it, or create an account.",
        );
      return false;
    }
    if (methods.includes("password")) return false;
    const usable = methods.filter((m) =>
      m === "passkey"
        ? passkeysAvailable()
        : m !== "password" && providers.includes(m),
    );
    if (!usable.length) return false;
    setMethodHint({
      step,
      methods: usable,
      minHeight: formRef.current?.getBoundingClientRect().height,
    });
    return true;
  }
  const fail = (result: {
    error: { message?: string; code?: string; status?: number } | null;
  }) => {
    if (!result.error) return;
    const messages: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD:
        "Check your email and password, or choose the sign-in method you used before.",
      INVALID_EMAIL:
        "Enter a complete email address, such as name@example.com.",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
        "If you already have an account, choose Sign in and use the method you used before.",
    };
    throw new Error(
      result.error.status === 429
        ? "Too many attempts. Wait a minute, then try again."
        : (messages[result.error.code ?? ""] ??
            result.error.message ??
            "That request didn’t finish. Try again."),
    );
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || pending) return;
    void run(async () => {
      if (step === "sign-in") {
        await prepareFreeSignup();
        const result = await accountClient.signIn.email({
          callbackURL: returnTo,
          email: email.trim(),
          password,
        });
        if (result.error?.code === "EMAIL_NOT_VERIFIED")
          return go("check-email");
        if (
          result.error?.code === "INVALID_EMAIL_OR_PASSWORD" &&
          (await offerAccountMethods(email.trim()))
        )
          return;
        fail(result);
        if (
          result.data &&
          "twoFactorRedirect" in result.data &&
          result.data.twoFactorRedirect
        )
          return go("two-factor");
        await done();
      } else if (step === "create") {
        if (await offerAccountMethods(email.trim())) return;
        await prepareFreeSignup();
        const result = await accountClient.signUp.email({
          name: "",
          email: email.trim(),
          password,
          callbackURL: newUserReturn,
        });
        fail(result);
        // Where email must be confirmed first, no session is issued yet. A
        // mailed school invitation already confirmed this address, so sign in.
        if (result.data?.token) await done();
        else if (result.data?.user.emailVerified) {
          fail(
            await accountClient.signIn.email({
              callbackURL: returnTo,
              email: email.trim(),
              password,
            }),
          );
          await done();
        } else go("check-email");
      } else if (step === "forgot") {
        fail(
          await accountClient.requestPasswordReset({
            email: email.trim(),
            redirectTo: `/reset-password?${new URLSearchParams(carry as Record<string, string>)}`,
          }),
        );
        setNotice(
          "If an account uses that email, a reset link is on its way. It expires in one hour.",
        );
      } else if (step === "reset") {
        fail(
          await accountClient.resetPassword({
            newPassword: password,
            token: resetToken!,
          }),
        );
        history.replaceState({}, "", "/?sign-in");
        setPassword("");
        go("sign-in");
        setNotice("Password changed. Sign in with the new password.");
      } else if (step === "two-factor") {
        fail(
          backup
            ? await accountClient.twoFactor.verifyBackupCode({ code })
            : await accountClient.twoFactor.verifyTotp({ code }),
        );
        await done();
      }
    });
  }
  // The account, its passkey and the session are created together, then the
  // account owner sees confirmation and a clear next step.
  function createWithPasskey(event: FormEvent) {
    event.preventDefault();
    if (busy || pending) return;
    const startedAt = performance.now();
    void run(async () => {
      await prepareFreeSignup();
      const result = await signUpWithPasskey(
        email.trim(),
        freeEntry ? { program: carry.program } : undefined,
        startedAt,
      );
      if (result.ok) return done();
      trackAuth("auth_failure", {
        method: "passkey",
        reason: result.code,
        ...result.diagnostics,
      });
      if (result.code === "exists") {
        useAuthDraft.getState().carry(email.trim(), result.message);
        go("sign-in");
        setNotice(result.message);
        return;
      }
      throw new Error(result.message);
    }, "passkey");
  }
  // The provider returns here on failure (with its code), to the guided first
  // run for a new account, or to where this sign-in was headed.
  const social = (provider: Provider) => {
    if (busy || pending) return;
    setPending(provider);
    setHandoffReady(false);
    setError("");
    void run(async () => {
      await prepareFreeSignup();
      await measureAuth(
        "social",
        async () => {
          const result = await accountClient.signIn.social({
            provider,
            fetchOptions: { timeout: 15_000 },
            callbackURL: returnTo,
            newUserCallbackURL: newUserReturn,
            errorCallbackURL: `${step === "create" ? "/sign-up" : "/sign-in"}?${new URLSearchParams(
              {
                provider,
                ...carry,
              },
            )}`,
          });
          if (result.error) {
            trackAuth("auth_failure", { method: "social", reason: "failed" });
            setPending(null);
            throw new Error(
              socialErrorMessage(copy, "", providerNames[provider]),
            );
          }
          setHandoffReady(true);
        },
        provider,
      );
    }, null);
  };
  const signInWithPasskey = () =>
    void run(async () => {
      await prepareFreeSignup();
      fail(await accountClient.signIn.passkey());
      await done();
    });
  const showProviders = step === "sign-in" || step === "create";
  return (
    <PageFrame centered className={styles.authFrame}>
      <section
        className={`card welcome account-sign-in ${frameCard} ${styles.frame}`}
      >
        <FrameBrand />
        <h2>
          {pitchCopy
            ? pitchCopy.title
            : parentEntry
              ? "Try AMP free"
              : titles[step]}
        </h2>
        {pitchCopy && (
          <div className={styles.pitch} data-pitch-signup={pitchEntry}>
            <p>{pitchCopy.detail}</p>
          </div>
        )}
        {schoolEntry && showProviders && (
          <div className={styles.pitch} data-school-signup>
            <p>
              {carry.return === "school-invite"
                ? "Your invitation continues right after this."
                : "Setting up your school continues right after this."}
            </p>
          </div>
        )}
        {carry.return === "family-approval" && showProviders && (
          <div className={styles.pitch} data-approval-signup>
            <p>Approving your child’s class continues right after this.</p>
          </div>
        )}
        {freeEntry && showProviders && !pitchCopy && (
          <div className={styles.pitch} data-free-parent-signup>
            <p>
              Each learner starts with 100 free problems and five free
              workbooks. No card needed.
            </p>
            {carry.program && (
              <p className={styles.funding}>
                Approved{" "}
                {
                  {
                    "ar-efa": "Arkansas EFA",
                    "az-esa": "Arizona ESA",
                    "nh-efa": "New Hampshire EFA",
                  }[carry.program]
                }{" "}
                vendor.
              </p>
            )}
          </div>
        )}
        {step === "sign-in" && providers.length > 0 && (
          <p className={styles.hint}>
            Choose the sign-in method you used to create your account.
          </p>
        )}
        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        <Toast
          message={error}
          title="Unable to continue"
          placement="top"
          takeFocus
          onDismiss={() => setError("")}
        />
        {/* School staff signed in by Clever: always a way in from here, the
            first choice after a Clever sign-in that didn't finish. */}
        {accounts && config.clever && step === "sign-in" && (
          <a
            href="/api/v1/school/sso/clever/start"
            className={buttonClass(
              ["clever_sign_in_failed", "clever_sign_in_busy"].includes(
                params.get("error") ?? "",
              )
                ? "primary"
                : "secondary",
            )}
          >
            Sign in with Clever
          </a>
        )}
        {showProviders && (
          <ProviderButtons
            providers={primaryProviders}
            emphasizeFirst={parentLayout}
            copy={copy}
            busy={busy || !!pending}
            pending={pending}
            onSelect={social}
          />
        )}
        {step === "sign-in" && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !!pending}
            onClick={signInWithPasskey}
          >
            Sign in with a passkey
          </Button>
        )}
        {showProviders &&
          providers.length > 0 &&
          (passwords || passkeyCreate) && <EmailDivider copy={copy} />}
        {hinted ? (
          <div
            className={styles.methodHint}
            data-method-hint
            style={{ minHeight: hinted.minHeight }}
          >
            <div className={styles.emailHeader}>
              <span className={styles.hintEmail}>{email.trim()}</span>
              <button
                type="button"
                className={styles.inlineLink}
                aria-label="Use a different email"
                disabled={busy || !!pending}
                onClick={() => setMethodHint(null)}
              >
                Change
              </button>
            </div>
            <p role="status">
              This email signs in with {methodList(hinted.methods)}.
            </p>
            <ProviderButtons
              providers={hinted.methods.filter(isProvider)}
              copy={copy}
              busy={busy || !!pending}
              pending={pending}
              onSelect={social}
            />
            {hinted.methods.includes("passkey") && (
              <Button
                type="button"
                variant="primary"
                disabled={busy || !!pending}
                onClick={signInWithPasskey}
              >
                Sign in with a passkey
              </Button>
            )}
          </div>
        ) : passkeyMethod ? (
          <form
            ref={formRef}
            className="account-form"
            onSubmit={createWithPasskey}
          >
            <div className={styles.emailHeader}>
              <label htmlFor="signup-passkey-email">Email</label>
              {passwords && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  disabled={busy || !!pending}
                  onClick={() => go("create-password")}
                >
                  Use a password instead
                </button>
              )}
            </div>
            <input
              id="signup-passkey-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant={
                parentEntry && primaryProviders.length ? "secondary" : "primary"
              }
              type="submit"
              disabled={busy || !!pending}
              aria-busy={busy}
            >
              Create account with a passkey
            </Button>
            <small className={styles.hint}>No password to remember.</small>
          </form>
        ) : step === "check-email" ? (
          <div className={styles.emailHelp} data-check-email>
            <p>
              {`${email.trim() ? `We sent an email to ${email.trim()}.` : "We sent you an email."} A new address gets a confirmation link; an existing account gets the way to sign in. Check your spam folder too.`}
            </p>
            <ProviderButtons
              providers={providers}
              emphasizeFirst={providers.length > 2}
              copy={copy}
              busy={busy || !!pending}
              pending={pending}
              onSelect={social}
            />
          </div>
        ) : (
          (passwords || !showProviders) && (
            <form ref={formRef} className="account-form" onSubmit={submit}>
              {step !== "reset" && step !== "two-factor" && (
                <label>
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {(step === "sign-in" ||
                step === "create" ||
                step === "reset") && (
                // The rule describes the field and isn't part of its name,
                // which stays "Password".
                <div className="account-field">
                  <label>
                    {step === "reset" ? "New password" : "Password"}
                    <input
                      required
                      type="password"
                      minLength={step === "sign-in" ? 1 : 10}
                      autoComplete={
                        step === "sign-in" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby={
                        step !== "sign-in" ? "password-rule" : undefined
                      }
                    />
                  </label>
                  {step !== "sign-in" && (
                    <small id="password-rule">At least 10 characters.</small>
                  )}
                </div>
              )}
              {step === "two-factor" && (
                <label>
                  {backup ? "Backup code" : "Code from your authenticator app"}
                  <input
                    required
                    autoComplete="one-time-code"
                    inputMode={backup ? "text" : "numeric"}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                  />
                </label>
              )}
              <Button
                variant="primary"
                type="submit"
                disabled={busy || !!pending}
                aria-busy={busy}
              >
                {
                  {
                    "sign-in": "Sign in",
                    create: "Create account",
                    forgot: "Send reset link",
                    reset: "Change password",
                    "two-factor": "Verify",
                    "check-email": "",
                  }[step]
                }
              </Button>
            </form>
          )
        )}
        <div className="account-links">
          {step === "sign-in" && passwords && (
            <>
              <button
                className="text-button"
                disabled={busy || !!pending}
                onClick={() => go("forgot")}
              >
                Forgot password?
              </button>
              <button
                className="text-button"
                disabled={busy || !!pending}
                onClick={() => go("create")}
              >
                Create an account
              </button>
            </>
          )}
          {step === "create" && (
            <>
              {passkeyCreate && passwords && !passkeyMethod && (
                <button
                  className="text-button"
                  disabled={busy || !!pending}
                  onClick={() =>
                    go(passkeyMethod ? "create-password" : "create")
                  }
                >
                  {passkeyMethod
                    ? "Use a password instead"
                    : "Use a passkey instead"}
                </button>
              )}
            </>
          )}
          {step === "create" && (
            <p className={`${styles.hint} ${styles.switchAccount}`}>
              Already have an account?{" "}
              <button
                className={styles.inlineLink}
                disabled={busy || !!pending}
                onClick={() => go("sign-in")}
              >
                Sign in
              </button>
            </p>
          )}
          {additionalProviders.length > 0 && (
            <details className={styles.moreMethods}>
              <summary>More sign-in options</summary>
              <ProviderButtons
                providers={additionalProviders}
                copy={copy}
                busy={busy || !!pending}
                pending={pending}
                onSelect={social}
              />
            </details>
          )}
          {step === "two-factor" && (
            <button
              className="text-button"
              onClick={() => {
                setBackup(!backup);
                setCode("");
              }}
            >
              {backup ? "Use the authenticator app" : "Use a backup code"}
            </button>
          )}
          {(step === "forgot" || step === "check-email") && (
            <button className="text-button" onClick={() => go("sign-in")}>
              Back to sign in
            </button>
          )}
        </div>
        {signupEntry && showProviders && followupEnabled && (
          <p className={styles.fineprint} data-signup-email-notice>
            We’ll email you about AMP. Unsubscribe anytime.{" "}
            <a href="https://corpora.inc/legal/privacy/">Privacy</a>
          </p>
        )}
      </section>
    </PageFrame>
  );
}

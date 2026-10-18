import { useEffect, useState, type FormEvent } from "react";
import { accountClient } from "./account-client";
import { authConfig, signIn, notifyAccountSessionChanged } from "./auth";

type Step =
  "sign-in" | "create" | "forgot" | "reset" | "check-email" | "two-factor";
const providerNames: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  github: "GitHub",
};
const titles: Record<Step, string> = {
  "sign-in": "Sign in",
  create: "Create your parent account",
  forgot: "Reset your password",
  reset: "Choose a new password",
  "check-email": "Check your email",
  "two-factor": "Enter your code",
};

/** Parent sign-in for AMP's own accounts. Success reloads the app, which then
 * finds the session (and saves a trial placement if one is waiting). */
export function AccountSignIn() {
  const params = new URLSearchParams(location.search);
  const resetToken = params.get("token");
  const [step, setStep] = useState<Step>(
    params.has("reset-password") && resetToken
      ? "reset"
      : params.get("sign-in") === "create"
        ? "create"
        : "sign-in",
  );
  const [providers, setProviders] = useState<string[]>([]);
  const [passwords, setPasswords] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("error") ? "That sign-in did not complete. Try again." : "",
  );
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void authConfig().then((config) => {
      if (config.mode !== "accounts") {
        history.replaceState({}, "", "/");
        void signIn();
        return;
      }
      setProviders(config.providers);
      setPasswords(config.passwords);
    });
  }, []);
  function go(next: Step) {
    setStep(next);
    setError("");
    setNotice("");
  }
  const returnTo = params.get("return") === "security" ? "/?security" : "/";
  const done = () => {
    notifyAccountSessionChanged();
    location.replace(returnTo);
  };
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      console.error("Account request failed", failure);
      setError(failure instanceof Error ? failure.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  const fail = (result: { error: { message?: string } | null }) => {
    if (result.error) throw new Error(result.error.message ?? "Try again.");
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (step === "sign-in") {
        const result = await accountClient.signIn.email({ email, password });
        if (result.error?.code === "EMAIL_NOT_VERIFIED")
          return go("check-email");
        fail(result);
        if (
          result.data &&
          "twoFactorRedirect" in result.data &&
          result.data.twoFactorRedirect
        )
          return go("two-factor");
        done();
      } else if (step === "create") {
        const result = await accountClient.signUp.email({
          name: name.trim(),
          email,
          password,
          callbackURL: "/",
        });
        fail(result);
        // Where email must be confirmed first, no session is issued yet.
        if (result.data?.token) done();
        else go("check-email");
      } else if (step === "forgot") {
        fail(
          await accountClient.requestPasswordReset({
            email,
            redirectTo: "/?reset-password",
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
        done();
      }
    });
  }
  const social = (provider: string) =>
    void run(async () => {
      fail(
        await accountClient.signIn.social({
          provider,
          callbackURL: returnTo,
          errorCallbackURL:
            params.get("return") === "security"
              ? "/?sign-in&return=security"
              : "/?sign-in",
        }),
      );
    });
  const showProviders = step === "sign-in" || step === "create";
  return (
    <section className="card welcome account-sign-in">
      <h2>{titles[step]}</h2>
      {notice && (
        <p className="account-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      {step === "sign-in" && (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              fail(await accountClient.signIn.passkey());
              done();
            })
          }
        >
          Sign in with a passkey
        </button>
      )}
      {showProviders && providers.length > 0 && (
        <div className="account-providers">
          {providers.map((provider) => (
            <button
              key={provider}
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => social(provider)}
            >
              Continue with {providerNames[provider] ?? provider}
            </button>
          ))}
        </div>
      )}
      {showProviders && providers.length > 0 && passwords && (
        <p className="account-divider" aria-hidden="true">
          <span>or</span>
        </p>
      )}
      {step === "check-email" ? (
        <p>
          We sent a link to {email}. Open it to confirm the address and finish
          creating the account.
        </p>
      ) : (
        (passwords || !showProviders) && (
          <form className="account-form" onSubmit={submit}>
            {step === "create" && (
              <label>
                Your name
                <input
                  required
                  autoComplete="name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
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
            {(step === "sign-in" || step === "create" || step === "reset") && (
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
                />
                {step !== "sign-in" && <small>At least 10 characters.</small>}
              </label>
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
            <button className="go-button" disabled={busy}>
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
            </button>
          </form>
        )
      )}
      <div className="account-links">
        {step === "sign-in" && passwords && (
          <>
            <button className="text-button" onClick={() => go("forgot")}>
              Forgot password?
            </button>
            <button className="text-button" onClick={() => go("create")}>
              Create an account
            </button>
          </>
        )}
        {step === "create" && (
          <button className="text-button" onClick={() => go("sign-in")}>
            I already have an account
          </button>
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
    </section>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { notifyAccountSessionChanged } from "./auth";
import { accountClient } from "./account-client";
import "./account-security.css";

type Summary = {
  email: string;
  passwords: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  freshUntil: string;
  providers: string[];
  accounts: { id: string; provider: string; available: boolean }[];
  passkeys: { id: string; name: string | null; createdAt: string }[];
};
const names: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  github: "GitHub",
};
async function security<T>(path: string, body?: object): Promise<T> {
  const result = await fetch(`/api/auth/security/${path}`, {
    ...(body && {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    cache: "no-store",
  });
  const value = await result.json();
  if (!result.ok)
    throw new Error(
      value.message ?? "Your settings could not be saved. Try again.",
    );
  return value as T;
}
function checked<T>(result: {
  data: T;
  error: { message?: string } | null;
}): NonNullable<T> {
  if (result.error)
    throw new Error(
      result.error.message ?? "Your settings could not be saved. Try again.",
    );
  return result.data!;
}
export function AccountSecurity() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState("passkeys");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const [keyName, setKeyName] = useState(""),
    [rename, setRename] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<{
    uri: string;
    qr: string;
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    kind: "account" | "passkey";
    id: string;
    label: string;
  } | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error || notice)
      feedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [error, notice]);
  useEffect(() => {
    if (confirm) confirmRef.current?.scrollIntoView({ block: "nearest" });
  }, [confirm]);
  const feedback = (error || notice) && (
    <div ref={feedbackRef}>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="account-notice">
          {notice}
        </p>
      )}
    </div>
  );
  async function refresh() {
    setSummary(await security<Summary>("summary"));
  }
  useEffect(() => {
    let live = true;
    void security<Summary>("summary")
      .then((data) => {
        if (live) setSummary(data);
      })
      .catch((failure) => {
        if (live) setError(failure.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!summary) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(summary.freshUntil) - Date.now()) + 25,
    );
    return () => clearTimeout(timer);
  }, [summary?.freshUntil]);
  async function run(work: () => Promise<void>) {
    if (summary && Date.now() >= Date.parse(summary.freshUntil)) {
      setError("Sign in again before changing security settings.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
    } catch (failure) {
      setNotice("");
      setError(failure instanceof Error ? failure.message : "Try again.");
    } finally {
      setBusy(false);
      setPassword("");
      setNewPassword("");
    }
  }
  function switchPanel(next: string) {
    setPanel(next);
    setPassword("");
    setNewPassword("");
    setCode("");
    setEnrollment(null);
    setBackupCodes([]);
    setConfirm(null);
    setError("");
    setNotice("");
    setRename("");
  }
  function submit(event: FormEvent, work: () => Promise<void>) {
    event.preventDefault();
    void run(work);
  }
  const passwordField = (
    <label>
      Current password
      <input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </label>
  );
  return (
    <section className="account-security" aria-labelledby="security-title">
      <h2 id="security-title" tabIndex={-1}>
        Sign-in &amp; security
      </h2>
      {!summary && feedback}
      {!summary ? (
        <button disabled={busy} onClick={() => void run(async () => {})}>
          Load security settings
        </button>
      ) : (
        <>
          <p className="security-email">{summary.email}</p>
          <p className="security-fresh">
            {now >= Date.parse(summary.freshUntil)
              ? "Sign in again to change these settings."
              : "Changes require a sign-in within the last five minutes."}{" "}
            <a href="/?sign-in&return=security">Sign in again</a>.
          </p>
          <div className="security-panels">
            {(
              [
                ["passkeys", "Passkeys", `${summary.passkeys.length} saved`],
                [
                  "password",
                  "Password",
                  summary.hasPassword ? "Set" : "Not set",
                ],
                [
                  "totp",
                  "Authenticator",
                  summary.twoFactorEnabled ? "On for password sign-in" : "Off",
                ],
                [
                  "logins",
                  "Linked logins",
                  `${summary.accounts.length} linked`,
                ],
              ] as const
            ).map(([id, title, status]) => (
              <section className="security-panel" key={id}>
                <h3>
                  <button
                    className="security-panel-toggle"
                    disabled={busy}
                    aria-expanded={panel === id}
                    aria-controls={`security-${id}`}
                    onClick={() => switchPanel(panel === id ? "" : id)}
                  >
                    <span>
                      {title}
                      <small>{status}</small>
                    </span>
                    <span aria-hidden="true">{panel === id ? "−" : "+"}</span>
                  </button>
                </h3>
                {panel === id && (
                  <div className="security-panel-body" id={`security-${id}`}>
                    {id === "passkeys" && (
                      <>
                        <p>
                          Use a passkey saved on your device or security key.
                        </p>
                        {summary.passkeys.map((key) => (
                          <div className="security-method" key={key.id}>
                            {rename === key.id ? (
                              <form
                                onSubmit={(e) =>
                                  submit(e, async () => {
                                    checked(
                                      await accountClient.passkey.updatePasskey(
                                        { id: key.id, name: keyName.trim() },
                                      ),
                                    );
                                    setRename("");
                                    setNotice("Passkey name saved.");
                                  })
                                }
                              >
                                <label>
                                  Passkey name
                                  <input
                                    autoComplete="off"
                                    maxLength={80}
                                    required
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                  />
                                </label>
                                <div className="security-actions">
                                  <button disabled={busy || !keyName.trim()}>
                                    Save name
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => setRename("")}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <strong>{key.name || "Passkey"}</strong>
                                <div className="security-actions">
                                  <button
                                    className="secondary"
                                    disabled={busy}
                                    onClick={() => {
                                      setRename(key.id);
                                      setKeyName(key.name || "");
                                    }}
                                  >
                                    Rename
                                  </button>
                                  <button
                                    className="text-button"
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirm({
                                        kind: "passkey",
                                        id: key.id,
                                        label: key.name || "this passkey",
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {!rename && (
                          <form
                            onSubmit={(e) =>
                              submit(e, async () => {
                                checked(
                                  await accountClient.passkey.addPasskey({
                                    name: keyName.trim() || "My passkey",
                                  }),
                                );
                                setKeyName("");
                                setNotice("Passkey added.");
                              })
                            }
                          >
                            <label>
                              Name for this passkey
                              <input
                                autoComplete="off"
                                maxLength={80}
                                value={keyName}
                                onChange={(e) => setKeyName(e.target.value)}
                                placeholder="For example, personal laptop"
                              />
                            </label>
                            <button disabled={busy}>Add passkey</button>
                          </form>
                        )}
                      </>
                    )}
                    {id === "password" &&
                      (summary.passwords ? (
                        summary.hasPassword ? (
                          <form
                            onSubmit={(e) =>
                              submit(e, async () => {
                                checked(
                                  await accountClient.changePassword({
                                    currentPassword: password,
                                    newPassword,
                                    revokeOtherSessions: true,
                                  }),
                                );
                                notifyAccountSessionChanged();
                                setNotice(
                                  "Password changed. Other sessions have been signed out.",
                                );
                              })
                            }
                          >
                            {passwordField}
                            <label>
                              New password
                              <input
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={10}
                                maxLength={128}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </label>
                            <p>
                              At least 10 characters. Changing it signs out your
                              other sessions.
                            </p>
                            <button disabled={busy}>Change password</button>
                          </form>
                        ) : (
                          <>
                            <p>
                              We will email a link to {summary.email} to confirm
                              the address and choose your password.
                            </p>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  checked(
                                    await accountClient.requestPasswordReset({
                                      email: summary.email,
                                      redirectTo: "/?reset-password",
                                    }),
                                  );
                                  setNotice(
                                    "Check your email for the password link. It expires in one hour.",
                                  );
                                })
                              }
                            >
                              Email a password setup link
                            </button>
                          </>
                        )
                      ) : (
                        <p>Password sign-in is not available.</p>
                      ))}
                    {id === "totp" && (
                      <>
                        <p>
                          An authenticator supplies a six-digit code when you
                          sign in with a password. Passkeys and linked providers
                          use their own sign-in checks.
                        </p>
                        {!summary.hasPassword || !summary.passwords ? (
                          <p>
                            Set up an available password before adding an
                            authenticator.
                          </p>
                        ) : enrollment ? (
                          <>
                            <p>
                              Scan this code in your authenticator, then enter
                              its six-digit code.
                            </p>
                            <img
                              className="security-qr"
                              src={enrollment.qr}
                              alt="Authenticator setup QR code"
                              width={208}
                              height={208}
                            />
                            <details className="security-secret">
                              <summary>Enter the setup key manually</summary>
                              <code>
                                {new URL(enrollment.uri).searchParams.get(
                                  "secret",
                                )}
                              </code>
                            </details>
                            <form
                              onSubmit={(e) =>
                                submit(e, async () => {
                                  checked(
                                    await accountClient.twoFactor.verifyTotp({
                                      code,
                                    }),
                                  );
                                  notifyAccountSessionChanged();
                                  setEnrollment(null);
                                  setCode("");
                                  setNotice(
                                    "Authenticator enabled. Save your backup codes before closing this panel.",
                                  );
                                })
                              }
                            >
                              <label>
                                Authenticator code
                                <input
                                  inputMode="numeric"
                                  autoComplete="one-time-code"
                                  pattern="[0-9]{6}"
                                  required
                                  maxLength={6}
                                  value={code}
                                  onChange={(e) =>
                                    setCode(e.target.value.replace(/\D/g, ""))
                                  }
                                />
                              </label>
                              <button disabled={busy}>Verify and enable</button>
                            </form>
                          </>
                        ) : (
                          <form
                            onSubmit={(e) =>
                              submit(e, async () => {
                                if (summary.twoFactorEnabled) {
                                  const data = checked(
                                    await accountClient.twoFactor.generateBackupCodes(
                                      { password },
                                    ),
                                  );
                                  setBackupCodes(data.backupCodes);
                                  setNotice(
                                    "New backup codes created. Previous codes no longer work.",
                                  );
                                } else {
                                  const data = checked(
                                    await accountClient.twoFactor.enable({
                                      password,
                                    }),
                                  );
                                  if (!("totpURI" in data) || !data.totpURI)
                                    throw new Error(
                                      "Authenticator setup could not be prepared.",
                                    );
                                  const qr = await (
                                    await import("qrcode")
                                  ).toDataURL(data.totpURI, {
                                    width: 208,
                                    margin: 2,
                                    errorCorrectionLevel: "M",
                                  });
                                  setEnrollment({ uri: data.totpURI, qr });
                                  setBackupCodes(data.backupCodes ?? []);
                                }
                              })
                            }
                          >
                            {passwordField}
                            <div className="security-actions">
                              <button disabled={busy}>
                                {summary.twoFactorEnabled
                                  ? "Replace backup codes"
                                  : "Set up authenticator"}
                              </button>
                              {summary.twoFactorEnabled && (
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={busy || !password}
                                  onClick={() =>
                                    void run(async () => {
                                      checked(
                                        await accountClient.twoFactor.disable({
                                          password,
                                        }),
                                      );
                                      notifyAccountSessionChanged();
                                      setBackupCodes([]);
                                      setNotice(
                                        "Authenticator disabled for password sign-in.",
                                      );
                                    })
                                  }
                                >
                                  Disable authenticator
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                        {feedback}
                        {!!backupCodes.length && (
                          <div className="security-backup security-secret">
                            <h4>Save your backup codes</h4>
                            <p>
                              Each code works once if your authenticator is
                              unavailable. These codes are shown only here; save
                              them somewhere private.
                            </p>
                            <ul>
                              {backupCodes.map((value) => (
                                <li key={value}>
                                  <code>{value}</code>
                                </li>
                              ))}
                            </ul>
                            <button
                              className="secondary"
                              disabled={!!enrollment || busy}
                              onClick={() => {
                                setBackupCodes([]);
                                setNotice("Backup codes hidden.");
                              }}
                            >
                              I saved these codes
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {id === "logins" && (
                      <>
                        {summary.accounts.map((account) => (
                          <div className="security-method" key={account.id}>
                            <strong>
                              {names[account.provider] ?? account.provider}
                            </strong>
                            {!account.available && (
                              <p>This provider is unavailable for sign-in.</p>
                            )}
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  kind: "account",
                                  id: account.id,
                                  label:
                                    names[account.provider] ?? account.provider,
                                })
                              }
                            >
                              Unlink
                            </button>
                          </div>
                        ))}
                        {summary.providers
                          .filter(
                            (provider) =>
                              !summary.accounts.some(
                                (a) => a.provider === provider,
                              ),
                          )
                          .map((provider) => (
                            <button
                              className="secondary"
                              key={provider}
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  checked(
                                    await accountClient.linkSocial({
                                      provider,
                                      callbackURL: "/",
                                      errorCallbackURL: "/?sign-in",
                                    }),
                                  );
                                })
                              }
                            >
                              Link {names[provider] ?? provider}
                            </button>
                          ))}
                        {!summary.providers.length && (
                          <p>No external sign-in providers are available.</p>
                        )}
                        <p>Keep at least one available way to sign in.</p>
                      </>
                    )}
                    {id !== "totp" && feedback}
                  </div>
                )}
              </section>
            ))}
          </div>
          {confirm && (
            <div
              ref={confirmRef}
              className="security-confirm"
              role="group"
              aria-label="Confirm removal"
            >
              <p>
                Remove {confirm.label} from this account? Other sessions will be
                signed out.
              </p>
              <div className="security-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await security(
                        confirm.kind === "account"
                          ? "unlink-account"
                          : "delete-passkey",
                        { id: confirm.id },
                      );
                      notifyAccountSessionChanged();
                      setConfirm(null);
                      setNotice(
                        "Sign-in method removed. Other sessions have been signed out.",
                      );
                    })
                  }
                >
                  Confirm removal
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

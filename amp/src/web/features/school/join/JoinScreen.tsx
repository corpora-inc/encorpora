import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
} from "../../../../schools/contracts";
import { Button } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { queryClient } from "../../../lib/query";
import {
  finishingSignIn,
  joinRosterOptions,
  signInWithCard,
  useFinishSignIn,
} from "./api";
import { canScan, CardScanner } from "./CardScanner";
import { CodeTiles } from "./CodeTiles";
import { JoinFrame } from "./JoinFrame";
import { readScan } from "./scan";
import styles from "./Join.module.css";

function CardMark() {
  return (
    <svg viewBox="0 0 32 24" className={styles.cardMark} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="21" rx="4" />
      <path d="M6 7h5v5H6zM6 16h9M21 7h5v5h-5zM21 16h5" />
    </svg>
  );
}

/** `/join`: a class code, or a card held up to the camera. */
export function JoinScreen() {
  const navigate = useNavigate();
  const finish = useFinishSignIn();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const { sso } = useSearch({ strict: false }) as { sso?: unknown };
  // Back from a school account's sign-in, with no class to return to.
  const [message, setMessage] = useState(
    sso
      ? "That sign-in didn’t finish. Type your class code, or scan your card."
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [shake, setShake] = useState(0);
  // A keyboard already in hand is ready to type; a phone's stays down until
  // it's asked for, so the first thing seen is the whole screen.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  function fail(text: string) {
    setMessage(text);
    setShake((count) => count + 1);
  }
  async function submit(value: string) {
    setBusy(true);
    setMessage("");
    try {
      await queryClient.fetchQuery(joinRosterOptions(value));
      await navigate({ to: "/join/$code", params: { code: value } });
    } catch (failure) {
      fail((failure as Error).message);
      setBusy(false);
      // Whatever's typed next replaces the code that didn't work.
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    }
  }
  function type(raw: string) {
    const next = normalizeJoinCode(raw).slice(0, JOIN_CODE_LENGTH);
    setCode(next);
    if (message) setMessage("");
    if (next.length === JOIN_CODE_LENGTH && next !== code) void submit(next);
  }
  function scanned(text: string) {
    const read = readScan(text);
    if (!read) return false;
    setScanning(false);
    setBusy(true);
    setMessage("");
    void (async () => {
      try {
        if (read.kind === "class") {
          await queryClient.fetchQuery(joinRosterOptions(read.code));
          await navigate({ to: "/join/$code", params: { code: read.code } });
        } else await finish(await signInWithCard(read.token));
      } catch (failure) {
        fail((failure as Error).message);
        setBusy(false);
      }
    })();
    return true;
  }

  if (finishingSignIn()) return <LoadingScreen />;
  return (
    <JoinFrame>
      <div className={styles.column}>
        <h1 className={styles.title}>
          {scanning ? "Hold up your card" : "Type your class code"}
        </h1>
        <div className={styles.stage}>
          <label
            className={styles.codeField}
            data-hidden={scanning || undefined}
          >
            <span className={styles.srOnly}>Class code</span>
            <span
              key={shake}
              className={styles.shaker}
              data-shake={shake > 0 || undefined}
            >
              <CodeTiles
                code={code}
                active={
                  focused
                    ? Math.min(code.length, JOIN_CODE_LENGTH - 1)
                    : undefined
                }
              />
            </span>
            <input
              ref={input}
              className={styles.codeInput}
              value={code}
              readOnly={busy}
              onChange={(event) => type(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby="join-message"
              aria-invalid={!!message || undefined}
            />
          </label>
          {scanning && (
            <CardScanner
              onRead={scanned}
              onFailure={(text) => {
                setScanning(false);
                setMessage(text);
              }}
            />
          )}
        </div>
        <div id="join-message" className={styles.message} aria-live="polite">
          {busy ? (
            <Loading inline />
          ) : (
            message && (
              <span className={styles.problem} role="alert">
                {message}
              </span>
            )
          )}
        </div>
        {canScan() && (
          <Button
            variant="secondary"
            className={styles.bigButton}
            disabled={busy}
            onClick={() => {
              setMessage("");
              setScanning((on) => !on);
            }}
          >
            {scanning ? (
              "Type a code instead"
            ) : (
              <>
                <CardMark />
                Scan my card
              </>
            )}
          </Button>
        )}
      </div>
    </JoinFrame>
  );
}

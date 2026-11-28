import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "../log.ts";
import { nativeConfig, speech, voice, VoiceError } from "../native.ts";
import { ENDPOINT, Endpointer } from "./endpoint.ts";
import { cleanTranscript } from "./transcript.ts";

/**
 * One voice question, from the first tap to editable text:
 *
 *   idle -> starting -> listening -> transcribing -> done | nothing
 *
 * plus `denied` (microphone permission refused), `unavailable` (the bundled
 * model could not be installed, even after a retry) and `failed`. The first tap
 * is where iOS and Android ask for the microphone, in context; nothing asks
 * earlier. Listening ends on its own after a pause (endpoint.ts), on a second
 * tap, or at the time cap. The transcript is handed to `onText` for the
 * person to check and edit; it is never asked automatically.
 *
 * In `denied`, the tap opens the app's settings (a tap that would only fail
 * again is never offered); coming back to the app resets to `idle`.
 *
 * Every await is followed by a check that this screen is still open and the
 * session is still the current one, so leaving the screen mid-start or a
 * late timer never leaves the microphone on or stops someone else's session.
 */
export type VoicePhase = "idle" | "starting" | "listening" | "transcribing" | "done" | "nothing" | "denied" | "unavailable" | "failed";

const failure = (e: unknown): VoicePhase => (e instanceof VoiceError ? (e.kind === "permission" ? "denied" : e.kind === "unavailable" ? "unavailable" : "failed") : "failed");

export function useVoiceInput(lang: string, onText: (text: string) => void) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0);
  const session = useRef<string | null>(null);
  const busy = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const release = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = null;
    if (mounted.current) setLevel(0);
  };

  const set = (p: VoicePhase) => {
    if (mounted.current) setPhase(p);
  };

  /**
   * End `id`, if it is still this screen's session: transcribe it, or, when
   * nothing was heard, discard it without touching what is in the box.
   */
  const finish = useCallback(async (id: string, outcome: "done" | "nothing-heard" = "done") => {
    if (session.current !== id) return;
    session.current = null;
    release();
    if (!mounted.current || outcome === "nothing-heard") {
      await voice.cancel(id);
      set("nothing");
      return;
    }
    set("transcribing");
    try {
      const text = cleanTranscript(await voice.stop(id), nativeConfig().voicePrompt);
      if (!mounted.current) return;
      if (!text) return set("nothing");
      onTextRef.current(text);
      set("done");
    } catch (e) {
      logError("voice.stop", e);
      set(failure(e));
    }
  }, []);

  const start = useCallback(async () => {
    await speech.stop(); // never record our own read-aloud
    set("starting");
    const ep = new Endpointer();
    try {
      const unsub = await voice.onLevel((rms, t) => {
        const id = session.current;
        if (!id) return;
        setLevel(rms);
        const r = ep.push(t, rms);
        if (r !== "listening") void finish(id, r);
      });
      if (!mounted.current) return unsub();
      unsubscribe.current = unsub;
      const id = await voice.start(lang);
      if (!mounted.current) {
        // The screen closed while the microphone was starting: stop it now.
        release();
        await voice.cancel(id);
        return;
      }
      session.current = id;
      set("listening");
      // The cap holds even if the platform sends no level readings.
      capTimer.current = setTimeout(() => void finish(id), ENDPOINT.maxMs + 500);
    } catch (e) {
      release();
      session.current = null;
      logError("voice.start", e);
      set(failure(e));
    }
  }, [lang, finish]);

  /** The one control. Ignored while starting or transcribing. */
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      // A tap just as listening ended on its own must not start a new session.
      if (phase === "listening") {
        if (session.current) await finish(session.current);
      } else if (phase === "denied") await voice.openSettings();
      else if (phase !== "starting" && phase !== "transcribing" && phase !== "unavailable") await start();
    } finally {
      busy.current = false;
    }
  }, [phase, finish, start]);

  // Back from Settings: try again from a clean state.
  useEffect(() => {
    if (phase !== "denied") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") set("idle");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const id = session.current;
      session.current = null;
      release();
      if (id) void voice.cancel(id);
    };
  }, []);

  return { phase, level, toggle };
}

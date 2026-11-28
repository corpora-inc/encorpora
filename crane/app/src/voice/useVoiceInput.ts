import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "../lib/log.ts";
import { speech, voice, VoiceError } from "../lib/native.ts";
import { ENDPOINT, Endpointer } from "./endpoint.ts";
import { cleanTranscript } from "./transcript.ts";

/**
 * One voice question, from the first tap to editable text:
 *
 *   idle -> starting -> listening -> transcribing -> done | nothing
 *
 * plus `denied` (microphone permission refused) and `failed`. The first tap
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
export type VoicePhase = "idle" | "starting" | "listening" | "transcribing" | "done" | "nothing" | "denied" | "failed";

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

  /** Stop and transcribe `id`, if it is still this screen's session. */
  const finish = useCallback(async (id: string) => {
    if (session.current !== id) return;
    session.current = null;
    release();
    if (!mounted.current) {
      await voice.cancel(id);
      return;
    }
    set("transcribing");
    try {
      const text = cleanTranscript(await voice.stop(id));
      if (!mounted.current) return;
      if (!text) return set("nothing");
      onTextRef.current(text);
      set("done");
    } catch (e) {
      logError("voice.stop", e);
      set(e instanceof VoiceError && e.kind === "permission" ? "denied" : "failed");
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
        if (ep.push(t, rms) === "done") void finish(id);
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
      set(e instanceof VoiceError && e.kind === "permission" ? "denied" : "failed");
    }
  }, [lang, finish]);

  /** The one control. Ignored while starting or transcribing. */
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (phase === "listening" && session.current) await finish(session.current);
      else if (phase === "denied") await voice.openSettings();
      else if (phase !== "starting" && phase !== "transcribing") await start();
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

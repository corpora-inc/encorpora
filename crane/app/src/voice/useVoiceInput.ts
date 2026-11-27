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
 * earlier. Listening ends on its own after a pause (see endpoint.ts), on a
 * second tap, or at the time cap. The transcript is handed to `onText` for the
 * person to check and edit; it is never asked automatically.
 */
export type VoicePhase = "idle" | "starting" | "listening" | "transcribing" | "done" | "nothing" | "denied" | "failed";

export function useVoiceInput(lang: string, onText: (text: string) => void) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0);
  const session = useRef<string | null>(null);
  const busy = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heard = useRef(false);
  const mounted = useRef(true);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const release = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = null;
    setLevel(0);
  };

  const set = (p: VoicePhase) => {
    if (mounted.current) setPhase(p);
  };

  const finish = useCallback(async (outcome: "done" | "nothing-heard") => {
    const id = session.current;
    if (!id) return;
    session.current = null;
    release();
    if (outcome === "nothing-heard") {
      await voice.cancel(id);
      set("nothing");
      return;
    }
    set("transcribing");
    try {
      const text = cleanTranscript(await voice.stop(id));
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
    heard.current = false;
    const ep = new Endpointer();
    try {
      unsubscribe.current = await voice.onLevel((rms, t) => {
        if (!session.current) return;
        setLevel(rms);
        const r = ep.push(t, rms);
        heard.current = ep.speechHeard;
        if (r !== "listening") void finish(r);
      });
      session.current = await voice.start(lang);
      set("listening");
      // The cap holds even if the platform sends no level readings.
      capTimer.current = setTimeout(() => void finish("done"), ENDPOINT.maxMs + 500);
    } catch (e) {
      release();
      session.current = null;
      logError("voice.start", e);
      set(e instanceof VoiceError && e.kind === "permission" ? "denied" : "failed");
    }
  }, [lang, finish]);

  /** The one control: starts, or ends listening early. Ignored while starting or transcribing. */
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (phase === "listening") await finish("done");
      else if (phase !== "starting" && phase !== "transcribing") await start();
    } finally {
      busy.current = false;
    }
  }, [phase, finish, start]);

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

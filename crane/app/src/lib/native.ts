/**
 * Native seams. In the Tauri shell these call the shared plugins
 * (tauri-plugin-tts, tauri-plugin-stt, tauri-plugin-corpan-llm); in a plain
 * browser they fall back to what the platform offers, or report unavailable
 * so the UI never shows a control that cannot work.
 */
import { logError } from "./log.ts";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function tauriInvoke(): Invoke | null {
  const w = globalThis as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } };
  return w.__TAURI_INTERNALS__?.invoke ?? null;
}

export const isNative = () => tauriInvoke() !== null;

/** Read aloud. */
export const speech = {
  available(): boolean {
    return isNative() || (typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined");
  },
  async speak(text: string, lang: string): Promise<void> {
    const invoke = tauriInvoke();
    if (invoke) {
      await invoke("plugin:tts|speak", { args: { text, language: lang } });
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    await new Promise<void>((resolve, reject) => {
      u.onend = () => resolve();
      u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
      speechSynthesis.speak(u);
    });
  },
  async stop(): Promise<void> {
    const invoke = tauriInvoke();
    try {
      if (invoke) await invoke("plugin:tts|stop");
      else if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    } catch (e) {
      logError("speech.stop", e);
    }
  },
};

/**
 * Voice input: on-device only (whisper.cpp in tauri-plugin-stt). Available
 * only when the platform supports it AND the default model is installed and
 * valid on disk: `is_available` alone is true on iOS with no model, which
 * would offer a microphone that fails on every tap. The caller owns the
 * session id.
 * Payloads match the plugin's `StartSessionArgs` / `StopSessionArgs`
 * (camelCase, wrapped in `args`); native.test.ts pins them to the plugin source.
 */
export const voice = {
  async available(): Promise<boolean> {
    const invoke = tauriInvoke();
    if (!invoke) return false;
    try {
      if ((await invoke("plugin:stt|is_available")) !== true) return false;
      const model = (await invoke("plugin:stt|validate_model", {})) as { valid?: boolean };
      return model.valid === true;
    } catch (e) {
      logError("voice.available", e);
      return false;
    }
  },
  async start(lang: string): Promise<string> {
    const invoke = tauriInvoke();
    if (!invoke) throw new Error("Voice input needs the app");
    const ready = (await invoke("plugin:stt|prepare", { args: {} })) as { ready: boolean; message?: string | null };
    if (!ready.ready) throw new Error(ready.message ?? "Voice input is not ready on this device");
    const sessionId = crypto.randomUUID();
    const started = (await invoke("plugin:stt|start_session", { args: { sessionId, language: lang, expectedText: "" } })) as { started: boolean };
    if (!started.started) throw new Error("Voice input could not start");
    return sessionId;
  },
  async stop(sessionId: string): Promise<string> {
    const invoke = tauriInvoke();
    if (!invoke) throw new Error("Voice input needs the app");
    const r = (await invoke("plugin:stt|stop_session", { args: { sessionId } })) as { text: string };
    return r.text.trim();
  },
};

/**
 * On-device assistant (optional, off by default). The seam for a later
 * model download: `status()` says whether a model is present. Nothing in the
 * app depends on it.
 */
export const assistant = {
  async status(): Promise<{ present: boolean; model: string | null }> {
    const invoke = tauriInvoke();
    if (!invoke) return { present: false, model: null };
    try {
      // StatusResponse is camelCase: { loaded, modelId, … } (tauri-plugin-corpan-llm/src/models.rs).
      const s = (await invoke("plugin:corpan-llm|llm_status")) as { loaded?: boolean; modelId?: string | null };
      return { present: Boolean(s.loaded), model: s.modelId ?? null };
    } catch (e) {
      logError("assistant.status", e);
      return { present: false, model: null };
    }
  },
};

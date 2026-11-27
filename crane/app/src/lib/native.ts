/**
 * Native seams. In the Tauri shell these call the shared plugins
 * (tauri-plugin-tts, tauri-plugin-stt, tauri-plugin-corpan-llm); in a plain
 * browser they fall back to what the platform offers, or report unavailable
 * so the UI never shows a control that cannot work.
 */
import { logError } from "./log.ts";

type Invoke = (cmd: string, args?: Record<string, unknown> | Uint8Array, options?: { headers?: Record<string, string> }) => Promise<unknown>;

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

/**
 * Save a file the app built. In the app: the system save dialog (desktop,
 * Android) or the share sheet (iOS), through the `export_file` app command.
 * In a browser: a download.
 */
export type SaveOutcome = "saved" | "shared" | "cancelled";
export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<SaveOutcome> {
  const invoke = tauriInvoke();
  if (invoke) {
    // Android's IPC carries JSON only (no raw body), so send base64 there.
    const r = /Android/i.test(navigator.userAgent)
      ? await invoke("export_file", { name, data: toBase64(bytes) })
      : await invoke("export_file", bytes, { headers: { "x-file-name": name } });
    if (r === "saved" || r === "shared" || r === "cancelled") return r;
    throw new Error(`Unexpected export result ${String(r)}`);
  }
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return "saved";
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  // Chunked: String.fromCharCode with a huge spread overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Printing works in browsers and desktop WebViews; mobile WebViews have no print dialog. */
export function canPrint(): boolean {
  if (typeof window === "undefined" || typeof window.print !== "function") return false;
  return !(isNative() && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
}


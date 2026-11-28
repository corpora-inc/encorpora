/**
 * Native seams. In the Tauri shell these call the shared plugins
 * (tauri-plugin-tts, tauri-plugin-stt, tauri-plugin-corpan-llm); in a plain
 * browser they fall back to what the platform offers, or report unavailable
 * so the UI never shows a control that cannot work.
 */
import { addPluginListener } from "@tauri-apps/api/core";
import VOICE_MODEL from "../../src-tauri/voice-model.json";
import { VOCAB_PROMPT } from "../voice/prompt.ts";
import { pickVoice, type VoiceOption } from "../voice/voices.ts";
import { PRODUCT } from "../config.ts";
import { logError } from "./log.ts";

type Invoke = (cmd: string, args?: Record<string, unknown> | Uint8Array, options?: { headers?: Record<string, string> }) => Promise<unknown>;

function tauriInvoke(): Invoke | null {
  const w = globalThis as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } };
  return w.__TAURI_INTERNALS__?.invoke ?? null;
}

export const isNative = () => tauriInvoke() !== null;

/** The most natural offline voice for a language, looked up once per language. */
const voiceChoice = new Map<string, Promise<string | null>>();
function chosenVoice(invoke: Invoke, lang: string): Promise<string | null> {
  let p = voiceChoice.get(lang);
  if (!p) {
    p = (async () => {
      try {
        const voices = (await invoke("plugin:tts|list_voices")) as VoiceOption[];
        return pickVoice(voices, lang)?.id ?? null;
      } catch (e) {
        logError("speech.voices", e);
        return null; // the platform default voice still works
      }
    })();
    voiceChoice.set(lang, p);
  }
  return p;
}

function browserVoice(lang: string): SpeechSynthesisVoice | null {
  const all = speechSynthesis.getVoices();
  const options: VoiceOption[] = all.map((v) => ({
    id: v.voiceURI,
    language: v.lang,
    name: v.name,
    quality: /premium|enhanced|neural|natural/i.test(v.name) ? "enhanced" : null,
    networkRequired: !v.localService,
  }));
  const pick = pickVoice(options, lang);
  return pick ? (all.find((v) => v.voiceURI === pick.id) ?? null) : null;
}

/** Read aloud, with the most natural voice the device has offline (voice/voices.ts). */
export const speech = {
  available(): boolean {
    return isNative() || (typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined");
  },
  async speak(text: string, lang: string): Promise<void> {
    const invoke = tauriInvoke();
    if (invoke) {
      const voiceId = await chosenVoice(invoke, lang);
      // An undefined voiceId is dropped from the JSON: the platform default voice speaks.
      await invoke("plugin:tts|speak", { args: { text, language: lang, voiceId: voiceId ?? undefined } });
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = browserVoice(lang);
    if (v) u.voice = v;
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
 * Voice input: on-device only (whisper.cpp in tauri-plugin-stt), with the
 * speech model bundled in the app (src-tauri/voice-model.json; the Rust side
 * installs it on first launch, see src-tauri/src/voice.rs). Available only
 * when the bundled model is installed AND the plugin can use it: `is_available`
 * alone is true on iOS with no model, which would offer a microphone that
 * fails on every tap. The caller owns the session id.
 *
 * Payloads match the plugin (`StartSessionArgs`: camelCase in `args`, the
 * whisper overrides snake_case as in whisper.h); native.test.ts pins them to
 * the plugin source. Audio never leaves the device: the plugin records and
 * transcribes locally, and the app has no network access (CSP).
 */
export type VoiceErrorKind = "permission" | "unavailable" | "failed";

/** What went wrong, from the plugin's rejection (iOS: "CODE: message"; Android: a code field). */
export function voiceErrorKind(raw: unknown): VoiceErrorKind {
  const code = typeof raw === "object" && raw !== null && "code" in raw ? String((raw as { code: unknown }).code) : "";
  const text = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  if (code === "MIC_PERMISSION_DENIED" || /MIC_PERMISSION_DENIED|microphone access/i.test(text)) return "permission";
  return "failed";
}

export class VoiceError extends Error {
  readonly kind: VoiceErrorKind;
  constructor(raw: unknown, kind?: VoiceErrorKind) {
    super(raw instanceof Error ? raw.message : String(raw));
    this.name = "VoiceError";
    this.kind = kind ?? voiceErrorKind(raw);
  }
}

const asVoiceError = async <T>(p: Promise<T>): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    throw new VoiceError(e);
  }
};

export const voice = {
  /** The bundled model's file name, which the plugin also uses as its model id. */
  model: VOICE_MODEL.file,
  async available(): Promise<boolean> {
    const invoke = tauriInvoke();
    if (!invoke) return false;
    try {
      // Answers at once: on a first launch the model may still be copying
      // ("installing"), which counts; the first tap waits for it.
      const bundled = (await invoke("voice_model", { wait: false })) as { status: string; file: string };
      if (bundled.status !== "ready" && bundled.status !== "installing") return false;
      if ((await invoke("plugin:stt|is_available")) !== true) return false;
      if (bundled.status === "installing") return true;
      const model = (await invoke("plugin:stt|validate_model", { model: bundled.file })) as { valid?: boolean };
      return model.valid === true;
    } catch (e) {
      logError("voice.available", e);
      return false;
    }
  },
  /** Load the model and start recording. The first call asks for microphone permission, in context. */
  async start(lang: string): Promise<string> {
    const invoke = tauriInvoke();
    if (!invoke) throw new VoiceError("Voice input needs the app");
    const bundled = (await asVoiceError(invoke("voice_model", { wait: true }))) as { status: string };
    // The install failed even after a retry: voice cannot work in this launch.
    if (bundled.status !== "ready") throw new VoiceError(`The speech model is ${bundled.status}`, "unavailable");
    const ready = (await asVoiceError(invoke("plugin:stt|prepare", { args: { model: VOICE_MODEL.file } }))) as { ready: boolean; message?: string | null };
    if (!ready.ready) throw new VoiceError(ready.message ?? "The speech model could not load");
    const sessionId = crypto.randomUUID();
    const started = (await asVoiceError(invoke("plugin:stt|start_session", { args: { sessionId, language: lang, expectedText: "", whisperParams: { initial_prompt: VOCAB_PROMPT } } }))) as { started: boolean };
    if (!started.started) throw new VoiceError("Voice input could not start");
    return sessionId;
  },
  /** Stop recording and return the transcript. */
  async stop(sessionId: string): Promise<string> {
    const invoke = tauriInvoke();
    if (!invoke) throw new VoiceError("Voice input needs the app");
    const r = (await asVoiceError(invoke("plugin:stt|stop_session", { args: { sessionId } }))) as { text: string };
    return r.text.trim();
  },
  /** Stop recording and discard it. */
  async cancel(sessionId: string): Promise<void> {
    const invoke = tauriInvoke();
    if (!invoke) return;
    try {
      await invoke("plugin:stt|cancel_session", { args: { sessionId } });
    } catch (e) {
      logError("voice.cancel", e);
    }
  },
  /**
   * Open the place the person can turn the microphone back on: the app's
   * page in Settings (iOS), or the app's details screen (Android).
   */
  async openSettings(): Promise<void> {
    const invoke = tauriInvoke();
    if (!invoke) return;
    try {
      // open_app_details(args: OpenAppDetailsArgs): wrapped in `args` like the other tts commands.
      if (/Android/i.test(navigator.userAgent)) await invoke("plugin:tts|open_app_details", { args: { packageName: PRODUCT.bundleId } });
      else await invoke("plugin:tts|open_tts_settings");
    } catch (e) {
      logError("voice.openSettings", e);
    }
  },
  /** Microphone level while recording (about 8 per second): RMS 0..1, and ms since recording began. */
  async onLevel(cb: (rms: number, t: number) => void): Promise<() => void> {
    if (!isNative()) return () => {};
    const handle = await addPluginListener<{ rms: number; t: number }>("stt", "audio_level", (e) => cb(e.rms, e.t));
    return () => {
      handle.unregister().catch((e: unknown) => logError("voice.onLevel", e));
    };
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


/**
 * Native seams. The shared ones (read-aloud, on-device voice input, the
 * assistant status, saving files, printing) live in the shared app kit,
 * harvest/appkit/src/native.ts, configured for crane in lib/appkit.ts. The
 * crane-only commands (the signed pack, the Instructor) are here.
 */
import "./appkit.ts";
import { tauriInvoke } from "../../../../harvest/appkit/src/native.ts";

export { assistant, canPrint, isNative, saveFile, speech, voice, VoiceError, voiceErrorKind, type SaveOutcome, type VoiceErrorKind } from "../../../../harvest/appkit/src/native.ts";

/**
 * The signed pack, in the native app: harvest-core installs and verifies it
 * (src-tauri/src/pack.rs) and returns the read API's lists as harvest-show/1
 * JSON text. Null in a browser, which reads the served copy instead.
 */
export const pack = {
  async show(): Promise<string | null> {
    const invoke = tauriInvoke();
    if (!invoke) return null;
    return (await invoke("pack_show")) as string;
  },
};

/**
 * The Instructor in the native app: harvest-core answers each turn
 * (src-tauri/src/instructor.rs; the on-device model plugs in there). Null in a
 * browser, which answers from the precomputed tree turns instead.
 */
type NativeTurn = import("../instructor/answer.ts").TurnBody;
export const instructorNative = {
  async welcome(learner: unknown): Promise<NativeTurn | null> {
    const invoke = tauriInvoke();
    return invoke ? ((await invoke("instructor_welcome", { learner })) as NativeTurn) : null;
  },
  async turn(request: unknown): Promise<NativeTurn | null> {
    const invoke = tauriInvoke();
    return invoke ? ((await invoke("instructor_turn", { request })) as NativeTurn) : null;
  },
};


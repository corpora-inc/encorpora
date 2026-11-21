import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Preferences = {
  sound: boolean;
  haptics: boolean;
  set: (name: "sound" | "haptics", enabled: boolean) => void;
};
/** Device preferences only; no learning or account information is stored.
 * Both are on until someone turns one off on this device; a saved choice
 * always stands. Haptics play only where the browser can vibrate. */
export const useFeedbackPreferences = create<Preferences>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      set: (name, enabled) => set({ [name]: enabled }),
    }),
    {
      name: "amp.feedback-preferences",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch (error) {
            console.warn("Feedback preferences not read", error);
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            // Memory-only preferences when storage is unavailable.
            console.warn("Feedback preferences not saved", error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn("Feedback preferences not cleared", error);
          }
        },
      })),
      partialize: ({ sound, haptics }) => ({ sound, haptics }),
      merge: (saved, current) => {
        const value = saved as Partial<Preferences> | null;
        return {
          ...current,
          sound:
            typeof value?.sound === "boolean" ? value.sound : current.sound,
          haptics:
            typeof value?.haptics === "boolean"
              ? value.haptics
              : current.haptics,
        };
      },
    },
  ),
);

let context: AudioContext | undefined;
/** Called from the answer gesture so browsers can unlock audio before grading. */
export function prepareFeedbackSound() {
  if (
    !useFeedbackPreferences.getState().sound ||
    typeof AudioContext === "undefined"
  )
    return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended")
      void context
        .resume()
        .catch((error: unknown) =>
          console.warn("Feedback sound not resumed", error),
        );
  } catch (error) {
    // Sound is optional; an unavailable device must not block an answer.
    console.warn("Feedback sound unavailable", error);
  }
}

/** A look's own right-answer sound: the notes (Hz) to play in order, and
 * whether each gets a soft octave above it. Null: the plain sound. Colorful
 * registers one (celebration/sound.ts); Calm never does. */
export type FeedbackVoice = (
  milestone: boolean,
) => { notes: readonly number[]; rich?: boolean; step?: number } | null;
let voice: FeedbackVoice | null = null;
/** Use `next` for right answers until the returned release is called. */
export function setFeedbackVoice(next: FeedbackVoice) {
  voice = next;
  return () => {
    if (voice === next) voice = null;
  };
}

/** Never awaited by the learning loop. Existing outcomes do not call this. */
export function playCorrectFeedback(milestone = false) {
  const preferences = useFeedbackPreferences.getState();
  if (preferences.haptics && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(milestone ? [15, 50, 15] : 12);
    } catch (error) {
      // Unsupported or denied.
      console.warn("Feedback vibration unavailable", error);
    }
  }
  if (!preferences.sound || !context || context.state !== "running") return;
  try {
    const audio = context;
    let custom: ReturnType<FeedbackVoice> = null;
    try {
      custom = voice?.(milestone) ?? null;
    } catch (error) {
      console.warn("Feedback voice failed; the plain sound plays", error);
    }
    const notes =
      custom?.notes ??
      (milestone ? [523.25, 659.25, 783.99] : [659.25, 783.99]);
    const step = custom?.step ?? 0.07;
    const tone = (
      frequency: number,
      at: number,
      peak: number,
      type: OscillatorType,
    ) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(peak, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };
    notes.forEach((frequency, i) => {
      const at = audio.currentTime + i * step;
      tone(frequency, at, 0.035, "sine");
      if (custom?.rich) tone(frequency * 2, at, 0.01, "triangle");
    });
  } catch (error) {
    // Feedback never affects answer delivery or progression.
    console.warn("Feedback sound not played", error);
  }
}

useFeedbackPreferences.subscribe((state, previous) => {
  if (!state.sound && previous.sound && context?.state === "running")
    void context
      .suspend()
      .catch((error: unknown) =>
        console.warn("Feedback sound not suspended", error),
      );
});

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Preferences = {
  sound: boolean;
  haptics: boolean;
  set: (name: "sound" | "haptics", enabled: boolean) => void;
};
/** Device preferences only; no learning or account information is stored. */
export const useFeedbackPreferences = create<Preferences>()(
  persist(
    (set) => ({
      sound: false,
      haptics: false,
      set: (name, enabled) => set({ [name]: enabled }),
    }),
    {
      name: "amp.feedback-preferences",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            /* Memory-only preferences when storage is unavailable. */
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            /* Storage unavailable. */
          }
        },
      })),
      partialize: ({ sound, haptics }) => ({ sound, haptics }),
      merge: (saved, current) => {
        const value = saved as Partial<Preferences> | null;
        return {
          ...current,
          sound: value?.sound === true,
          haptics: value?.haptics === true,
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
      void context.resume().catch(() => undefined);
  } catch {
    /* Sound is optional; an unavailable device must not block an answer. */
  }
}

/** Never awaited by the learning loop. Existing outcomes do not call this. */
export function playCorrectFeedback(milestone = false) {
  const preferences = useFeedbackPreferences.getState();
  if (preferences.haptics && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(milestone ? [15, 50, 15] : 12);
    } catch {
      /* Unsupported or denied. */
    }
  }
  if (!preferences.sound || !context || context.state !== "running") return;
  try {
    const audio = context;
    const notes = milestone ? [523.25, 659.25, 783.99] : [659.25, 783.99];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + i * 0.07;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.035, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Feedback never affects answer delivery or progression. */
  }
}

useFeedbackPreferences.subscribe((state, previous) => {
  if (!state.sound && previous.sound && context?.state === "running")
    void context.suspend().catch(() => undefined);
});

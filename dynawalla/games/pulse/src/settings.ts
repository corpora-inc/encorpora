/** Persisted preferences. Tiny, local, and never required for the game to run. */

const KEY = "pulse.settings.v1";

export type Settings = {
  muted: boolean;
  calibrationMs: number;
  best: number;
  bestCombo: number;
};

const DEFAULTS: Settings = { muted: false, calibrationMs: 0, best: 0, bestCombo: 0 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      muted: typeof p.muted === "boolean" ? p.muted : DEFAULTS.muted,
      calibrationMs:
        typeof p.calibrationMs === "number" && Math.abs(p.calibrationMs) <= 250 ? p.calibrationMs : 0,
      best: typeof p.best === "number" && p.best >= 0 ? p.best : 0,
      bestCombo: typeof p.bestCombo === "number" && p.bestCombo >= 0 ? p.bestCombo : 0,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode, quota, whatever — the game does not care */
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

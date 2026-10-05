/** The answer's moment: a short burst around Next, a light haptic, a gentle shake for a miss.
 * Everything here is an overlay (position: fixed, pointer-events: none) or a transform on the
 * answer field, so the stable stage never reflows. Nothing blocks: Next is tappable at once. */
import { isTauri } from "@tauri-apps/api/core";

/** Escalation for consecutive correct answers: 0 plain, 1 from three in a row, 2 from five. */
export function streakLevel(streak: number): 0 | 1 | 2 {
  return streak >= 5 ? 2 : streak >= 3 ? 1 : 0;
}
/** Streaks worth naming: three, five, then every five. */
export function isMilestone(streak: number): boolean {
  return streak === 3 || (streak >= 5 && streak % 5 === 0);
}

const HAPTICS_KEY = "aha.haptics";
/** Haptics preference, on unless the learner turned it off on this device. */
export function hapticsEnabled(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(HAPTICS_KEY) !== "off";
  } catch (error) {
    console.warn("[aha] Could not read the haptics setting; keeping haptics on.", error);
    return true;
  }
}
export function setHapticsEnabled(on: boolean, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(HAPTICS_KEY, on ? "on" : "off");
  } catch (error) {
    console.warn("[aha] Could not save the haptics setting.", error);
  }
}
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export type Feel = "correct" | "milestone" | "wrong";
let hapticsWarned = false;
/** A light tap for correct, a success notification for a streak milestone, a soft one for a miss.
 * Desktop and web have no haptics: the call is skipped or does nothing, with one logged warning. */
export async function feel(kind: Feel): Promise<void> {
  if (!hapticsEnabled() || !isTauri()) return;
  try {
    const haptics = await import("@tauri-apps/plugin-haptics");
    if (kind === "milestone") await haptics.notificationFeedback("success");
    else await haptics.impactFeedback(kind === "correct" ? "light" : "soft");
  } catch (error) {
    if (hapticsWarned) return;
    hapticsWarned = true;
    console.warn("[aha] Haptics unavailable here; continuing without them.", error);
  }
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#357e75", "#e0a526", "#d3543d", "#86c9bb", "#f3c969"];
/** Longest burst, in ms; the whole moment stays under ~900ms. */
export const BURST_MS = 860;

/** Confetti and a radiant ring from the centre of `anchor` (the Next button in Check's slot).
 * Skipped under reduced motion: the toast's gentle fade is the whole celebration then. */
export function burst(anchor: Element | null, level: 0 | 1 | 2 = 0): void {
  if (!anchor || reducedMotion() || typeof document === "undefined") return;
  const r = anchor.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const layer = document.createElement("div");
  layer.className = "aha-burst";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${r.left + r.width / 2}px`;
  layer.style.top = `${r.top + r.height / 2}px`;
  const ease = "cubic-bezier(0.15, 0.75, 0.3, 1)";
  const ring = document.createElement("i");
  ring.className = `aha-burst-ring${level ? " is-gold" : ""}`;
  layer.append(ring);
  ring.animate(
    [{ transform: "scale(0.5)", opacity: 0.85 }, { transform: `scale(${2.4 + level * 0.5})`, opacity: 0 }],
    { duration: 560 + level * 80, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
  );
  const count = 16 + level * 8;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("i");
    const confetti = i % 3 !== 0;
    bit.className = confetti ? "aha-burst-bit is-confetti" : "aha-burst-bit";
    bit.style.background = COLORS[i % COLORS.length]!;
    layer.append(bit);
    // Mostly up and out (the dock sits low on the screen), evenly spread with a little jitter.
    const angle = -Math.PI * (0.04 + 0.92 * ((i + Math.random() * 0.8) / count));
    const distance = (58 + Math.random() * 46) * (1 + level * 0.28);
    const x = Math.cos(angle) * distance * 1.2;
    const y = Math.sin(angle) * distance;
    const spin = (Math.random() - 0.5) * 540;
    const duration = 560 + Math.random() * 240 + level * 40;
    bit.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${x * 0.82}px), calc(-50% + ${y * 0.82}px)) scale(1) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + 22}px)) scale(0.7) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: Math.min(BURST_MS, duration), delay: Math.random() * 40, easing: ease, fill: "forwards" },
    );
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), BURST_MS + 80);
}

/** A gentle sideways shake of the answer field alone (never the page). */
export function shake(target: Element | null): void {
  if (!target || reducedMotion() || typeof (target as HTMLElement).animate !== "function") return;
  const animation = (target as HTMLElement).animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-7px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 340, easing: "ease-in-out" },
  );
  animation.id = "aha-shake";
}

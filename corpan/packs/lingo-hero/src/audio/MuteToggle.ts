/**
 * MuteToggle — a self-contained, neon-styled mute control for the audio stream.
 *
 * The audio stream owns ONLY src/audio/*, so rather than ask the HUD for a
 * button this module builds and manages its own floating control. It is styled
 * entirely from the shared Neon Arcade `--na-*` design tokens (via inline
 * custom-property-referencing styles) so it reads as part of the same system
 * without us editing styles.css. Fully offline — pure DOM + inline SVG, no
 * fonts, no assets, no network.
 *
 * Behavior:
 *   - Persists the on/off state to localStorage so the preference sticks.
 *   - Calls back into the audio layer (which drives SynthEngine.setMuted +
 *     MusicBed) on every change.
 *   - Anchors itself to the HUD's `.ui-layer` overlay when present (so it sits
 *     inside the game's safe-area-aware coordinate space); falls back to the
 *     document body otherwise. Re-anchors lazily if the layer mounts later.
 *   - Respects touch + small screens (44px hit target, safe-area insets).
 */

const STORAGE_KEY = "lingoHero.audio.muted";

/** Speaker-on / speaker-off inline SVGs (no external icon font). */
const ICON_ON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>`;
const ICON_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/></svg>`;

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* storage may be unavailable (private mode); state is still in-memory */
  }
}

export class MuteToggle {
  private readonly btn: HTMLButtonElement;
  private readonly onChange: (muted: boolean) => void;
  private muted: boolean;
  private mounted = false;

  constructor(onChange: (muted: boolean) => void) {
    this.onChange = onChange;
    this.muted = readStoredMuted();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "na-mute-toggle";
    this.applyBaseStyle(btn);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
    // Keep the canvas/lane input from also receiving the tap.
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("touchstart", (e) => e.stopPropagation(), {
      passive: true,
    });

    this.btn = btn;
    this.render();
  }

  /** The persisted/initial mute state, so the engine can sync at startup. */
  get isMuted(): boolean {
    return this.muted;
  }

  /** Attach to the HUD overlay (or body). Idempotent + lazily re-tries. */
  attach(): void {
    if (this.mounted && this.btn.isConnected) return;
    const host =
      (document.querySelector(".ui-layer") as HTMLElement | null) ??
      document.body;
    if (!host) return;
    host.appendChild(this.btn);
    this.mounted = true;
  }

  private toggle(): void {
    this.muted = !this.muted;
    writeStoredMuted(this.muted);
    this.render();
    this.onChange(this.muted);
  }

  private render(): void {
    this.btn.innerHTML = this.muted ? ICON_OFF : ICON_ON;
    this.btn.setAttribute("aria-pressed", this.muted ? "true" : "false");
    this.btn.setAttribute(
      "aria-label",
      this.muted ? "Unmute sound" : "Mute sound"
    );
    this.btn.title = this.muted ? "Sound off" : "Sound on";
    // Active = lime-glow on; muted = dimmed faint.
    if (this.muted) {
      this.btn.style.color = "var(--na-text-faint, #8a90b8)";
      this.btn.style.borderColor = "var(--na-glass-stroke, rgba(255,255,255,.12))";
      this.btn.style.boxShadow = "var(--na-shadow-panel, 0 8px 24px rgba(0,0,0,.5))";
    } else {
      this.btn.style.color = "var(--na-accent, #2ff3ff)";
      this.btn.style.borderColor = "var(--na-accent, #2ff3ff)";
      this.btn.style.boxShadow =
        "var(--na-glow-cyan, 0 0 12px rgba(47,243,255,.55)), var(--na-shadow-panel, 0 8px 24px rgba(0,0,0,.5))";
    }
  }

  private applyBaseStyle(btn: HTMLButtonElement): void {
    const css: Record<string, string> = {
      position: "absolute",
      top: "calc(var(--na-space-3, 12px) + env(safe-area-inset-top, 0px))",
      right: "calc(var(--na-space-3, 12px) + env(safe-area-inset-right, 0px))",
      "z-index": "var(--na-z-overlay, 40)",
      width: "44px",
      height: "44px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "0",
      margin: "0",
      "border-radius": "var(--na-radius-pill, 999px)",
      border: "1px solid var(--na-accent, #2ff3ff)",
      background: "var(--na-glass-bg, rgba(18,20,40,.55))",
      "backdrop-filter": "blur(10px)",
      "-webkit-backdrop-filter": "blur(10px)",
      color: "var(--na-accent, #2ff3ff)",
      cursor: "pointer",
      transition:
        "transform var(--na-dur-fast, 140ms) var(--na-ease-snap, ease), box-shadow var(--na-dur-base, 240ms) var(--na-ease-out, ease), color var(--na-dur-base, 240ms) var(--na-ease-out, ease), border-color var(--na-dur-base, 240ms) var(--na-ease-out, ease)",
      "-webkit-tap-highlight-color": "transparent",
      "touch-action": "manipulation",
      "user-select": "none",
    };
    for (const [prop, value] of Object.entries(css)) {
      btn.style.setProperty(prop, value);
    }

    btn.addEventListener("pointerenter", () => {
      btn.style.transform = "scale(1.06)";
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "scale(1)";
    });
    btn.addEventListener("pointerdown", () => {
      btn.style.transform = "scale(0.92)";
    });
    btn.addEventListener("pointerup", () => {
      btn.style.transform = "scale(1.06)";
    });
  }

  dispose(): void {
    try {
      this.btn.remove();
    } catch {
      /* already detached */
    }
    this.mounted = false;
  }
}

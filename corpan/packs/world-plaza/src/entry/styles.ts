/**
 * Scoped styles for the World Plaza ENTRY surfaces (premium welcome + language
 * chooser). Per the OWNERSHIP rule for this slice we do NOT touch the shared
 * `styles.css` (other agents live there). Instead we inject ONE
 * `<style data-wp-entry>` block (idempotent — mirrors `ensureVignetteStyles` /
 * `badgeCase.ensureStyles`) namespaced under `.wp-entry*`.
 *
 * Visual language: warm-Antigua paper — the same morning-light, deckle-edged,
 * ink-on-cream feel as the onboarding card + the world's HUD, with an accent var
 * (`--wp-entry-accent`) the chooser/welcome tint to the scene. Fullscreen,
 * compositor-only transitions, `prefers-reduced-motion` aware, ≥44px targets.
 */

const STYLE_ATTR = "data-wp-entry"

export function ensureEntryStyles(): void {
  if (typeof document === "undefined") return
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return
  const style = document.createElement("style")
  style.setAttribute(STYLE_ATTR, "")
  style.textContent = CSS
  document.head.appendChild(style)
}

const CSS = `
.wp-entry-root {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  box-sizing: border-box;
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif;
  color: #2a2018;
  background:
    radial-gradient(120% 90% at 50% 18%, rgba(255, 246, 224, 0.96), rgba(232, 214, 182, 0.97) 60%, rgba(206, 184, 146, 0.98)),
    #d8c7a3;
  opacity: 0;
  transform: scale(0.985);
  transition: opacity 0.42s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.wp-entry-root--in { opacity: 1; transform: scale(1); }
.wp-entry-root--out { opacity: 0; transform: scale(1.01); }

.wp-entry-card {
  --wp-entry-accent: #e8b54a;
  width: min(560px, 100%);
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}

/* deckle-edged paper "stamp" header */
.wp-entry-stamp {
  width: 84px; height: 84px;
  border-radius: 22px;
  display: grid; place-items: center;
  font-size: 40px; line-height: 1;
  background: linear-gradient(180deg, #fffaf0, #f3e6cb);
  box-shadow:
    0 10px 26px rgba(40, 28, 14, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(120, 92, 48, 0.18);
}

.wp-entry-eyebrow {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: color-mix(in srgb, var(--wp-entry-accent) 64%, #6b5430);
}
.wp-entry-title {
  margin: 0;
  font-size: clamp(26px, 6vw, 34px);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.08;
}
.wp-entry-sub {
  margin: 0;
  max-width: 42ch;
  font-size: 15.5px;
  line-height: 1.5;
  color: #5a4a36;
}

/* a couple of "what's true" facts the welcome teaches gently */
.wp-entry-facts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin: 4px 0 2px;
}
.wp-entry-fact {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(120, 92, 48, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.wp-entry-fact__glyph {
  flex: 0 0 auto;
  width: 38px; height: 38px;
  border-radius: 12px;
  display: grid; place-items: center;
  font-size: 20px;
  background: color-mix(in srgb, var(--wp-entry-accent) 22%, #fff);
}
.wp-entry-fact__body { display: flex; flex-direction: column; gap: 1px; }
.wp-entry-fact__title { font-weight: 700; font-size: 14.5px; }
.wp-entry-fact__sub { font-size: 13px; color: #6a5840; line-height: 1.35; }
.wp-entry-fact__sub strong { color: #3a2c1a; font-weight: 700; }

/* primary CTA */
.wp-entry-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  min-height: 50px;
  padding: 0 26px;
  border-radius: 26px;
  font: inherit;
  font-size: 16.5px;
  font-weight: 800;
  color: #3a2a12;
  background: linear-gradient(180deg, color-mix(in srgb, var(--wp-entry-accent) 80%, #fff), var(--wp-entry-accent));
  box-shadow: 0 8px 20px rgba(140, 96, 24, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: transform 0.1s ease, filter 0.15s ease;
  margin-top: 6px;
}
.wp-entry-btn:hover { filter: brightness(1.04); }
.wp-entry-btn:active { transform: translateY(1px) scale(0.99); }

/* ───────────────────────── language chooser ───────────────────────── */

.wp-entry-langs {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 6px 0 2px;
}
.wp-entry-lang {
  appearance: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1.5px solid rgba(120, 92, 48, 0.16);
  box-shadow: 0 4px 12px rgba(40, 28, 14, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.65);
  color: #2a2018;
  transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.wp-entry-lang:hover {
  background: rgba(255, 255, 255, 0.92);
  border-color: color-mix(in srgb, var(--wp-entry-accent) 55%, rgba(120, 92, 48, 0.16));
}
.wp-entry-lang:active { transform: translateY(1px) scale(0.995); }
.wp-entry-lang__tag {
  flex: 0 0 auto;
  width: 42px; height: 42px;
  border-radius: 13px;
  display: grid; place-items: center;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #3a2a12;
  background: linear-gradient(180deg, color-mix(in srgb, var(--wp-entry-accent) 70%, #fff), color-mix(in srgb, var(--wp-entry-accent) 92%, #fff));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.wp-entry-lang__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.wp-entry-lang__native {
  font-weight: 800;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wp-entry-lang__en { font-size: 12.5px; color: #6a5840; }
.wp-entry-lang__chev { margin-left: auto; color: rgba(106, 88, 64, 0.5); font-size: 22px; }

@media (prefers-reduced-motion: reduce) {
  .wp-entry-root { transition: opacity 0.2s ease; transform: none; }
  .wp-entry-root--in, .wp-entry-root--out { transform: none; }
  .wp-entry-btn:active, .wp-entry-lang:active { transform: none; }
}
`

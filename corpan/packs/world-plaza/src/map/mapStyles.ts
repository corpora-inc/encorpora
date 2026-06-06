/**
 * mapStyles — scoped-inline CSS for the World Plaza map surfaces. Injected once
 * via `<style data-wp-map>` (mapCore.ensureMapStyles). The slice owns
 * `src/map/*` — NOT `styles.css` — so all hooks are namespaced `.wp-minimap*`
 * and `.wp-map*` to avoid colliding with the orchestrator-owned stylesheet.
 *
 * Warm-Antigua paper aesthetic, premium + understated. Every surface mounts
 * inside `.wp-overlay` (`position:absolute`), is safe-area aware, has ≥44px
 * touch targets, and honours `prefers-reduced-motion` (no pulse).
 */

export const MAP_CSS = `
/* -------------------------------------------------- corner minimap -------- */
.wp-minimap {
  position: absolute;
  right: calc(env(safe-area-inset-right, 0px) + var(--wp-fab-inset, 14px));
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--wp-fab-inset, 14px));
  /* Its OWN distinct z (was 13, colliding with the status-detail card). The size
     is ONE shared token (--wp-minimap-h, defined+responsive in styles.css) — the
     old per-module --wp-minimap-size duplicate is retired. */
  z-index: var(--wp-z-minimap, 36);
  width: var(--wp-minimap-h, 132px);
  height: var(--wp-minimap-h, 132px);
  border-radius: var(--wp-r-card, 18px);
  padding: 0;
  border: none;
  cursor: pointer;
  background: linear-gradient(180deg, #f7efe0, #ece0c6);
  /* The saturated 3px accent ring is DROPPED (FAB_POLISH §3.1): it was the only
     surface with a colored border, breaking the paper language. Now the shared
     cut-paper highlight + a hairline frame match the inventory cells; the tint
     comes from the player wedge + POIs INSIDE the canvas, not the frame. */
  box-shadow:
    var(--wp-e2, 0 4px 14px rgba(58, 47, 37, 0.2)),
    var(--wp-cut, inset 0 0 0 1px rgba(255, 255, 255, 0.5)),
    inset 0 0 0 1px var(--wp-hairline, rgba(120, 100, 70, 0.18));
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  /* Governed by chromeVisibility (role: "map") — recede WITH the rest of the
     chrome instead of staying fully lit during dialogue/challenge/menu. */
  transition: opacity 0.22s ease, transform 0.16s ease, box-shadow 0.16s ease;
}
.wp-minimap:hover { transform: translateY(-1px); }
.wp-minimap:active { transform: translateY(0); }
.wp-minimap:focus-visible {
  outline: 2px solid var(--wp-map-accent, #c46b4a);
  outline-offset: 2px;
}
/* chromeVisibility recede rules (FAB_POLISH §7.1): dim WITH the band on focused,
   hide fully on a blocking surface — the cohesive single-breath recede. */
.wp-minimap[data-wp-chrome="dim"] {
  opacity: 0.4;
  pointer-events: none;
}
.wp-minimap[data-wp-chrome="hidden"] {
  opacity: 0;
  pointer-events: none;
}
.wp-minimap-canvas { display: block; width: 100%; height: 100%; }
.wp-minimap-expand {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 18px;
  height: 18px;
  opacity: 0.66;
  pointer-events: none;
  color: var(--wp-map-accent, #c46b4a);
}

/* -------------------------------------------------- full-screen map ------- */
.wp-map {
  position: absolute;
  inset: 0;
  z-index: var(--wp-z-map, 72);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.wp-map.wp-map--open { opacity: 1; }
.wp-map-scrim {
  position: absolute;
  inset: 0;
  background: rgba(28, 20, 8, 0.46);
  backdrop-filter: blur(2px);
}
.wp-map-panel {
  position: relative;
  /* Phone-default: nearly full bleed. Tablet/desktop GROW it (see @media below)
     so the map is big + roomy — the owner's "should grow on bigger screens". */
  width: min(94vw, 560px);
  height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f7efe0, #efe3cd);
  border-radius: 18px;
  box-shadow:
    0 18px 48px rgba(40, 28, 12, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  padding: 16px 16px 14px;
  transform: scale(0.97);
  transition: transform 0.2s ease;
  overflow: hidden;
}
/* Tablet — roomy. */
@media (min-width: 700px) {
  .wp-map-panel {
    width: min(90vw, 980px);
    height: min(90vh, 920px);
    padding: 20px 20px 16px;
  }
}
/* Desktop — big + generous, scaling up with the viewport. */
@media (min-width: 1100px) {
  .wp-map-panel {
    width: min(86vw, 1320px);
    height: min(88vh, 1000px);
    padding: 24px 24px 18px;
  }
}
.wp-map.wp-map--open .wp-map-panel { transform: scale(1); }
.wp-map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 2px 10px;
}
.wp-map-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #3a2f25;
}
@media (min-width: 700px) {
  .wp-map-title { font-size: 20px; }
  .wp-map-head { margin-bottom: 14px; }
}
.wp-map-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: rgba(90, 74, 50, 0.08);
  color: #6a5a45;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.wp-map-close:hover { background: rgba(90, 74, 50, 0.16); }
.wp-map-close:focus-visible { outline: 2px solid var(--wp-map-accent, #c46b4a); outline-offset: 2px; }

.wp-map-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: #efe1c2;
  box-shadow: inset 0 0 0 1px rgba(120, 96, 60, 0.25);
}
.wp-map-canvas { display: block; width: 100%; height: 100%; }

/* a labelled tag floated over a marker (full map only). Curated — only named
   specials, key POIs, the objective, and YOU get a tag (declutter). */
.wp-map-tag {
  position: absolute;
  transform: translate(-50%, -135%);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  color: #3a2f25;
  background: rgba(249, 243, 230, 0.94);
  box-shadow: 0 1px 5px rgba(40, 28, 12, 0.22);
  pointer-events: none;
  max-width: 11em;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (min-width: 700px) {
  .wp-map-tag { font-size: 12.5px; padding: 3px 9px; max-width: 14em; }
}
.wp-map-tag--objective {
  color: #6a3c0a;
  font-weight: 700;
  background: rgba(255, 233, 196, 0.97);
  box-shadow: 0 1px 6px rgba(180, 110, 10, 0.32);
}
.wp-map-tag--player {
  color: #fff7f0;
  background: var(--wp-map-accent, #c64a2e);
}
.wp-map-tag--hint {
  color: #1d6b32;
  background: rgba(214, 245, 222, 0.95);
}

.wp-map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 16px;
  margin: 12px 2px 2px;
  padding-top: 10px;
  border-top: 1px solid rgba(120, 96, 60, 0.18);
}
@media (min-width: 700px) {
  .wp-map-legend { gap: 9px 22px; margin-top: 14px; }
}
.wp-map-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #5a4a35;
}
@media (min-width: 700px) {
  .wp-map-legend-item { font-size: 13px; }
}
/* the swatch is a tiny canvas the legend builder paints with the EXACT marker
   shape+colour, so the key can never drift from the dots (one source of truth). */
.wp-map-swatch {
  width: 15px;
  height: 15px;
  flex: none;
  display: block;
}

.wp-map-note {
  margin: 8px 4px 0;
  font-size: 12px;
  color: #8a785c;
  text-align: center;
}

/* ===================== MAPS-APP CHROME (PHONE_DESIGN §6) ===================== */
/* Search bar + category filter chips above the stage; a route strip below it. */
.wp-map-tools {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.wp-map-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 250, 240, 0.92);
  border: 1px solid rgba(120, 96, 60, 0.25);
  color: #8a785c;
}
.wp-map-search svg { width: 17px; height: 17px; flex: 0 0 auto; display: block; }
.wp-map-search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  background: transparent;
  font: 600 14px/1 ui-sans-serif, system-ui, sans-serif;
  color: #4a3b27;
  outline: none;
}
.wp-map-search-input::placeholder { color: #a8967a; font-weight: 500; }
/* horizontal scrollable chip row (RTL-safe via logical scroll) */
.wp-map-chips {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 1px;
}
.wp-map-chips::-webkit-scrollbar { display: none; }
.wp-map-chip {
  flex: 0 0 auto;
  border: 1px solid rgba(120, 96, 60, 0.28);
  border-radius: 999px;
  padding: 6px 13px;
  background: rgba(255, 250, 240, 0.7);
  color: #5a4a32;
  font: 700 12.5px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.wp-map-chip:hover { background: rgba(255, 250, 240, 0.95); }
.wp-map-chip[aria-current="true"] {
  background: var(--wp-map-accent, #c46b4a);
  border-color: var(--wp-map-accent, #c46b4a);
  color: #fff7f0;
}

/* Route strip — "Route to {place} · ~{dist}" + a Go button. */
.wp-map-route {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px 10px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 250, 240, 0.95), rgba(245, 232, 211, 0.85));
  border: 1px solid rgba(120, 96, 60, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.wp-map-route[hidden] { display: none; }
.wp-map-route-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}
.wp-map-route-to {
  font: 700 13.5px/1.2 ui-sans-serif, system-ui, sans-serif;
  color: #4a3b27;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wp-map-route-dist {
  font: 600 11.5px/1 ui-sans-serif, system-ui, sans-serif;
  color: #8a785c;
}
.wp-map-route-go {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 8px 18px;
  background: var(--wp-map-accent, #c46b4a);
  color: #fff7f0;
  font: 800 13px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 3px 10px rgba(196, 107, 74, 0.32);
}
.wp-map-route-go:active { transform: scale(0.96); }

/* the gentle objective pulse — opt out under reduced motion */
@keyframes wp-map-pulse {
  0% { transform: scale(1); opacity: 0.55; }
  70% { transform: scale(2.6); opacity: 0; }
  100% { transform: scale(2.6); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .wp-minimap, .wp-map, .wp-map-panel { transition: none; }
}

@media (max-width: 540px) {
  .wp-map-panel { width: 96vw; max-height: 94vh; border-radius: 14px; }
}
`

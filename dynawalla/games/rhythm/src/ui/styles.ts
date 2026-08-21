/**
 * SPLITBEAT's stylesheet, in a module of its own.
 *
 * **Why it is not in `index.ts` any more.** `packs/sdk/src/safearea.test.ts`
 * evaluates every pack's shipped CSS: it parses it, runs the cascade at ten
 * real viewports and resolves each edge offset to a number, because a substring
 * search on a stylesheet was true on the day SIEGE shipped its currency under
 * an Android clock. To do that it has to IMPORT the module holding the CSS, so
 * that `${GEAR_TOP}px` is a length rather than a template hole — and
 * `index.ts` cannot be imported in node at all: it declares a TypeScript
 * parameter property, which `--experimental-strip-types` refuses outright. The
 * stylesheet was therefore the one part of this pack no test could see, which
 * is exactly the part four packs shipped a HUD under the notch in.
 *
 * **`SAFE_VARS` rather than `env()`.** Every edge offset below used to read
 * `env(safe-area-inset-*)` directly. Inside a pack frame that is the number
 * ZERO — the frame is sandboxed `allow-scripts` with no `allow-same-origin`
 * and `env()` belongs to the top-level browsing context — so the settings gear
 * sat 8px from the top of the glass under an Android status bar, the panel
 * measured its own maximum height against an inset of nothing, and the
 * performance readout sat 6px inside a three-button navigation bar. The four
 * numbers now arrive as `--dw-safe-*`, published by `installSafeArea` in
 * `index.ts`.
 */

import { SAFE_VARS } from "../../../../packs/shared/game-chrome/index.ts";
import { GEAR_EDGE, GEAR_SIZE, GEAR_TOP, PANEL_TOP } from "../render/layout.ts";

export const CSS = `
.sb-root{position:absolute;inset:0;overflow:hidden;background:#05060f;
  font-family:"Inter","SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif;
  color:#eaf2ff;-webkit-user-select:none;user-select:none;touch-action:none}
.sb-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:2.2vh;text-align:center;overflow:auto;
  padding:max(4vmin,${SAFE_VARS.top}) max(4vmin,${SAFE_VARS.right})
          max(4vmin,${SAFE_VARS.bottom}) max(4vmin,${SAFE_VARS.left});
  background:radial-gradient(120% 90% at 50% 40%,rgba(10,16,48,.72),rgba(3,4,12,.94));
  backdrop-filter:blur(3px)}
.sb-title{font-size:clamp(38px,11vmin,120px);font-weight:900;letter-spacing:-.03em;margin:0;
  background:linear-gradient(96deg,#7ee8ff 0%,#ff6fae 55%,#ffb45c 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;line-height:.95}
.sb-sub{font-size:clamp(12px,2.5vmin,19px);font-weight:600;letter-spacing:.16em;
  color:rgba(190,215,255,.72);margin:0;text-transform:uppercase}
.sb-btn{appearance:none;border:2px solid rgba(150,220,255,.85);background:rgba(10,18,44,.9);
  color:#fff;font:800 clamp(15px,3.4vmin,24px)/1 inherit;letter-spacing:.14em;
  padding:1.05em 2.4em;border-radius:999px;cursor:pointer;transition:transform .12s,box-shadow .12s;
  box-shadow:0 0 0 0 rgba(120,220,255,.5)}
.sb-btn:hover,.sb-btn:focus-visible{transform:translateY(-2px);box-shadow:0 0 34px 2px rgba(120,220,255,.4);outline:none}
.sb-btn:active{transform:translateY(1px)}
.sb-legend{display:flex;gap:1.4vmin;flex-wrap:wrap;justify-content:center;margin-top:1vh}
.sb-chip{display:flex;align-items:center;gap:.6em;font-size:clamp(10px,1.9vmin,14px);font-weight:700;
  letter-spacing:.1em;padding:.55em 1em;border-radius:10px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1)}
.sb-dot{width:1.05em;height:1.05em;flex:none}
.sb-gear{position:absolute;
  top:calc(max(${GEAR_EDGE}px,${SAFE_VARS.top}) + ${GEAR_TOP}px);
  right:max(${GEAR_EDGE}px,${SAFE_VARS.right});
  width:${GEAR_SIZE}px;height:${GEAR_SIZE}px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
  background:rgba(6,10,26,.72);color:#cfe4ff;font:800 17px/1 inherit;cursor:pointer;z-index:6}
.sb-panel{position:absolute;
  top:calc(max(${GEAR_EDGE}px,${SAFE_VARS.top}) + ${PANEL_TOP}px);
  right:max(${GEAR_EDGE}px,${SAFE_VARS.right});width:min(290px,86vw);
  max-height:calc(100% - max(${GEAR_EDGE}px,${SAFE_VARS.top}) - ${PANEL_TOP}px
    - max(${GEAR_EDGE}px,${SAFE_VARS.bottom}));overflow-y:auto;overscroll-behavior:contain;
  background:rgba(6,10,26,.96);border:1px solid rgba(255,255,255,.14);border-radius:16px;
  padding:16px;display:grid;gap:14px;z-index:6;box-shadow:0 18px 60px rgba(0,0,0,.6)}
.sb-row{display:grid;gap:7px}
.sb-lab{font-size:11px;font-weight:800;letter-spacing:.14em;color:rgba(180,205,240,.72);text-transform:uppercase}
.sb-seg{display:flex;gap:6px}
.sb-seg button{flex:1;appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);
  color:#dceaff;font:700 12px/1 inherit;padding:9px 0;border-radius:9px;cursor:pointer;letter-spacing:.06em}
.sb-seg button[aria-pressed=true]{background:rgba(120,220,255,.22);border-color:rgba(120,220,255,.75);color:#fff}
.sb-panel input[type=range]{width:100%;accent-color:#7ee8ff}
.sb-val{font:700 12px/1 inherit;color:rgba(190,215,255,.8)}
.sb-perf{position:absolute;left:max(6px,${SAFE_VARS.left});bottom:max(6px,${SAFE_VARS.bottom});font:700 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  color:rgba(150,200,255,.75);z-index:5;pointer-events:none;white-space:pre}
.sb-hide{display:none!important}
@media (prefers-reduced-motion:reduce){.sb-btn{transition:none}}
`;

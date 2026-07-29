/**
 * Splitbeat — mount point.
 *
 * Input timing is the subtle part. A pointer or key event carries a timestamp in
 * the `performance.now()` epoch, but every note lives in the `AudioContext`
 * epoch, and the two are unrelated. Each frame records both clocks; an event is
 * converted with `audio = audioAtFrame + (event.timeStamp - perfAtFrame)/1000`.
 * Judging against `performance.now()` directly would add a whole frame of
 * jitter — 16ms, which is a third of the Perfect window.
 */

import { createInstructions, onInsetsChange } from "../../../packs/shared/game-chrome/index.ts";
import type { Host, Mount } from "./contract.ts";
import { Game, type Lane } from "./game/core.ts";
import { GEAR_EDGE, GEAR_SIZE, GEAR_TOP, PANEL_TOP } from "./render/layout.ts";
import { Renderer } from "./render/renderer.ts";
import { autoTier, type Tier } from "./theme.ts";

const CSS = `
.sb-root{position:absolute;inset:0;overflow:hidden;background:#05060f;
  font-family:"Inter","SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif;
  color:#eaf2ff;-webkit-user-select:none;user-select:none;touch-action:none}
.sb-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:2.2vh;text-align:center;overflow:auto;
  padding:max(4vmin,env(safe-area-inset-top)) max(4vmin,env(safe-area-inset-right))
          max(4vmin,env(safe-area-inset-bottom)) max(4vmin,env(safe-area-inset-left));
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
  top:calc(max(${GEAR_EDGE}px,env(safe-area-inset-top)) + ${GEAR_TOP}px);
  right:max(${GEAR_EDGE}px,env(safe-area-inset-right));
  width:${GEAR_SIZE}px;height:${GEAR_SIZE}px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
  background:rgba(6,10,26,.72);color:#cfe4ff;font:800 17px/1 inherit;cursor:pointer;z-index:6}
.sb-panel{position:absolute;
  top:calc(max(${GEAR_EDGE}px,env(safe-area-inset-top)) + ${PANEL_TOP}px);
  right:max(${GEAR_EDGE}px,env(safe-area-inset-right));width:min(290px,86vw);
  max-height:calc(100% - max(${GEAR_EDGE}px,env(safe-area-inset-top)) - ${PANEL_TOP}px
    - max(${GEAR_EDGE}px,env(safe-area-inset-bottom)));overflow-y:auto;overscroll-behavior:contain;
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
.sb-perf{position:absolute;left:max(6px,env(safe-area-inset-left));bottom:max(6px,env(safe-area-inset-bottom));font:700 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  color:rgba(150,200,255,.75);z-index:5;pointer-events:none;white-space:pre}
.sb-hide{display:none!important}
@media (prefers-reduced-motion:reduce){.sb-btn{transition:none}}
`;

export const mount: Mount = (el: HTMLElement, host: Host) => {
  const root = document.createElement("div");
  root.className = "sb-root";
  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  const canvas = document.createElement("canvas");
  canvas.className = "sb-canvas";
  root.appendChild(canvas);
  el.appendChild(root);

  let game: Game;
  try {
    game = new Game(host);
  } catch (err) {
    console.error("[splitbeat] could not create the audio engine", err);
    const msg = document.createElement("div");
    msg.className = "sb-overlay";
    msg.innerHTML = `<p class="sb-sub">Audio is unavailable on this device.</p>`;
    root.appendChild(msg);
    return { unmount: () => el.removeChild(root) };
  }

  let tier: Tier = autoTier();
  const renderer = new Renderer(canvas, game, tier);

  /* ---------------- start screen ---------------- */
  const overlay = document.createElement("div");
  overlay.className = "sb-overlay";
  const laneChips = [
    ["LOW", "#ff9c38", "A / J / ↓"],
    ["MID", "#ff4d8d", "S / K / →"],
    ["HIGH", "#4ee2ff", "D / L / ↑"],
  ]
    .map(
      ([n, c, k]) =>
        `<span class="sb-chip"><svg class="sb-dot" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4.4" fill="${c}"/></svg>${n}<span style="opacity:.5">${k}</span></span>`,
    )
    .join("");
  overlay.innerHTML =
    `<h1 class="sb-title">SPLITBEAT</h1>` +
    `<p class="sb-sub">Play the bar. Split the beat.</p>` +
    `<button class="sb-btn" type="button">PLAY</button>` +
    `<p class="sb-sub" style="letter-spacing:.1em;opacity:.62">Tap the lane on the beat</p>` +
    `<div class="sb-legend">${laneChips}</div>`;
  root.appendChild(overlay);
  const playBtn = overlay.querySelector("button")!;

  /* ---------------- settings ---------------- */
  const gear = document.createElement("button");
  gear.className = "sb-gear";
  gear.type = "button";
  gear.setAttribute("aria-label", "Settings");
  gear.textContent = "⚙";
  root.appendChild(gear);

  const panel = document.createElement("div");
  panel.className = "sb-panel sb-hide";
  panel.innerHTML = `
    <div class="sb-row"><span class="sb-lab">Sound</span>
      <div class="sb-seg" data-k="sound">
        <button type="button" data-v="on" aria-pressed="true">ON</button>
        <button type="button" data-v="off" aria-pressed="false">OFF</button>
      </div></div>
    <div class="sb-row"><span class="sb-lab">Quality</span>
      <div class="sb-seg" data-k="tier">
        <button type="button" data-v="low" aria-pressed="false">LOW</button>
        <button type="button" data-v="mid" aria-pressed="false">MID</button>
        <button type="button" data-v="ultra" aria-pressed="false">ULTRA</button>
      </div></div>
    <div class="sb-row"><span class="sb-lab">Motion</span>
      <div class="sb-seg" data-k="motion">
        <button type="button" data-v="full" aria-pressed="true">FULL</button>
        <button type="button" data-v="reduced" aria-pressed="false">REDUCED</button>
      </div></div>
    <div class="sb-row"><span class="sb-lab">Timing offset <span class="sb-val" data-cal>0 ms</span></span>
      <input type="range" min="-150" max="150" step="5" value="0" aria-label="Timing offset in milliseconds" />
    </div>`;
  root.appendChild(panel);

  const perfBox = document.createElement("div");
  perfBox.className = "sb-perf sb-hide";
  root.appendChild(perfBox);

  /* ---------------- how to play ---------------- */
  // Splitbeat shipped with a legend of three coloured chips and the line "Tap
  // the lane on the beat", which says which key is which lane and nothing about
  // WHEN. In a timing game that is the whole rule: a child who does not know
  // there is a window either taps early forever or decides the game is broken.
  const guide = createInstructions(root, {
    title: "SPLITBEAT",
    summary: [
      "Notes fly toward the bright line. Tap the lane when a note reaches it.",
      "There are three lanes. Tap the one the note is in.",
    ],
    sections: [
      {
        heading: "Tapping",
        lines: [
          "Touch the top, middle or bottom of the screen. The part you touch is the lane you play.",
          "Tap when the note is sitting on the bright line, not before it gets there.",
          "A little early or a little late still counts. Right on the line gives you PERFECT.",
          "If nothing happens when you tap, the note was still too far away. Wait for it to reach the line.",
          "On a keyboard: A, S and D, or J, K and L, or the arrow keys.",
        ],
      },
      {
        heading: "Splitting the beat",
        lines: [
          "The music is counted in bars. One bar is one whole.",
          "The notes cut the bar into equal pieces: two halves, then four quarters, then eight eighths.",
          "You feel the piece in your hands first. Then you see it written down.",
        ],
      },
      {
        heading: "Questions",
        lines: [
          "Now and then a question appears at the top of the screen.",
          "Three notes come at you, one in each lane, and each one has an answer on it.",
          "Tap the lane with the right answer when it reaches the line.",
          "A right answer adds one block of charge. A wrong one takes two away.",
        ],
      },
      {
        heading: "Charge",
        lines: [
          "The five blocks near the top are your charge.",
          "If they all run out the music breaks down. Answer one more question right and it starts again.",
          "The run never ends. You always get another go.",
        ],
      },
    ],
    reducedMotion: host.prefersReducedMotion(),
    onClose: () => game.resumeFromPause(),
  });
  const showPerf = new URLSearchParams(location.search).has("perf");
  if (showPerf) perfBox.classList.remove("sb-hide");

  const syncSeg = (k: string, v: string) => {
    panel.querySelectorAll<HTMLButtonElement>(`[data-k="${k}"] button`).forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.v === v));
    });
  };
  syncSeg("tier", tier);
  syncSeg("motion", game.reduced ? "reduced" : "full");

  panel.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const k = b.parentElement?.getAttribute("data-k");
    const v = b.dataset.v!;
    if (k === "sound") {
      game.soundOn = v === "on";
      game.eng.setMuted(v !== "on");
    } else if (k === "tier") {
      tier = v as Tier;
      renderer.setTier(tier);
    } else if (k === "motion") {
      game.reduced = v === "reduced";
    }
    if (k) syncSeg(k, v);
  });

  const cal = panel.querySelector<HTMLInputElement>("input[type=range]")!;
  const calOut = panel.querySelector<HTMLElement>("[data-cal]")!;
  cal.addEventListener("input", () => {
    const ms = Number(cal.value);
    game.calibration = ms / 1000;
    calOut.textContent = `${ms > 0 ? "+" : ""}${ms} ms`;
  });

  gear.addEventListener("click", () => {
    const open = panel.classList.toggle("sb-hide");
    if (!open) game.pause();
    else game.resumeFromPause();
  });

  /* ---------------- input ---------------- */
  let perfAtFrame = performance.now();
  let audioAtFrame = 0;

  const toAudioTime = (stamp: number): number => {
    // Some engines hand out timestamps in a different epoch; fall back rather
    // than judge against nonsense.
    const d = stamp - perfAtFrame;
    if (!isFinite(d) || Math.abs(d) > 5000) return game.audioNow;
    return audioAtFrame + d / 1000;
  };

  const onPointer = (e: PointerEvent) => {
    if (panel.contains(e.target as Node) || gear.contains(e.target as Node)) return;
    // The shared how-to-play surface floats over the whole field. A tap on it is
    // a tap on it, never a note in the lane that happens to be underneath.
    const inGuide = (e.target as HTMLElement | null)?.closest?.(".dwc-help, .dwc-scrim");
    if (inGuide) {
      if (inGuide.classList.contains("dwc-help")) game.pause();
      return;
    }
    e.preventDefault();
    if (game.phase === "title") {
      void begin();
      return;
    }
    if (!panel.classList.contains("sb-hide")) return;
    const rect = canvas.getBoundingClientRect();
    const lane = renderer.laneFromY(e.clientY - rect.top);
    game.hit(lane, toAudioTime(e.timeStamp));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (guide.isOpen) return;
    if (e.key === "Escape") {
      panel.classList.toggle("sb-hide");
      if (panel.classList.contains("sb-hide")) game.resumeFromPause();
      else game.pause();
      return;
    }
    const lane = game.laneFromKey(e.key);
    if (lane === undefined) return;
    e.preventDefault();
    if (game.phase === "title") {
      void begin();
      return;
    }
    game.hit(lane as Lane, toAudioTime(e.timeStamp));
  };

  root.addEventListener("pointerdown", onPointer, { passive: false });
  window.addEventListener("keydown", onKey, { passive: false });

  const onVisibility = () => {
    if (document.hidden) game.pause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(root);
  window.addEventListener("orientationchange", () => renderer.resize());
  // Insets are not fixed: rotation swaps top/bottom with left/right, and iPadOS
  // changes them when the pack is resized in Split View. A layout read once at
  // mount is right until the first rotation and wrong after it.
  const stopInsets = onInsetsChange(() => renderer.resize());

  /* ---------------- loop ---------------- */
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let acc = 0;
  let fps = 60;
  let worst = 0;
  let slowWindows = 0;
  let alive = true;

  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const t = performance.now();
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.1) dt = 0.1; // a tab that was backgrounded must not teleport
    perfAtFrame = t;
    audioAtFrame = game.audioNow;

    game.eng.pollSpectrum();
    game.update(dt);
    renderer.frame(dt, audioAtFrame);

    frames++;
    acc += dt;
    if (dt > worst) worst = dt;
    if (acc >= 1) {
      fps = frames / acc;
      if (showPerf) {
        perfBox.textContent =
          `${fps.toFixed(1)} fps  worst ${(worst * 1000).toFixed(1)}ms\n` +
          `tier ${tier}  dpr ${(window.devicePixelRatio || 1).toFixed(1)}  ${renderer.W}x${renderer.H}\n` +
          `sparks ${renderer.particles.liveSparks}  notes ${game.notes.filter((n) => n.active).length}\n` +
          `lv ${game.difficulty.toFixed(2)}  bpm ${game.bpm.toFixed(0)}  cells ${game.cells}  combo ${game.combo}`;
      }
      // Automatic, one-way relief valve: never upgrade behind the player's back.
      if (fps < 50 && tier !== "low") {
        slowWindows++;
        if (slowWindows >= 2) {
          tier = tier === "ultra" ? "mid" : "low";
          renderer.setTier(tier);
          syncSeg("tier", tier);
          slowWindows = 0;
          console.warn(`[splitbeat] sustained ${fps.toFixed(1)}fps — dropping to ${tier}`);
        }
      } else {
        slowWindows = 0;
      }
      frames = 0;
      acc = 0;
      worst = 0;
    }
  };

  async function begin(): Promise<void> {
    overlay.classList.add("sb-hide");
    try {
      await game.start();
    } catch (err) {
      console.error("[splitbeat] failed to start", err);
    }
  }
  playBtn.addEventListener("click", () => void begin());

  renderer.resize();
  raf = requestAnimationFrame(loop);

  // A small debug handle: measuring fps from the outside is otherwise guesswork.
  (window as unknown as Record<string, unknown>).__splitbeat = {
    get fps() { return fps; },
    get tier() { return tier; },
    get state() {
      return {
        phase: game.phase, score: game.score, combo: game.combo, charge: game.charge,
        difficulty: game.difficulty, bpm: game.bpm, cells: game.cells,
        gates: game.gatesTotal, correct: game.gatesCorrect, expired: game.gatesExpired,
        accuracy: game.accuracy, notesHit: game.notesHit, notesMissed: game.notesMissed,
      };
    },
    setTier: (t: Tier) => { tier = t; renderer.setTier(t); syncSeg("tier", t); },
    game, renderer,
  };

  return {
    unmount() {
      alive = false;
      cancelAnimationFrame(raf);
      guide.destroy();
      stopInsets();
      ro.disconnect();
      root.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      game.destroy();
      delete (window as unknown as Record<string, unknown>).__splitbeat;
      if (root.parentNode === el) el.removeChild(root);
    },
  };
};

export type { Host, Question, Mount } from "./contract.ts";

/**
 * The one overlay every Colorful moment plays in: a fixed layer over the
 * page with `pointer-events: none`, built once and kept for the page's life,
 * so a moment's tail plays on over the next problem (practice remounts its
 * workspace for each one) and nothing is created while a child answers.
 * Every piece is drawn ahead and moved only by CSS keyframes on transform
 * and opacity (Celebration.module.css): nothing here can shift the layout,
 * take a tap, or delay the next problem. A moment already running is not
 * started again over itself; slow machines get half the pieces.
 */
import styles from "./Celebration.module.css";
import type { ChipMoment, Moment } from "./tier";

const CHIP_WIDTH = 104;
const CHIP_HEIGHT = 36;
/** How long each moment runs, in ms (the CSS durations, plus any delay). */
export const DURATION = {
  burst: 900,
  flight: 560,
  confetti: 2900,
  stamp: 1500,
  sweep: 520,
  chip: 900,
} as const;

/** Half the pieces where the machine has two cores or fewer (a school
 * Chromebook, an old laptop). */
export const pieceCount = (full: number, cores?: number) =>
  (cores ?? 8) <= 2 ? Math.ceil(full / 2) : full;

/** Seeded, so every page draws the same confetti: no randomness per frame. */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HUES = 6;
const STAR =
  "M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z";

type Group =
  "burst" | "flyer" | "confetti" | "stamp" | "sweep" | "chip" | "chipSparks";

export type Stage = ReturnType<typeof createStage>;
type Play = {
  moments: readonly Moment[];
  /** The total before and after the answer; null: unknown (no "+1"). */
  from: number | null;
  to: number | null;
  /** No motion: each moment is a plain change of state. */
  reduced: boolean;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: Element,
) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.append(node);
  return node;
}
function svgStar(className: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", STAR);
  svg.append(path);
  return svg;
}
const format = (value: number) => value.toLocaleString("en-US");

export function createStage(host: HTMLElement = document.body) {
  const cores =
    typeof navigator === "undefined"
      ? undefined
      : navigator.hardwareConcurrency;
  const rand = random(20261120);
  const root = element("div", styles.stage!, host);
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-celebration", "");

  // The sweep: a glint along the bar's foot as a new problem arrives.
  const sweep = element("div", styles.sweep!, root);

  // The burst: rays from the result mark.
  const burst = element("div", styles.burst!, root);
  const sparks = pieceCount(18, cores);
  for (let i = 0; i < sparks; i++) {
    const spark = element("i", styles.spark!, burst);
    const angle = (360 / sparks) * i + (rand() * 14 - 7);
    spark.style.setProperty("--angle", `${angle.toFixed(1)}deg`);
    spark.style.setProperty("--reach", `${Math.round(80 + rand() * 75)}px`);
    spark.style.setProperty(
      "--hue",
      `var(--color-celebrate-${(i % HUES) + 1})`,
    );
    spark.style.setProperty("--delay", `${Math.round(rand() * 60)}ms`);
    if (i % 3 === 0) spark.dataset.shape = "dot";
  }
  const halo = element("i", styles.halo!, burst);
  halo.dataset.halo = "";

  // "+1", flying from the mark to the chip.
  const flyer = element("div", styles.flyer!, root);
  const flyerY = element("div", styles.flyerY!, flyer);
  element("span", styles.flyerPill!, flyerY).textContent = "+1";

  // Confetti: the Strong moment, across the whole screen.
  const confetti = element("div", styles.confetti!, root);
  const pieces = pieceCount(44, cores);
  for (let i = 0; i < pieces; i++) {
    const piece = element("i", styles.piece!, confetti);
    piece.style.setProperty("--x", `${(rand() * 100).toFixed(1)}vw`);
    piece.style.setProperty("--drift", `${Math.round(rand() * 160 - 80)}px`);
    piece.style.setProperty("--spin", `${Math.round(rand() * 900 - 450)}deg`);
    piece.style.setProperty("--delay", `${Math.round(rand() * 420)}ms`);
    piece.style.setProperty("--fall", `${Math.round(1700 + rand() * 800)}ms`);
    piece.style.setProperty(
      "--hue",
      `var(--color-celebrate-${(i % HUES) + 1})`,
    );
    piece.dataset.shape = ["ribbon", "dot", "square"][i % 3]!;
  }

  // The stamp: a skill earned (or, without motion, Strong).
  const stamp = element("div", styles.stamp!, root);
  stamp.append(svgStar(styles.stampStar!));
  const stampWord = element("span", styles.stampWord!, stamp);

  // The chip: the learner's points, pinned in the bar.
  const chip = element("div", styles.chip!, root);
  chip.append(svgStar(styles.chipStar!));
  const count = element("span", styles.count!, chip);
  const from = element("span", styles.from!, count);
  const to = element("span", styles.to!, count);
  const chipSparks = element("div", styles.chipSparks!, chip);
  element("i", styles.ring!, chipSparks);
  const around = pieceCount(10, cores);
  for (let i = 0; i < around; i++) {
    const spark = element("i", styles.chipSpark!, chipSparks);
    spark.style.setProperty("--angle", `${(360 / around) * i}deg`);
    spark.style.setProperty(
      "--hue",
      `var(--color-celebrate-${(i % HUES) + 1})`,
    );
  }

  const groups: Record<Group, HTMLElement> = {
    burst,
    flyer,
    confetti,
    stamp,
    sweep,
    chip,
    chipSparks,
  };
  // Named for tests and checks (scripts/verify-celebration-ui.ts).
  for (const [part, node] of Object.entries(groups)) node.dataset.part = part;
  to.dataset.part = "total";
  const timers = new Map<Group, number>();
  const running = (group: Group) => timers.has(group);
  /** Starts a group's keyframes (or restarts them, alternating names), and
   * puts it back to rest when they end. */
  function run(group: Group, kind: string, ms: number, restart = false) {
    const node = groups[group];
    const previous = node.dataset.run;
    if (previous && !restart) return false;
    window.clearTimeout(timers.get(group));
    node.dataset.run = previous === "a" ? "b" : "a";
    node.dataset.kind = kind;
    timers.set(
      group,
      window.setTimeout(() => {
        timers.delete(group);
        delete node.dataset.run;
        delete node.dataset.kind;
        // At rest the chip shows the total as it stands now.
        if (group === "chip") {
          from.textContent = "";
          to.textContent = points == null ? "" : format(points);
        }
      }, ms),
    );
    return true;
  }

  let holders = 0;
  let points: number | null = null;
  let placed = false;
  const show = () => {
    if (holders > 0 && points != null) chip.dataset.shown = "";
    else delete chip.dataset.shown;
  };

  /** Where the chip sits: in the app bar's top row, at the right end of the
   * widest free stretch nearest the right (after the topic, before the bar's
   * own actions and tools, whatever they are), else just under the bar. */
  function place() {
    placed = true;
    const bar = document.querySelector("[data-app-bar]");
    const width = window.innerWidth;
    let left = width - CHIP_WIDTH - 16;
    let top = 10;
    let foot = 56;
    if (bar) {
      const box = bar.getBoundingClientRect();
      const logo = bar.firstElementChild?.getBoundingClientRect();
      const rowTop = box.top;
      const rowBottom = logo ? logo.bottom + 6 : box.top + 56;
      foot = box.bottom;
      const taken: [number, number][] = [];
      for (const node of bar.querySelectorAll<HTMLElement | SVGElement>("*")) {
        const leaf =
          node instanceof SVGSVGElement ||
          /^(BUTTON|A|IMG|INPUT|SELECT)$/.test(node.tagName) ||
          [...node.childNodes].some(
            (child) =>
              child.nodeType === Node.TEXT_NODE && !!child.textContent?.trim(),
          );
        if (!leaf) continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (rect.bottom <= rowTop || rect.top >= rowBottom) continue;
        taken.push([rect.left, rect.right]);
      }
      taken.sort((a, b) => a[0] - b[0]);
      const inset = width >= 768 ? 24 : 12;
      const gap = 12;
      // Free stretches between what the row holds, right to left.
      const edges: [number, number][] = [];
      let cursor = box.left + inset;
      for (const [start, end] of taken) {
        if (start > cursor) edges.push([cursor, start]);
        cursor = Math.max(cursor, end);
      }
      edges.push([cursor, box.right - inset]);
      const fits = edges
        .reverse()
        .find(([start, end]) => end - start >= CHIP_WIDTH + gap * 2);
      if (fits) {
        left = fits[1] - gap - CHIP_WIDTH;
        top = rowTop + (rowBottom - 6 - rowTop - CHIP_HEIGHT) / 2 + 3;
      } else {
        left = box.right - inset - CHIP_WIDTH;
        top = box.bottom + 8;
      }
    }
    root.style.setProperty("--chip-left", `${Math.round(left)}px`);
    root.style.setProperty("--chip-top", `${Math.round(top)}px`);
    root.style.setProperty("--bar-foot", `${Math.round(foot)}px`);
  }
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (holders > 0) place();
    });
  };
  let watching: MutationObserver | null = null;
  function watch() {
    if (watching || typeof MutationObserver === "undefined") return;
    window.addEventListener("resize", schedule);
    watching = new MutationObserver(schedule);
    const bar = document.querySelector("[data-app-bar]");
    if (bar)
      watching.observe(bar, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  }
  function unwatch() {
    window.removeEventListener("resize", schedule);
    watching?.disconnect();
    watching = null;
  }

  /** The total, without motion (a moment already rolling it keeps its
   * numbers). */
  function setPoints(total: number | null) {
    points = total;
    if (!chip.dataset.run) {
      from.textContent = "";
      to.textContent = total == null ? "" : format(total);
    }
    show();
  }
  const center = (rect: DOMRect | undefined) =>
    rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
  /** The result mark where it comes to rest: the sheet rises into place
   * as it appears, so its entrance offset is taken off. */
  const mark = () => {
    const found = document.querySelector(".feedback.correct .result-mark");
    if (!found) return undefined;
    const rect = found.getBoundingClientRect();
    const sheet = found.closest(".feedback");
    const moving = sheet ? getComputedStyle(sheet).transform : "none";
    const offset =
      moving && moving !== "none" && typeof DOMMatrixReadOnly !== "undefined"
        ? new DOMMatrixReadOnly(moving).m42
        : 0;
    return new DOMRect(rect.left, rect.top - offset, rect.width, rect.height);
  };

  return {
    root,
    /** A practice screen in Colorful is showing: the chip may show. */
    retain() {
      holders++;
      if (holders === 1) {
        watch();
        // Measured with the next frame's own layout, never in a commit.
        schedule();
      }
      show();
    },
    /** That screen left; the chip goes when no screen holds it a moment
     * later (a new problem's workspace takes it over in the same commit). */
    release() {
      holders = Math.max(0, holders - 1);
      queueMicrotask(() => {
        if (holders > 0) return;
        unwatch();
        show();
      });
    },
    setPoints,
    /**
     * Plays what an answer earned. `from`/`to`: the total before and after
     * it (null when unknown: no "+1" flies). `reduced`: no motion; each
     * moment is a plain change of state instead (the number changes, the
     * chip lights, the stamp shows and goes).
     */
    play(input: Play) {
      // On the next frame: the verdict paints first, and the positions read
      // here come from that frame's own layout, done once.
      requestAnimationFrame(() => {
        void document.documentElement.offsetHeight;
        const start = performance.now();
        playNow(input);
        try {
          performance.measure("amp-celebration", { start });
        } catch (error) {
          console.warn("Celebration timing not recorded", error);
        }
      });
    },
    /** A new problem: the glint along the bar's foot. */
    sweep(reduced: boolean) {
      if (reduced) return;
      requestAnimationFrame(() => {
        if (!placed) place();
        run("sweep", "new", DURATION.sweep, true);
      });
    },
    running,
    destroy() {
      unwatch();
      for (const timer of timers.values()) window.clearTimeout(timer);
      root.remove();
    },
  };

  function playNow(input: Play) {
    const { moments, reduced } = input;
    if (!placed) place();
    const origin = center(mark());
    const chipMoment = moments.find((moment): moment is ChipMoment =>
      /^(streak|points)-/.test(moment),
    );
    if (reduced) {
      setPoints(input.to ?? points);
      if (moments.length) {
        chip.dataset.lit = "";
        window.setTimeout(() => delete chip.dataset.lit, DURATION.chip);
      }
      const word = moments.includes("strong")
        ? "Strong"
        : moments.includes("earned")
          ? "Earned"
          : null;
      if (word) {
        stampWord.textContent = word;
        placeStamp(origin);
        stamp.dataset.still = "";
        window.setTimeout(() => delete stamp.dataset.still, DURATION.stamp);
      }
      return;
    }
    if (moments.includes("right")) {
      burst.style.setProperty("--x", `${Math.round(origin.x)}px`);
      burst.style.setProperty("--y", `${Math.round(origin.y)}px`);
      run("burst", "right", DURATION.burst);
      if (input.from != null && input.to != null) {
        points = input.to;
        const target = chip.getBoundingClientRect();
        flyer.style.setProperty("--from-x", `${Math.round(origin.x)}px`);
        flyer.style.setProperty("--from-y", `${Math.round(origin.y)}px`);
        flyer.style.setProperty(
          "--to-x",
          `${Math.round(target.left + target.width / 2)}px`,
        );
        flyer.style.setProperty(
          "--to-y",
          `${Math.round(target.top + target.height / 2)}px`,
        );
        run("flyer", "right", DURATION.flight, true);
        // The old number rolls away as the "+1" lands; the chip pops (a
        // bigger pop for its own moments).
        from.textContent = format(input.from);
        to.textContent = format(input.to);
        chip.style.setProperty("--land", `${DURATION.flight - 60}ms`);
        run(
          "chip",
          chipMoment ?? "tick",
          DURATION.flight + DURATION.chip,
          true,
        );
        show();
      }
    }
    if (chipMoment) {
      chipSparks.style.setProperty("--after", `${DURATION.flight - 60}ms`);
      run("chipSparks", chipMoment, DURATION.flight + DURATION.chip, true);
    }
    if (moments.includes("earned")) {
      stampWord.textContent = "Earned";
      placeStamp(origin);
      run("stamp", "earned", DURATION.stamp);
    }
    if (moments.includes("strong"))
      run("confetti", "strong", DURATION.confetti);
  }

  /** The stamp lands on the feedback sheet's upper corner, beside the mark
   * (or, with no sheet, high in the middle). */
  function placeStamp(origin: { x: number; y: number }) {
    const sheet = document.querySelector(".feedback")?.getBoundingClientRect();
    const x = sheet
      ? Math.min(sheet.right - 64, window.innerWidth - 64)
      : origin.x;
    const y = sheet ? Math.max(sheet.top + 8, 64) : origin.y;
    stamp.style.setProperty("--x", `${Math.round(x)}px`);
    stamp.style.setProperty("--y", `${Math.round(y)}px`);
  }
}

let shared: Stage | null = null;
/** The page's one stage, built on first use. */
export function stage() {
  shared ??= createStage();
  return shared;
}
/** Takes the page's stage down (tests; a page never needs to). */
export function dropStage() {
  shared?.destroy();
  shared = null;
}

/**
 * The one overlay every Colorful moment plays in: a fixed layer over the
 * page with `pointer-events: none`, built once and kept for the page's life,
 * so a moment's tail plays on over the next problem (practice remounts its
 * workspace for each one) and nothing is created while a child answers.
 * Every piece is drawn ahead and moved only by CSS keyframes on transform
 * and opacity (Celebration.module.css): nothing here can shift the layout,
 * take a tap, or delay the next problem. A moment already running is not
 * started again over itself; slower machines get fewer pieces. Nothing here
 * shows while a child is working: only the points chip stays.
 */
import styles from "./Celebration.module.css";
import type { ChipMoment, Moment } from "./tier";

/** The chip's one size per screen class (Celebration.module.css): a phone
 * gets the compact chip. It never changes size with its number. */
const PHONE = 420;
const chipWidth = () => (window.innerWidth < PHONE ? 92 : 104);
const CHIP_HEIGHT = 36;
/** How long each moment runs, in ms (the CSS durations, plus any delay). */
export const DURATION = {
  burst: 1000,
  flight: 560,
  flash: 480,
  combo: 1300,
  confetti: 3000,
  badge: 2000,
  stamp: 1500,
  chip: 900,
} as const;

/** Half the pieces where the machine has two cores or fewer (a school
 * Chromebook, an old laptop). */
export const pieceCount = (full: number, cores?: number) =>
  (cores ?? 8) <= 2 ? Math.ceil(full / 2) : full;
/** A right answer's burst, by the machine: 40 pieces on a capable phone or
 * laptop, 28 on four cores, 16 on two or fewer. */
export const burstCount = (cores?: number) =>
  (cores ?? 8) <= 2 ? 16 : (cores ?? 8) <= 4 ? 28 : 40;

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
  | "burst"
  | "flash"
  | "flyer"
  | "confetti"
  | "badge"
  | "combo"
  | "stamp"
  | "chip"
  | "chipSparks";

export type Stage = ReturnType<typeof createStage>;
type Play = {
  moments: readonly Moment[];
  /** The total before and after the answer; null: unknown (no "+1"). */
  from: number | null;
  to: number | null;
  /** No motion: each moment is a plain change of state. */
  reduced: boolean;
  /** Right answers without help in a row, this one counted: each win in a
   * run is bigger than the last. */
  streak?: number;
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

  // The win's pulse: the whole screen glows in the world's color, once.
  const flash = element("div", styles.flash!, root);

  // The burst: rays and dots from the result mark, two rings behind them.
  const burst = element("div", styles.burst!, root);
  const halo = element("i", styles.halo!, burst);
  halo.dataset.halo = "";
  element("i", styles.halo2!, burst);
  const sparks = burstCount(cores);
  for (let i = 0; i < sparks; i++) {
    const spark = element("i", styles.spark!, burst);
    const angle = (360 / sparks) * i + (rand() * 14 - 7);
    spark.style.setProperty("--angle", `${angle.toFixed(1)}deg`);
    spark.style.setProperty("--reach", `${Math.round(80 + rand() * 110)}px`);
    spark.style.setProperty(
      "--hue",
      `var(--color-celebrate-${(i % HUES) + 1})`,
    );
    spark.style.setProperty("--delay", `${Math.round(rand() * 60)}ms`);
    spark.dataset.shape = ["ray", "dot", "ray", "star"][i % 4]!;
  }

  // "+1", flying from the mark to the chip, three fading copies behind it
  // for a trail.
  const flyer = element("div", styles.flyer!, root);
  for (const trail of [3, 2, 1, 0]) {
    const lane = element("div", styles.flyerLane!, flyer);
    lane.style.setProperty("--trail", String(trail));
    const rise = element("div", styles.flyerY!, lane);
    element("span", styles.flyerPill!, rise).textContent = "+1";
  }

  // Confetti cannons: Strong, from both bottom corners at once.
  const confetti = element("div", styles.confetti!, root);
  const pieces = pieceCount(80, cores);
  for (let i = 0; i < pieces; i++) {
    const piece = element("i", styles.piece!, confetti);
    const left = i % 2 === 0;
    piece.dataset.side = left ? "left" : "right";
    // Up and inward, each a little differently, then down past the foot.
    const across = 18 + rand() * 62;
    piece.style.setProperty(
      "--dx",
      `${(left ? across : -across).toFixed(1)}vw`,
    );
    piece.style.setProperty("--rise", `${Math.round(45 + rand() * 45)}vh`);
    piece.style.setProperty("--spin", `${Math.round(rand() * 1080 - 540)}deg`);
    piece.style.setProperty("--delay", `${Math.round(rand() * 260)}ms`);
    piece.style.setProperty("--fly", `${Math.round(1900 + rand() * 900)}ms`);
    piece.style.setProperty(
      "--hue",
      i % 7 === 0
        ? "var(--color-points)"
        : `var(--color-celebrate-${(i % HUES) + 1})`,
    );
    piece.dataset.shape = ["ribbon", "dot", "square", "star"][i % 4]!;
  }
  // Strong's badge: a big star that stamps in, the word across it.
  const badge = element("div", styles.badge!, root);
  badge.append(svgStar(styles.badgeStar!));
  element("span", styles.badgeWord!, badge).textContent = "Strong";

  // A run's counter, under the chip: a bolt and "×5".
  const combo = element("div", styles.combo!, root);
  const bolt = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  bolt.setAttribute("viewBox", "0 0 24 24");
  bolt.setAttribute("class", styles.comboBolt!);
  const boltPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  boltPath.setAttribute("d", "M13.5 2 4 13.6h6.2L9 22l10-12.2h-6.4z");
  bolt.append(boltPath);
  combo.append(bolt);
  const comboCount = element("span", styles.comboCount!, combo);

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
    flash,
    flyer,
    confetti,
    badge,
    combo,
    stamp,
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

  /**
   * Where the chip sits: in the app bar's top row, at the right end of the
   * free stretch nearest the right (after the topic, before the bar's own
   * tools and actions, whatever they are, including slots they keep
   * hidden). Where the row is too full (a phone with a name in the bar),
   * it takes the wordmark's place beside the logo's wave, which stays the
   * menu's button under it. A student's phone bar (their name, sign-out,
   * the calculator, a raised hand) never has room: there the chip sits at
   * the end of the topic's line, which keeps that room for it (skin.css),
   * the same on every problem.
   */
  function place() {
    placed = true;
    const CHIP_WIDTH = chipWidth();
    const bar = document.querySelector("[data-app-bar]");
    const width = window.innerWidth;
    let left = width - CHIP_WIDTH - 16;
    let top = 10;
    let byLogo = false;
    const topic = document.querySelector(".practice-surface > .practice-topic");
    const topicBox = topic?.getBoundingClientRect();
    if (
      bar?.getAttribute("data-space") === "student" &&
      width < PHONE &&
      topicBox?.height
    ) {
      left = topicBox.right - CHIP_WIDTH;
      top = topicBox.top + (topicBox.height - CHIP_HEIGHT) / 2;
    } else if (bar) {
      const box = bar.getBoundingClientRect();
      const logo = bar.firstElementChild?.getBoundingClientRect();
      const rowTop = box.top;
      const rowBottom = logo ? logo.bottom + 6 : box.top + 56;
      const wordmark = bar.querySelector("[data-navigation-trigger] span");
      const taken: [number, number, boolean][] = [];
      for (const node of bar.querySelectorAll<HTMLElement | SVGElement>("*")) {
        const leaf =
          node instanceof SVGSVGElement ||
          /^(BUTTON|A|IMG|INPUT|SELECT)$/.test(node.tagName) ||
          [...node.childNodes].some(
            (child) =>
              child.nodeType === Node.TEXT_NODE && !!child.textContent?.trim(),
          );
        // The logo's button is its mark and its wordmark, each its own.
        if (!leaf || node.hasAttribute("data-navigation-trigger")) continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (rect.bottom <= rowTop || rect.top >= rowBottom) continue;
        taken.push([rect.left, rect.right, node === wordmark]);
      }
      taken.sort((a, b) => a[0] - b[0]);
      const inset = width >= 768 ? 24 : 12;
      const gap = 12;
      const need = CHIP_WIDTH + gap * 2;
      /** Free stretches between what the row holds. */
      const stretches = (
        free: (entry: [number, number, boolean]) => boolean,
      ) => {
        const edges: [number, number][] = [];
        let cursor = box.left + inset;
        for (const entry of taken) {
          if (free(entry)) continue;
          if (entry[0] > cursor) edges.push([cursor, entry[0]]);
          cursor = Math.max(cursor, entry[1]);
        }
        edges.push([cursor, box.right - inset]);
        return edges;
      };
      const middle = (rowTop + rowBottom - 6 - CHIP_HEIGHT) / 2;
      const fits = stretches(() => false)
        .reverse()
        .find(([start, end]) => end - start >= need);
      const beside = fits
        ? undefined
        : stretches(([, , mark]) => mark).find(
            ([start, end]) => end - start >= CHIP_WIDTH + gap,
          );
      if (fits) {
        left = fits[1] - gap - CHIP_WIDTH;
        top = middle;
      } else if (beside) {
        left = beside[0] + gap / 2;
        top = middle;
        byLogo = true;
      } else {
        left = box.right - inset - CHIP_WIDTH;
        top = box.bottom + 8;
      }
    }
    if (byLogo) document.documentElement.dataset.pointsChip = "logo";
    else delete document.documentElement.dataset.pointsChip;
    root.style.setProperty("--chip-left", `${Math.round(left)}px`);
    root.style.setProperty("--chip-top", `${Math.round(top)}px`);
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
    // The bar's content settles after the chip first shows (a name, the
    // tools): look again once things have drawn.
    window.setTimeout(schedule, 300);
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
        delete document.documentElement.dataset.pointsChip;
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
    running,
    destroy() {
      unwatch();
      delete document.documentElement.dataset.pointsChip;
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
      // Strong's badge, Earned's stamp and a run's counter simply show,
      // then go.
      const still = (node: HTMLElement, ms: number) => {
        node.dataset.still = "";
        window.setTimeout(() => delete node.dataset.still, ms);
      };
      if (moments.includes("strong")) still(badge, DURATION.badge);
      else if (moments.includes("earned")) {
        stampWord.textContent = "Earned";
        placeStamp(origin);
        still(stamp, DURATION.stamp);
      }
      if ((input.streak ?? 0) >= 3 && moments.includes("right")) {
        comboCount.textContent = `×${input.streak}`;
        still(combo, DURATION.combo);
      }
      return;
    }
    // Each win in a run is bigger than the last, up to twice as big at 10.
    const win = 1 + Math.min(10, Math.max(0, (input.streak ?? 1) - 1)) / 9;
    root.style.setProperty("--win", win.toFixed(2));
    if (moments.includes("right")) {
      burst.style.setProperty("--x", `${Math.round(origin.x)}px`);
      burst.style.setProperty("--y", `${Math.round(origin.y)}px`);
      run("burst", "right", DURATION.burst);
      flash.style.setProperty("--x", `${Math.round(origin.x)}px`);
      flash.style.setProperty("--y", `${Math.round(origin.y)}px`);
      run("flash", "right", DURATION.flash, true);
      if ((input.streak ?? 0) >= 3) {
        comboCount.textContent = `×${input.streak}`;
        combo.dataset.level =
          (input.streak ?? 0) >= 10
            ? "3"
            : (input.streak ?? 0) >= 5
              ? "2"
              : "1";
        run("combo", "streak", DURATION.flight + DURATION.combo, true);
      }
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
    if (moments.includes("strong")) {
      run("confetti", "strong", DURATION.confetti);
      run("badge", "strong", DURATION.badge, true);
      run("flash", "strong", DURATION.flash * 2, true);
    }
  }

  /** The stamp lands on the feedback sheet's upper corner, beside the mark
   * (or, with no sheet, high in the middle). */
  function placeStamp(origin: { x: number; y: number }) {
    const sheet = document.querySelector(".feedback")?.getBoundingClientRect();
    const x = sheet
      ? Math.min(sheet.right - 84, window.innerWidth - 84)
      : origin.x;
    // Level with the sheet's head, clear of the bar and its chip.
    const y = sheet ? Math.max(sheet.top + 34, 104) : origin.y;
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

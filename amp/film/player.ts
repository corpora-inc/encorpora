/** One live player for learner routes and the review page. The audio is its clock. */
import "./film.css";
import "./live.css";
import { Film, TALL, WIDE, type Layout } from "./stage";
import { mountExample } from "./example";
import type { Script, Timing } from "./schema";
import { WAVE_PATH } from "../src/web/ui/Loading";

export type LiveLesson = {
  id: string;
  title: string;
  script: Script;
  timing: Timing;
  figure: unknown;
};
export type PlayerOptions = {
  dataUrl: string;
  audioUrl: string;
  title?: string;
  duration?: number;
  backHref: string;
  backLabel: string;
  onBack?: () => void;
};
export const filmClock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent: HTMLElement,
  text = "",
) {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

/** Returns synchronously so route changes can cancel even the first fetch. */
export function mountFilmPlayer(
  host: HTMLElement,
  options: PlayerOptions,
): () => void {
  const shell = el("section", "live", host);
  shell.tabIndex = -1;
  shell.setAttribute("aria-label", options.title ?? "Lesson film");
  const frame = el("div", "live-frame", shell);
  const scale = el("div", "live-scale", frame);
  const root = el("div", "", scale);
  root.id = "film";
  const poster = el("div", "live-poster", frame);
  const title = el(
    "h1",
    "live-poster-title",
    poster,
    options.title ?? "Lesson film",
  );
  const meta = el(
    "p",
    "live-poster-meta",
    poster,
    options.duration ? filmClock(options.duration) : "",
  );
  const cover = el("button", "live-cover", frame);
  cover.setAttribute("aria-label", "Play lesson film");
  const status = el("div", "live-status", frame);
  status.setAttribute("role", "status");
  const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wave.setAttribute("class", "amp-wave");
  wave.setAttribute("viewBox", "0 0 44 28");
  wave.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(wave.namespaceURI, "path");
  path.setAttribute("d", WAVE_PATH);
  wave.appendChild(path);
  status.appendChild(wave);
  const message = el("p", "", status);
  const retry = el("button", "live-retry", status, "Retry");
  retry.hidden = true;
  const bar = el("div", "live-bar", shell);
  const toggle = el("button", "live-toggle", bar);
  toggle.setAttribute("aria-label", "Play");
  const scrub = el("input", "live-scrub", bar);
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = String(options.duration ?? 1);
  scrub.step = "0.1";
  scrub.value = "0";
  scrub.setAttribute("aria-label", "Film position");
  const time = el(
    "span",
    "live-time",
    bar,
    `0:00 / ${filmClock(options.duration ?? 0)}`,
  );
  const controls = el("div", "live-tools", bar);
  const speed = el("button", "live-speed", controls, "1×");
  speed.title = "Change playback speed";
  speed.setAttribute("aria-label", "Playback speed: 1×");
  const fullscreen = el("button", "live-fullscreen", controls, "Full screen");
  fullscreen.hidden = !document.fullscreenEnabled;
  const back = el("a", "live-back", controls, options.backLabel);
  back.href = options.backHref;
  back.onclick = (event) => {
    if (
      options.onBack &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      options.onBack();
    }
  };
  const audio = el("audio", "", shell);
  audio.preload = "auto";
  let disposed = false,
    film: Film | undefined,
    lesson: LiveLesson | undefined;
  let layout: Layout | undefined,
    t = 0,
    duration = options.duration ?? 1,
    raf = 0;
  let abort: AbortController | undefined;
  const unmounts: (() => void)[] = [];
  const clearFigures = () => {
    unmounts.splice(0).forEach((unmount) => unmount());
  };
  const disable = (value: boolean) => {
    toggle.disabled = cover.disabled = scrub.disabled = value;
  };
  const waiting = (text: string) => {
    status.hidden = false;
    message.textContent = text;
    retry.hidden = true;
    wave.style.display = "";
    status.classList.add("is-loading");
  };
  const fail = (text: string) => {
    if (disposed) return;
    audio.pause();
    disable(true);
    console.error("Lesson film playback failed.");
    status.hidden = false;
    status.classList.remove("is-loading");
    wave.style.display = "none";
    message.textContent = text;
    retry.hidden = false;
  };
  const fit = () => {
    if (!layout) return;
    const k = Math.min(
      frame.clientWidth / layout.w,
      frame.clientHeight / layout.h,
    );
    scale.style.transform = `translate(${(frame.clientWidth - layout.w * k) / 2}px, ${(frame.clientHeight - layout.h * k) / 2}px) scale(${k})`;
  };
  const build = () => {
    if (!lesson || disposed) return;
    const next = frame.clientHeight > frame.clientWidth ? TALL : WIDE;
    if (film && next === layout) {
      fit();
      return;
    }
    clearFigures();
    layout = next;
    scale.style.transform = "none";
    scale.style.width = `${next.w}px`;
    scale.style.height = `${next.h}px`;
    root.replaceChildren();
    film = new Film(
      root,
      lesson.script,
      lesson.timing,
      (host, shot, actions) =>
        mountExample(lesson!.figure, host, shot, actions, (unmount) =>
          unmounts.push(unmount),
        ),
      { checks: false, layout: next },
    );
    duration = film.duration;
    scrub.max = String(duration);
    fit();
    film.seek(t);
  };
  const draw = (value: number) => {
    t = Math.max(0, Math.min(duration, value));
    film?.seek(t);
    scrub.value = String(t);
    scrub.style.setProperty("--live-done", `${(100 * t) / duration}%`);
    scrub.setAttribute(
      "aria-valuetext",
      `${filmClock(t)} of ${filmClock(duration)}`,
    );
    time.textContent = `${filmClock(t)} / ${filmClock(duration)}`;
    shell.classList.toggle("moved", t > 0.05);
  };
  const state = () => {
    const playing = !audio.paused && !audio.ended;
    shell.classList.toggle("playing", playing);
    if (playing) shell.classList.add("started");
    toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    cover.setAttribute(
      "aria-label",
      playing ? "Pause lesson film" : "Play lesson film",
    );
    cancelAnimationFrame(raf);
    if (playing) tick();
  };
  const tick = () => {
    if (disposed) return;
    draw(audio.currentTime);
    if (!audio.paused) raf = requestAnimationFrame(tick);
  };
  const flip = () => {
    if (audio.ended || t >= duration - 0.05) audio.currentTime = 0;
    if (audio.paused)
      void audio
        .play()
        .catch(() =>
          fail(
            "The narration could not start. Check your connection and retry.",
          ),
        );
    else audio.pause();
  };
  toggle.onclick = cover.onclick = flip;
  scrub.oninput = () => {
    audio.currentTime = Number(scrub.value);
    draw(audio.currentTime);
  };
  audio.onplay = audio.onpause = state;
  audio.onended = () => {
    draw(duration);
    state();
  };
  audio.onseeked = () => draw(audio.currentTime);
  audio.onwaiting = () => waiting("Loading narration…");
  audio.onplaying = () => {
    status.hidden = true;
  };
  audio.onerror = () =>
    fail("The narration could not load. Check your connection and retry.");
  audio.oncanplay = () => {
    if (film) {
      disable(false);
      status.hidden = true;
    }
  };
  const rates = [0.75, 1, 1.25, 1.5, 2];
  speed.onclick = () => {
    audio.playbackRate =
      rates[(rates.indexOf(audio.playbackRate) + 1) % rates.length]!;
    speed.textContent = `${audio.playbackRate}×`;
    speed.setAttribute("aria-label", `Playback speed: ${audio.playbackRate}×`);
  };
  fullscreen.onclick = () => {
    const operation = document.fullscreenElement
      ? document.exitFullscreen()
      : shell.requestFullscreen();
    void operation.catch(() => {
      console.error("Lesson film full screen could not open.");
    });
  };
  const keydown = (event: KeyboardEvent) => {
    if (
      event.key === " " &&
      !(event.target as HTMLElement).closest("input, button, a") &&
      !toggle.disabled
    ) {
      event.preventDefault();
      flip();
    }
  };
  shell.addEventListener("keydown", keydown);
  const observer = new ResizeObserver(() => {
    try {
      build();
    } catch {
      fail("The lesson picture could not load. Please retry.");
    }
  });
  observer.observe(frame);
  async function load() {
    abort?.abort();
    const controller = new AbortController();
    abort = controller;
    audio.pause();
    disable(true);
    waiting("Loading lesson…");
    try {
      const response = await fetch(options.dataUrl, {
        signal: controller.signal,
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Film data unavailable");
      const data = (await response.json()) as LiveLesson;
      await document.fonts.ready;
      await Promise.all(
        [
          "KaTeX_Main",
          "KaTeX_Math",
          "KaTeX_AMS",
          "KaTeX_Size1",
          "KaTeX_Size2",
        ].map((font) => document.fonts.load(`40px ${font}`).catch(() => null)),
      );
      if (disposed || controller.signal.aborted) return;
      lesson = data;
      film = undefined;
      title.textContent = data.title;
      meta.textContent = filmClock(data.timing.duration);
      shell.setAttribute("aria-label", data.title);
      build();
      draw(t);
      waiting("Loading narration…");
      audio.src = options.audioUrl;
      audio.load();
      audio.currentTime = t;
    } catch {
      if (!disposed && !controller.signal.aborted)
        fail("The lesson could not load. Check your connection and retry.");
    }
  }
  retry.onclick = () => {
    void load();
  };
  void load();
  shell.focus({ preventScroll: true });
  return () => {
    disposed = true;
    abort?.abort();
    observer.disconnect();
    cancelAnimationFrame(raf);
    audio.onplay =
      audio.onpause =
      audio.onended =
      audio.onerror =
      audio.oncanplay =
      audio.onwaiting =
      audio.onplaying =
      audio.onseeked =
        null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    clearFigures();
    shell.remove();
  };
}

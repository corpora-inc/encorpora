import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const setupAppHeight = () => {
  const win = window as Window & {
    __appHeightInit?: boolean;
    __appHeightRaf?: number;
    __appHeightInterval?: number;
    __appHeightBoostUntil?: number;
  };

  if (win.__appHeightInit) return;
  win.__appHeightInit = true;

  const isIOS = (() => {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOS = platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOS;
  })();

  const boostDurationMs = 1200;

  const getBestViewportHeight = () => {
    const vvHeight = window.visualViewport?.height ?? 0;
    const innerHeight = window.innerHeight ?? 0;
    const docHeight = document.documentElement.clientHeight ?? 0;
    const screenHeight = window.screen?.height ?? 0;
    const preferred = Math.max(vvHeight, innerHeight, docHeight);

    if (!isIOS) {
      return preferred || screenHeight || innerHeight || docHeight;
    }

    const isPortrait =
      window.matchMedia?.("(orientation: portrait)")?.matches ??
      (innerHeight >= (window.innerWidth ?? 0));
    const boostActive = (win.__appHeightBoostUntil ?? 0) > Date.now();
    const keyboardOpen = vvHeight > 0 && innerHeight > 0 && vvHeight < innerHeight - 80;

    if (isPortrait && boostActive && !keyboardOpen) {
      return Math.max(preferred, screenHeight);
    }

    return preferred || screenHeight || innerHeight || docHeight;
  };

  const applyAppHeight = () => {
    const height = getBestViewportHeight();
    if (!height) return;
    const px = `${Math.round(height)}px`;
    document.documentElement.style.setProperty("--app-height", px);
    document.documentElement.style.height = px;
    document.documentElement.style.minHeight = px;
    document.body.style.height = px;
    document.body.style.minHeight = px;
  };

  const schedule = () => {
    if (win.__appHeightRaf) {
      cancelAnimationFrame(win.__appHeightRaf);
    }
    win.__appHeightRaf = requestAnimationFrame(applyAppHeight);
  };

  // Initial kick + short settle loop to mimic the "post-rotation" layout correction.
  win.__appHeightBoostUntil = Date.now() + boostDurationMs;
  applyAppHeight();
  requestAnimationFrame(applyAppHeight);
  setTimeout(applyAppHeight, 100);
  setTimeout(applyAppHeight, 250);
  setTimeout(applyAppHeight, 500);

  if (isIOS) {
    let ticks = 0;
    win.__appHeightInterval = window.setInterval(() => {
      applyAppHeight();
      ticks += 1;
      if (ticks >= 15 && win.__appHeightInterval) {
        clearInterval(win.__appHeightInterval);
        win.__appHeightInterval = undefined;
      }
    }, 100);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", () => {
    win.__appHeightBoostUntil = Date.now() + boostDurationMs;
    schedule();
  });
  window.visualViewport?.addEventListener("resize", schedule);
};

setupAppHeight();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

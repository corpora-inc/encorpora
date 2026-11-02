/** Chromium policy shared by production rendering and repository browser tools. */
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const CHROME_VERSION = "156.0.8078.80";
export const MIN_CHROME_VERSION = "156.0.8078.73";
export const chromePlatform = () => {
  const key = `${process.platform}/${process.arch}`;
  const platform = {
    "darwin/arm64": "mac-arm64",
    "darwin/x64": "mac-x64",
    "linux/x64": "linux64",
    "linux/arm64": "linux-arm64",
    "win32/x64": "win64",
  }[key];
  if (!platform) throw new Error(`Unsupported Chrome platform: ${key}`);
  return platform;
};
export function chromePath() {
  if (process.env.CORPORA_CHROME_PATH) return process.env.CORPORA_CHROME_PATH;
  const platform = chromePlatform();
  return join(
    process.env.CORPORA_CHROME_CACHE ??
      join(homedir(), ".cache", "corpora-chrome"),
    CHROME_VERSION,
    `chrome-${platform}`,
    platform.startsWith("mac-")
      ? "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
      : platform === "win64"
        ? "chrome.exe"
        : "chrome",
  );
}
export function assertPatchedVersion(version) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version))
    throw new Error(`Invalid Chrome version: ${version}`);
  const actual = version.split(".").map(Number);
  const minimum = MIN_CHROME_VERSION.split(".").map(Number);
  for (let i = 0; i < minimum.length; i++) {
    if (actual[i] > minimum[i]) return;
    if (actual[i] < minimum[i])
      throw new Error(
        `Chrome ${version} is vulnerable; require ${MIN_CHROME_VERSION} or newer. Run node amp/scripts/install-browser.mjs from the repository root.`,
      );
  }
}

/** Preserve the BrowserType API, including callers that select an engine dynamically.
 * Validate before returning a browser to a caller, before any page can load content.
 * Connecting to an existing native WebView leaves that application's launch policy alone. */
export function secureChromium(browserType, { trustedBuild = false } = {}) {
  return new Proxy(browserType, {
    get(target, property) {
      if (property === "executablePath") return chromePath;
      if (property === "launch")
        return async (options = {}) => {
          const executablePath = chromePath();
          if (!existsSync(executablePath))
            throw new Error(
              "Patched Chrome is missing. Run node amp/scripts/install-browser.mjs from the repository root.",
            );
          if (
            options.args?.some((arg) =>
              /^(--no-sandbox|--disable-setuid-sandbox)(=|$)/.test(arg),
            )
          )
            throw new Error("Disabling the Chromium sandbox is forbidden");
          const browser = await target.launch({
            ...options,
            channel: undefined,
            executablePath,
            chromiumSandbox: !(
              trustedBuild &&
              process.env.CORPORA_PDF_BUILD === "1" &&
              process.getuid?.() === 0
            ),
          });
          try {
            assertPatchedVersion(browser.version());
          } catch (error) {
            await browser.close();
            throw error;
          }
          return browser;
        };
      if (property === "launchServer" || property === "launchPersistentContext")
        return () => {
          throw new Error("Use the verified Chromium launch helper");
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

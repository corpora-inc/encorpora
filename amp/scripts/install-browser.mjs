/** Install the pinned security-patched Chrome for Testing, independently of Playwright. */
import {
  chromePlatform,
  chromePath,
  CHROME_VERSION,
  assertPatchedVersion,
} from "../browser-security.mjs";
import { chmod, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const executable = chromePath();
const platform = chromePlatform();
function verify() {
  const output = execFileSync(executable, ["--version"], { encoding: "utf8" });
  const version = output.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
  assertPatchedVersion(version ?? "unknown");
  if (version !== CHROME_VERSION)
    throw new Error(`Expected Chrome ${CHROME_VERSION}, got ${version}`);
  console.log(`Verified Chrome ${version}`);
}
if (existsSync(executable)) verify();
else {
  if (process.env.CORPORA_CHROME_PATH)
    throw new Error(
      "CORPORA_CHROME_PATH must point to an installed Chrome executable",
    );
  const { homedir } = await import("node:os");
  const root = join(
    process.env.CORPORA_CHROME_CACHE ??
      join(homedir(), ".cache", "corpora-chrome"),
    CHROME_VERSION,
  );
  await mkdir(dirname(root), { recursive: true });
  const temporary = await mkdtemp(join(dirname(root), "download-"));
  try {
    const archive = join(temporary, "chrome.zip");
    execFileSync(
      "curl",
      [
        "--fail",
        "--location",
        "--retry",
        "3",
        "--proto",
        "=https",
        "--output",
        archive,
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${platform}/chrome-${platform}.zip`,
      ],
      { stdio: "inherit" },
    );
    execFileSync("unzip", ["-q", archive, "-d", temporary]);
    await rm(archive);
    await chmod(temporary, 0o755);
    try {
      await rename(temporary, root);
    } catch (error) {
      if (!existsSync(executable)) throw error;
    }
    verify();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv.includes("--configure-linux-sandbox") &&
  process.platform === "linux"
) {
  const { fileURLToPath } = await import("node:url");
  execFileSync(
    "sudo",
    [
      "bash",
      fileURLToPath(new URL("./configure-browser-sandbox.sh", import.meta.url)),
      executable,
    ],
    { stdio: "inherit" },
  );
}

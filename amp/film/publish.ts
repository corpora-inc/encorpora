/** Publish only current founder approvals whose exact screenplay is committed. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile, rename, mkdtemp, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { templates } from "../src/math/engine";
import {
  committedApprovalIds,
  assertReviewedFiles,
  canonical,
  planFilm,
  publishFilms,
  sha256,
  type Approval,
  type ReviewRow,
} from "./publication";

const root = fileURLToPath(new URL("../..", import.meta.url));
const configPath =
  process.env.AMP_FILM_PUBLISH_CONFIG ??
  join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "corpora/amp/film-publish.json",
  );
const config = z
  .object({
    reviewDir: z.string().min(1),
    bucket: z.string().min(1),
    profile: z.string().min(1),
    originPrefix: z.string().default("artifacts"),
  })
  .strict()
  .parse(JSON.parse(await readFile(configPath, "utf8")));
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const grades: Record<string, Approval> = await json(
  join(config.reviewDir, "grades.json"),
);
const rows: ReviewRow[] = await json(join(config.reviewDir, "index.json"));
const committedPaths = new Set(
  execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD", "--", "amp/film/lessons"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim().split("\n"),
);
const { ids, pending } = committedApprovalIds(grades, rows, committedPaths);
if (pending.length)
  console.warn(`Skipped ${pending.length} approved films until their screenplays are committed: ${pending.join(", ")}`);
const plans = [];
const snapshots = new Map<string, string>();
async function snapshot(path: string, approval: Approval) {
  const before = await stat(path);
  const bytes = await readFile(path);
  const after = await stat(path);
  if (
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.ctimeMs !== after.ctimeMs
  )
    throw new Error(
      "Export changed while reading; retry after export finishes",
    );
  assertReviewedFiles(approval, [after.mtimeMs]);
  return {
    bytes,
    identity: `${after.ino}:${after.size}:${after.mtimeMs}:${after.ctimeMs}:${sha256(bytes)}`,
  };
}
for (const id of ids) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid film ID");
  const path = `amp/film/lessons/${id}.json`;
  let committed: unknown;
  try {
    committed = JSON.parse(
      execFileSync("git", ["-C", root, "show", `HEAD:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    throw new Error(`Commit the approved screenplay before publishing: ${id}`);
  }
  if (canonical(committed) !== canonical(await json(join(root, path))))
    throw new Error(`Uncommitted screenplay changes: ${id}`);
  const dataPath = join(config.reviewDir, `${id}.json`),
    audioPath = join(config.reviewDir, `${id}.m4a`);
  const data = await snapshot(dataPath, grades[id]!),
    audio = await snapshot(audioPath, grades[id]!);
  snapshots.set(dataPath, data.identity);
  snapshots.set(audioPath, audio.identity);
  plans.push(
    planFilm(
      id,
      JSON.parse(data.bytes.toString()),
      committed,
      audio.bytes,
      new Set(templates.map((t) => t.id)),
    ),
  );
}
if (process.argv.includes("--check")) {
  console.log(
    `${plans.length} approved films validated; no uploads or manifest changes.`,
  );
} else {
  // Check the cleanup dependency before performing any external writes.
  try {
    execFileSync("which", ["trash"], { stdio: "ignore" });
  } catch {
    throw new Error("Install the trash command before publishing");
  }
  const temp = await mkdtemp(join(tmpdir(), "amp-film-publish-"));
  try {
    await publishFilms(
      plans,
      async (url, bytes, type) => {
        const key =
          config.originPrefix.replace(/^\/+|\/+$/g, "") + new URL(url).pathname;
        const hash = sha256(bytes);
        // Upload before the first CDN request: a missing-object preflight can
        // cache a 403/404 at the edge and hide the newly uploaded object.
        const file = join(temp, hash);
        await writeFile(file, bytes);
        try {
          execFileSync(
            "aws",
            [
              "s3api",
              "put-object",
              "--profile",
              config.profile,
              "--bucket",
              config.bucket,
              "--key",
              key,
              "--body",
              file,
              "--content-type",
              type,
              "--cache-control",
              "public,max-age=31536000,immutable",
              "--metadata",
              `sha256=${hash}`,
              "--if-none-match",
              "*",
            ],
            { stdio: "pipe" },
          );
        } catch {
          // An immutable object may already exist; readback must prove identical bytes.
          const response = await fetch(url, {
            signal: AbortSignal.timeout(60000),
          });
          if (
            !response.ok ||
            sha256(Buffer.from(await response.arrayBuffer())) !== hash
          )
            throw new Error(
              "Media upload failed; check publisher permissions and existing object bytes",
            );
        }
      },
      async (url, bytes) => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(60000),
          headers: { Origin: "https://amp.corpora.inc" },
        });
        if (
          !response.ok ||
          response.headers.get("access-control-allow-origin") !== "*" ||
          sha256(Buffer.from(await response.arrayBuffer())) !== sha256(bytes)
        )
          throw new Error("CDN readback failed; manifest was not changed");
      },
      async (manifest) => {
        // Re-read approval state before exposing any uploaded edition to learners.
        const currentGrades: Record<string, Approval> = await json(
          join(config.reviewDir, "grades.json"),
        );
        const currentRows: ReviewRow[] = await json(
          join(config.reviewDir, "index.json"),
        );
        if (
          canonical(committedApprovalIds(currentGrades, currentRows, committedPaths).ids) !==
            canonical(ids) ||
          ids.some((id) => currentGrades[id]?.added !== grades[id]?.added)
        )
          throw new Error("Approvals changed during publishing; run again");
        for (const id of ids)
          for (const extension of ["json", "m4a"]) {
            const path = join(config.reviewDir, `${id}.${extension}`);
            if (
              (await snapshot(path, currentGrades[id]!)).identity !==
              snapshots.get(path)
            )
              throw new Error(
                "Reviewed export changed during publication; manifest was not changed",
              );
          }
        const path = resolve(root, "amp/src/content/films/manifest.json");
        await writeFile(
          `${path}.tmp`,
          JSON.stringify(manifest, null, 2) + "\n",
        );
        await rename(`${path}.tmp`, path);
      },
    );
    console.log(
      `${plans.length} approved films published and verified. Commit the manifest and ship through the trunk PR gates.`,
    );
  } finally {
    // The workspace's cleanup convention preserves recoverability.
    execFileSync("trash", [temp], { stdio: "ignore" });
  }
}

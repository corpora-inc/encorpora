import { useEffect, useReducer } from "react";
import { coinKinds, billValues } from "../../math/scene/art";
import { AppError } from "../lib/AppError";
import { buildIsStale, reloadIntoCurrentRelease } from "../lib/app-recovery";
import { billFaceUrl } from "./bill-art";
import { coinFaceUrl } from "./coin-art";

/**
 * Coins and bills are pictures (CoinFace, BillFace). In the app they are
 * files, cached for good (`coin-art.files.ts`), so the practice code doesn't
 * carry them. A coin still never waits on the network where a learner sees
 * it: practice fetches the pictures while the learner settles in, and a
 * problem that draws money shows only once its pictures are decoded, so
 * each paints whole in its first frame. Printing, the server and film keep
 * embedded copies, which are always ready.
 */

const coinNames = new Set<string>(coinKinds);
const billNumbers = new Set<number>(billValues);

/** Every money picture a problem draws, wherever it sits in the problem
 * (its figure, its choices, its lesson): coins by name, bills by value. */
export function moneyArtIn(value: unknown): string[] {
  const found = new Set<string>();
  const seen = new Set<object>();
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (coinNames.has(node))
        found.add(coinFaceUrl[node as (typeof coinKinds)[number]]);
      return;
    }
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) return node.forEach(visit);
    const record = node as Record<string, unknown>;
    if (
      record.type === "bill" &&
      typeof record.value === "number" &&
      billNumbers.has(record.value)
    )
      found.add(billFaceUrl[record.value as (typeof billValues)[number]]);
    for (const child of Object.values(record)) visit(child);
  };
  visit(value);
  return [...found];
}

const decoded = new Set<string>();
/** Decoded pictures are kept, so the browser keeps them ready to paint. */
const kept: HTMLImageElement[] = [];
const decoding = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/** An embedded picture is always ready; so is one where nothing decodes
 * (a server render or a test without images). */
export function artReady(url: string): boolean {
  return (
    decoded.has(url) ||
    url.startsWith("data:") ||
    typeof Image === "undefined" ||
    typeof Image.prototype.decode !== "function"
  );
}

const ATTEMPTS = 3;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
function decodeOne(url: string): Promise<void> {
  if (artReady(url)) return Promise.resolve();
  let pending = decoding.get(url);
  if (!pending) {
    pending = (async () => {
      for (let attempt = 1; ; attempt++) {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        try {
          await image.decode();
          kept.push(image);
          decoded.add(url);
          listeners.forEach((listener) => listener());
          return;
        } catch (error) {
          console.error(
            `A money picture didn't load (attempt ${attempt} of ${ATTEMPTS})`,
            url,
            error,
          );
          if (attempt >= ATTEMPTS) {
            // A tab from an older release may ask for a file that is gone.
            if (await buildIsStale()) await reloadIntoCurrentRelease();
            const failure = new AppError(
              "network",
              "The pictures for this problem didn't load. Check your connection and try again.",
              true,
            );
            failure.log();
            throw failure;
          }
          await pause(600 * attempt);
        }
      }
    })();
    decoding.set(url, pending);
    // A failure isn't remembered: the next ask tries again.
    pending.catch((error: unknown) => {
      decoding.delete(url);
      console.warn("Money art didn't decode; the next ask tries again", error);
    });
  }
  return pending;
}

/** Resolves once every picture is decoded, retrying each a few times; a
 * picture that still fails rejects with an error the screen shows. */
export function decodeArt(urls: readonly string[]): Promise<void> {
  return Promise.all(urls.map(decodeOne)).then(() => undefined);
}

/** Holds a problem until the money it draws is ready to paint. */
export async function withMoneyArt<T>(problem: T): Promise<T> {
  await decodeArt(moneyArtIn(problem));
  return problem;
}

let fetched = false;
/** Practice has started: fetch every money picture at low priority, so a
 * money problem later finds them in the cache. Once per page. */
export function prefetchMoneyArt() {
  if (fetched || typeof Image === "undefined") return;
  fetched = true;
  const urls = [...Object.values(coinFaceUrl), ...Object.values(billFaceUrl)];
  for (const url of urls) {
    if (artReady(url)) continue;
    const image = new Image();
    image.fetchPriority = "low";
    image.src = url;
    kept.push(image);
  }
}

/**
 * For a figure drawn outside practice's own wait (a lesson, an animation):
 * whether its pictures are ready, asking for any that aren't. Until then the
 * figure keeps its space and stays hidden, so no coin paints without its face.
 */
export function useArtReady(urls: readonly string[]): boolean {
  const [, changed] = useReducer((n: number) => n + 1, 0);
  const missing = urls.filter((url) => !artReady(url));
  const key = missing.join(" ");
  useEffect(() => {
    if (!key) return;
    let live = true;
    const update = () => {
      if (live) changed();
    };
    listeners.add(update);
    decodeArt(key.split(" ")).catch((error: unknown) =>
      console.error("A figure's money pictures didn't load", error),
    );
    return () => {
      live = false;
      listeners.delete(update);
    };
  }, [key]);
  return missing.length === 0;
}

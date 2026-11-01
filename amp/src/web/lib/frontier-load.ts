import { AccountSessionChanged } from "./account-session";

/**
 * Loads Home's level map for one learner. A response for a learner or
 * account that is no longer on screen is discarded and noted at info level;
 * only a real failure is reported as an error.
 */
export async function loadFrontier<T>(
  request: () => Promise<T>,
  current: () => boolean,
  show: (map: T) => void,
) {
  try {
    const map = await request();
    if (current()) show(map);
  } catch (error) {
    if (error instanceof AccountSessionChanged || !current())
      console.info("Frontier map request superseded by a newer screen");
    else console.error("Frontier map failed to load", error);
  }
}

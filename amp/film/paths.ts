/** Production artifacts stay outside the repository by default. */
import { homedir } from "node:os";
import { join } from "node:path";

const data = join(homedir(), ".local", "share", "amp-film");
export const FILM_OUT = process.env.FILM_OUT ?? join(data, "films");
export const FILM_VOICES = process.env.FILM_VOICES ?? join(data, "voices");
export const FILM_LOCKS = process.env.FILM_LOCKS ?? join(data, "locks");

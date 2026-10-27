import * as modules from "../index";
import { aggregateFamilies } from "./aggregate";
import type { ContentFamily } from "./types";

const descriptors: Readonly<Record<string, ContentFamily>> = modules;

/** Every family in src/families/, combined. The shared registries append
 * these after their legacy entries. */
export const familyRegistry = aggregateFamilies(Object.values(descriptors));

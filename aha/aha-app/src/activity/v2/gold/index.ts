/** The gold set (README §12.1): HAND-AUTHORED v2 activities, never shown as AI output. */
import { g35Gold } from './g35';
import { g35MoreGold } from './g35more';
import { g68Gold } from './g68';
import { k2Gold } from './k2';
import { k2MoreGold } from './k2more';
import type { GoldSpec } from './types';

export type { GoldSpec } from './types';
export const gold: GoldSpec[] = [...k2Gold, ...k2MoreGold, ...g35Gold, ...g35MoreGold, ...g68Gold];

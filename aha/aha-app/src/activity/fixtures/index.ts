/**
 * TEST FIXTURES for development, tests and the visual gallery. Hand-authored by engineers;
 * never shipped as AI output and never labeled as AI-generated.
 */
import type { ActivitySpec } from '../spec';
import { k2Fixtures } from './k2';
import { g35Fixtures } from './g35';
import { g68Fixtures } from './g68';
export const fixtures: ActivitySpec[] = [...k2Fixtures, ...g35Fixtures, ...g68Fixtures];

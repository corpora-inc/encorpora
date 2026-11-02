export const CHROME_VERSION: string;
export const MIN_CHROME_VERSION: string;
export function chromePlatform(): string;
export function chromePath(): string;
export function assertPatchedVersion(version: string): void;
export function secureChromium<T>(
  browserType: T,
  options?: { trustedBuild?: boolean },
): T;

/**
 * Comprehensive platform detection utilities
 * Handles modern devices including iPadOS 13+ that masquerade as desktop
 */

// Helpers: detect platforms with UA-CH (userAgentData) fallback to UA string.
function isChromeOS(): boolean {
    const ua = navigator.userAgent || "";
    // userAgentData is more reliable when available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uaPlatform = (navigator as any).userAgentData?.platform || navigator.platform || "";
    return /CrOS/i.test(ua) || /Chrome\s?OS/i.test(String(uaPlatform));
}

export function isAndroid(): boolean {
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua) && !isChromeOS();
}

/**
 * Detect iOS devices including modern iPads that report as desktop
 * iPadOS 13+ often reports as "Macintosh" to get desktop sites by default
 */
export function isIOS(): boolean {
    const ua = navigator.userAgent || "";

    // Check for explicit iOS identifiers
    if (/iPhone|iPod/i.test(ua)) {
        return true;
    }

    // Legacy iPad detection (pre-iPadOS 13)
    if (/iPad/i.test(ua)) {
        return true;
    }

    // Modern iPad detection (iPadOS 13+)
    // These devices report as "Macintosh" but have touch support
    const platform = navigator.platform || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    // MacIntel + touch = likely iPad masquerading as desktop
    if (/Mac/i.test(platform) && maxTouchPoints > 1) {
        return true;
    }

    // Check for explicit iOS in platform string
    if (/iOS/i.test(platform)) {
        return true;
    }

    return false;
}

/**
 * Detect if running in Safari browser
 */
export function isSafari(): boolean {
    const ua = navigator.userAgent || "";
    // Safari without Chrome/Chromium
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS/i.test(ua);
}

/**
 * Detect macOS (excluding iPads masquerading as Mac)
 */
export function isMacOS(): boolean {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    // Mac platform but NOT touch-enabled (which would be iPad)
    return /Mac/i.test(platform) && maxTouchPoints <= 1 && !/iPhone|iPod|iPad/i.test(ua);
}

/**
 * Detect Windows
 */
export function isWindows(): boolean {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /Win/i.test(platform) || /Windows/i.test(ua);
}

/**
 * Get a canonical platform identifier
 */
export function getPlatform(): "ios" | "android" | "macos" | "windows" | "chromeos" | "other" {
    if (isIOS()) return "ios";
    if (isAndroid()) return "android";
    if (isMacOS()) return "macos";
    if (isWindows()) return "windows";
    if (isChromeOS()) return "chromeos";
    return "other";
}

/**
 * Platform-specific padding utilities
 * Use the robust detection functions above
 */

export function getPlatformBottomPadding(): number {
    // Mobile platforms need more bottom padding for safe area
    if (isIOS() || isAndroid()) {
        return 180;
    }
    return 180;
}

export function getPlatformTopPaddingButtons(): number {
    if (isIOS()) {
        return 35;
    }
    if (isAndroid()) {
        return 30;
    }
    return 10;
}

export function getPlatformTopPaddingTranslations(): number {
    if (isIOS()) {
        return 150;
    }
    if (isAndroid()) {
        return 125;
    }
    return 100;
}
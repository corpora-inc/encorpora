export function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
    return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent);
}

// Helpers: detect platforms with UA-CH (userAgentData) fallback to UA string.
function isChromeOS(): boolean {
    const ua = navigator.userAgent || "";
    // userAgentData is more reliable when available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uaPlatform = (navigator as any).userAgentData?.platform || navigator.platform || "";
    return /CrOS/i.test(ua) || /Chrome\s?OS/i.test(String(uaPlatform));
}

function isAndroidButNotChromeOS(): boolean {
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua) && !isChromeOS();
}

export function getPlatformBottomPadding() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 180;
    } if (isAndroidButNotChromeOS()) {
        return 195;
    }
    return 180;
}

export function getPlatformTopPaddingButtons() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 55;
    } if (isAndroidButNotChromeOS()) {
        return 27;
    }
    return 10;
}

export function getPlatformTopPaddingTranslations() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 150;
    } if (isAndroidButNotChromeOS()) {
        return 125;
    }
    return 100;
}
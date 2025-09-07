export function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
    return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent);
}

export function getPlatformBottomPadding() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 180;
    } if (/Android/i.test(navigator.userAgent)) {
        return 195;
    }
    return 180;
}

export function getPlatformTopPaddingButtons() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 55;
    } if (/Android/i.test(navigator.userAgent)) {
        return 27;
    }
    return 0;
}

export function getPlatformTopPaddingTranslations() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 150;
    } if (/Android/i.test(navigator.userAgent)) {
        return 125;
    }
    return 75;
}
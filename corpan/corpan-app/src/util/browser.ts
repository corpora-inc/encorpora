export function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
    return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent);
}


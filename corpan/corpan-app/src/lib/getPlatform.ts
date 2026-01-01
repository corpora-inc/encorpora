
export const detectPlatform = async (): Promise<"ios" | "android" | "mac" | "windows" | "linux" | "web" | "unknown"> => {
    if (typeof navigator !== "undefined") {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return "android";
        if (/iPad|iPhone|iPod/.test(ua)) return "ios";
        if (/Macintosh/.test(ua)) return "mac";
        if (/Windows/.test(ua)) return "windows";
        if (/Linux/.test(ua)) return "linux";
    }

    return "unknown";
};

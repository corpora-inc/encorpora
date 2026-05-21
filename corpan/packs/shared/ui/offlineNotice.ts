/**
 * Vanilla DOM equivalent of corpan-app/src/components/OfflineNotice.tsx.
 *
 * One consistent calm card for pack-side "this feature needs internet" UX.
 * Themed via the catalog CSS custom properties already used elsewhere in
 * shared/ui (toast, drawer, transport bar) so it inherits whatever pack
 * styling is in effect.
 *
 * Two densities: `default` (full empty-state card) and `compact` (slim
 * inline strip for when you want to keep the surrounding content visible).
 *
 * Also exports `isOnline()` and `onNetworkChange()` so packs don't need a
 * second shared-path alias to react to airplane-mode transitions.
 */

import "./offlineNotice.css";

export function isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
}

export function onNetworkChange(
    cb: (online: boolean) => void,
): () => void {
    if (typeof window === "undefined") return () => { };
    const handleOnline = () => cb(true);
    const handleOffline = () => cb(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
    };
}

export type OfflineNoticeDensity = "default" | "compact";

export type OfflineNoticeOptions = {
    title: string;
    subtitle?: string;
    /** Element to mount as a secondary action (button, link). */
    action?: HTMLElement;
    density?: OfflineNoticeDensity;
};

export type OfflineNotice = {
    element: HTMLElement;
    /** Update the title text in place (e.g. when re-checking connectivity). */
    setTitle: (text: string) => void;
    /** Remove the element from the DOM. */
    remove: () => void;
};

function cloudOffIcon(): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "corpan-offline-notice__icon");
    svg.setAttribute("aria-hidden", "true");

    // lucide cloud-off path (stylized to a slash + cloud silhouette).
    const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
    );
    path.setAttribute(
        "d",
        "M2 2l20 20M5.78 5.78A7 7 0 0 0 9 19h9.5a4.5 4.5 0 0 0 1.78-8.63 7 7 0 0 0-12.55-3.07",
    );
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
}

export function createOfflineNotice(
    opts: OfflineNoticeOptions,
): OfflineNotice {
    const density: OfflineNoticeDensity = opts.density ?? "default";

    const root = document.createElement("div");
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.className = `corpan-offline-notice corpan-offline-notice--${density}`;

    root.appendChild(cloudOffIcon());

    const title = document.createElement("p");
    title.className = "corpan-offline-notice__title";
    title.textContent = opts.title;
    root.appendChild(title);

    if (opts.subtitle && density !== "compact") {
        const sub = document.createElement("p");
        sub.className = "corpan-offline-notice__subtitle";
        sub.textContent = opts.subtitle;
        root.appendChild(sub);
    }

    if (opts.action && density !== "compact") {
        const wrap = document.createElement("div");
        wrap.className = "corpan-offline-notice__action";
        wrap.appendChild(opts.action);
        root.appendChild(wrap);
    }

    return {
        element: root,
        setTitle: (text: string) => {
            title.textContent = text;
        },
        remove: () => {
            root.remove();
        },
    };
}

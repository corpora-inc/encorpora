import { useCallback, useRef } from "react";

/**
 * Custom hook for scroll-based navigation between items.
 * Supports mouse wheel, trackpad, and touch swipe gestures.
 * 
 * @param onPrev - Callback to navigate to previous item
 * @param onNext - Callback to navigate to next item
 * @returns Event handlers for wheel and touch events
 * 
 * @example
 * const { handleWheel, handleTouchStart, handleTouchEnd } = useScrollNavigation(
 *   handlePrev,
 *   handleNext
 * );
 */
export function useScrollNavigation(onPrev: () => void, onNext: () => void) {
    const scrollAccumulatorRef = useRef(0);
    const lastScrollTimeRef = useRef(0);
    const isNavigatingRef = useRef(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const SCROLL_THRESHOLD = 100; // pixels needed to trigger navigation
    const NAVIGATION_COOLDOWN = 500; // ms cooldown between navigations
    const TOUCH_THRESHOLD = 50; // pixels for touch swipe

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            if (isNavigatingRef.current) return;

            const now = Date.now();
            if (now - lastScrollTimeRef.current < NAVIGATION_COOLDOWN) return;

            // Accumulate scroll delta (both vertical and horizontal)
            const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            scrollAccumulatorRef.current += delta;

            // Check if threshold reached
            if (Math.abs(scrollAccumulatorRef.current) >= SCROLL_THRESHOLD) {
                isNavigatingRef.current = true;
                lastScrollTimeRef.current = now;

                if (scrollAccumulatorRef.current > 0) {
                    onNext();
                } else {
                    onPrev();
                }

                scrollAccumulatorRef.current = 0;
                setTimeout(() => {
                    isNavigatingRef.current = false;
                }, NAVIGATION_COOLDOWN);
            }
        },
        [onNext, onPrev]
    );

    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
    }, []);

    const handleTouchEnd = useCallback(
        (e: TouchEvent) => {
            if (!touchStartRef.current || isNavigatingRef.current) return;

            const now = Date.now();
            if (now - lastScrollTimeRef.current < NAVIGATION_COOLDOWN) return;

            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY,
            };

            const deltaX = touchEnd.x - touchStartRef.current.x;
            const deltaY = touchEnd.y - touchStartRef.current.y;

            // Determine if swipe was primarily horizontal or vertical
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
            const delta = isHorizontal ? deltaX : deltaY;

            if (Math.abs(delta) >= TOUCH_THRESHOLD) {
                isNavigatingRef.current = true;
                lastScrollTimeRef.current = now;

                if (delta < 0) {
                    onNext();
                } else {
                    onPrev();
                }

                setTimeout(() => {
                    isNavigatingRef.current = false;
                }, NAVIGATION_COOLDOWN);
            }

            touchStartRef.current = null;
        },
        [onNext, onPrev]
    );

    return { handleWheel, handleTouchStart, handleTouchEnd };
}

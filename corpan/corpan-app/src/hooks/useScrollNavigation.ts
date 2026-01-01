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
    const lastWheelTimeRef = useRef(0);
    const hasNavigatedInGestureRef = useRef(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const SCROLL_THRESHOLD = 100; // pixels needed to trigger navigation
    const GESTURE_TIMEOUT = 50; // ms pause to consider a new gesture
    const TOUCH_THRESHOLD = 50; // pixels for touch swipe
    const EDGE_EPSILON = 1; // tolerated distance from scroll edge

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            const now = Date.now();
            const timeSinceLastWheel = now - lastWheelTimeRef.current;

            // New gesture detected after pause
            if (timeSinceLastWheel > GESTURE_TIMEOUT) {
                hasNavigatedInGestureRef.current = false;
                scrollAccumulatorRef.current = 0;
            }

            lastWheelTimeRef.current = now;

            // Already navigated in this gesture
            if (hasNavigatedInGestureRef.current) return;

            const isVerticalScroll = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
            const delta = isVerticalScroll ? e.deltaY : e.deltaX;

            if (isVerticalScroll) {
                const target = e.currentTarget as HTMLElement | null;
                if (target) {
                    const { scrollTop, scrollHeight, clientHeight } = target;
                    const maxScrollTop = scrollHeight - clientHeight;
                    const isScrollable = scrollHeight > clientHeight + 1;
                    const isScrollingDown = delta > 0;
                    const isScrollingUp = delta < 0;
                    const isAtTop = scrollTop <= EDGE_EPSILON;
                    const isAtBottom = scrollTop >= maxScrollTop - EDGE_EPSILON;

                    if (
                        isScrollable &&
                        ((isScrollingDown && !isAtBottom) || (isScrollingUp && !isAtTop))
                    ) {
                        scrollAccumulatorRef.current = 0;
                        return;
                    }
                }
            }

            scrollAccumulatorRef.current += delta;

            if (Math.abs(scrollAccumulatorRef.current) >= SCROLL_THRESHOLD) {
                hasNavigatedInGestureRef.current = true;

                if (scrollAccumulatorRef.current > 0) {
                    onNext();
                } else {
                    onPrev();
                }

                scrollAccumulatorRef.current = 0;
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
            const start = touchStartRef.current;
            touchStartRef.current = null;

            if (!start) return;

            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY,
            };

            const deltaX = touchEnd.x - start.x;
            const deltaY = touchEnd.y - start.y;

            // Determine if swipe was primarily horizontal or vertical
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
            const delta = isHorizontal ? deltaX : deltaY;

            if (!isHorizontal) {
                const target = e.currentTarget as HTMLElement | null;
                if (target) {
                    const { scrollTop, scrollHeight, clientHeight } = target;
                    const maxScrollTop = scrollHeight - clientHeight;
                    const isScrollable = scrollHeight > clientHeight + 1;
                    const isSwipeUp = delta < 0;
                    const isSwipeDown = delta > 0;
                    const isAtTop = scrollTop <= EDGE_EPSILON;
                    const isAtBottom = scrollTop >= maxScrollTop - EDGE_EPSILON;

                    if (
                        isScrollable &&
                        ((isSwipeUp && !isAtBottom) || (isSwipeDown && !isAtTop))
                    ) {
                        return;
                    }
                }
            }

            if (Math.abs(delta) >= TOUCH_THRESHOLD) {
                if (delta < 0) {
                    onNext();
                } else {
                    onPrev();
                }
            }
        },
        [onNext, onPrev]
    );

    return { handleWheel, handleTouchStart, handleTouchEnd };
}

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

            // Only use horizontal scroll for navigation (ignore vertical)
            const delta = e.deltaX;

            // If there's no horizontal movement, ignore the event
            if (Math.abs(delta) < 1) {
                return;
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

            // Only handle horizontal swipes (ignore vertical)
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

            // If the swipe is not primarily horizontal, ignore it
            if (!isHorizontal) {
                return;
            }

            // Use horizontal delta for navigation
            if (Math.abs(deltaX) >= TOUCH_THRESHOLD) {
                if (deltaX < 0) {
                    // Swipe left = next
                    onNext();
                } else {
                    // Swipe right = previous
                    onPrev();
                }
            }
        },
        [onNext, onPrev]
    );

    return { handleWheel, handleTouchStart, handleTouchEnd };
}

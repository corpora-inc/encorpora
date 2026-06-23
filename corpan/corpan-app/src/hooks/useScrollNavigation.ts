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
 * const { handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd } = useScrollNavigation(
 *   handlePrev,
 *   handleNext
 * );
 */
export function useScrollNavigation(onPrev: () => void, onNext: () => void) {
    const scrollAccumulatorRef = useRef(0);
    const lastWheelTimeRef = useRef(0);
    const hasNavigatedInGestureRef = useRef(false);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const touchHasMultiTouchRef = useRef(false);
    const touchStartedOnInteractiveRef = useRef(false);
    const touchSelectionActiveRef = useRef(false);

    const SCROLL_THRESHOLD = 100; // pixels needed to trigger navigation
    const GESTURE_TIMEOUT = 50; // ms pause to consider a new gesture
    const TOUCH_THRESHOLD = 50; // pixels for touch swipe
    const TOUCH_HORIZONTAL_RATIO = 1.5; // require clearer horizontal intent
    const MAX_SWIPE_DURATION = 450; // ms, avoids long-press selection triggering swipe
    const MIN_SWIPE_VELOCITY = 0.25; // px/ms

    const hasActiveSelection = () => {
        if (typeof window === "undefined") return false;
        const selection = window.getSelection();
        return !!selection && !selection.isCollapsed;
    };

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return !!target.closest(
            "input, textarea, select, button, a, [contenteditable='true'], [contenteditable=''], [role='textbox']"
        );
    };

    const resetTouchState = () => {
        touchStartRef.current = null;
        touchHasMultiTouchRef.current = false;
        touchStartedOnInteractiveRef.current = false;
        touchSelectionActiveRef.current = false;
    };

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            if (e.ctrlKey) {
                return;
            }

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
        resetTouchState();

        if (e.touches.length !== 1) {
            touchHasMultiTouchRef.current = true;
            return;
        }

        touchStartedOnInteractiveRef.current = isInteractiveTarget(e.target);
        touchSelectionActiveRef.current = hasActiveSelection();

        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length > 1) {
            touchHasMultiTouchRef.current = true;
        }

        if (hasActiveSelection()) {
            touchSelectionActiveRef.current = true;
        }
    }, []);

    const handleTouchEnd = useCallback(
        (e: TouchEvent) => {
            const start = touchStartRef.current;
            if (!start) {
                resetTouchState();
                return;
            }

            if (
                touchHasMultiTouchRef.current ||
                touchStartedOnInteractiveRef.current ||
                touchSelectionActiveRef.current ||
                hasActiveSelection()
            ) {
                resetTouchState();
                return;
            }

            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY,
            };

            const deltaX = touchEnd.x - start.x;
            const deltaY = touchEnd.y - start.y;
            const duration = Date.now() - start.time;

            if (duration > MAX_SWIPE_DURATION) {
                resetTouchState();
                return;
            }

            // Only handle horizontal swipes (ignore vertical)
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * TOUCH_HORIZONTAL_RATIO;

            // If the swipe is not primarily horizontal, ignore it
            if (!isHorizontal) {
                resetTouchState();
                return;
            }

            // Use horizontal delta for navigation
            const distance = Math.abs(deltaX);
            const velocity = distance / Math.max(duration, 1);
            if (distance >= TOUCH_THRESHOLD && velocity >= MIN_SWIPE_VELOCITY) {
                if (deltaX < 0) {
                    // Swipe left = next
                    onNext();
                } else {
                    // Swipe right = previous
                    onPrev();
                }
            }

            resetTouchState();
        },
        [onNext, onPrev]
    );

    const handleTouchCancel = useCallback(() => {
        resetTouchState();
    }, []);

    return { handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel };
}

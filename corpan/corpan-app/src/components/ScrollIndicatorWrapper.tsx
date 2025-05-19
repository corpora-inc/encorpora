import { useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// Reusable wrapper: place this around your scrolling area
export function ScrollIndicatorWrapper({ children, className = "" }: {
    children: React.ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [atTop, setAtTop] = useState(true);
    const [atBottom, setAtBottom] = useState(false);

    // Update on scroll and on mount/content change
    const update = () => {
        const node = ref.current;
        if (!node) return;
        setAtTop(node.scrollTop <= 0);
        setAtBottom(node.scrollTop + node.clientHeight >= node.scrollHeight - 2);
    };

    useEffect(() => {
        update(); // On mount
        const node = ref.current;
        if (!node) return;
        node.addEventListener("scroll", update);
        // Also re-check if size/content changes
        window.addEventListener("resize", update);
        return () => {
            node.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, []);

    return (
        <div className="relative w-full h-full flex-1">
            {/* Top fade/arrow */}
            {!atTop && (
                <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-10">
                    <div className="h-10 w-full flex items-center justify-center">
                        <ChevronUp
                            size={64}
                            className="text-gray-300" style={{ opacity: 0.8 }} />
                    </div>
                </div>
            )}
            {/* Bottom fade/arrow */}
            {!atBottom && (
                <div className="absolute bottom-0 left-0 w-full flex justify-center pointer-events-none z-10">
                    <div className="h-10 w-full flex items-center justify-center">
                        <ChevronDown size={64}
                            className="text-gray-300" style={{ opacity: 0.8 }} />
                    </div>
                </div>
            )}
            <div
                ref={ref}
                className={`overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent w-full h-full ${className}`}
                style={{ minHeight: 0, maxHeight: "100%" }}
            >
                {children}
            </div>
        </div>
    );
}

import { useRef, useState, useEffect, forwardRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export const ScrollIndicatorWrapper = forwardRef<HTMLDivElement, {
    children: React.ReactNode;
    className?: string;
}>(({ children, className = "" }, refOuter) => {
    const innerRef = useRef<HTMLDivElement>(null);
    // Use the outer ref if provided, else fallback to innerRef
    const ref = (refOuter && typeof refOuter !== "function" ? refOuter : innerRef) as React.RefObject<HTMLDivElement>;
    const [atTop, setAtTop] = useState(true);
    const [atBottom, setAtBottom] = useState(false);

    const update = () => {
        const node = ref.current;
        if (!node) return;
        setAtTop(node.scrollTop <= 0);
        setAtBottom(node.scrollTop + node.clientHeight >= node.scrollHeight - 50);
    };

    useEffect(() => {
        update();
        const node = ref.current;
        if (!node) return;
        node.addEventListener("scroll", update);
        window.addEventListener("resize", update);
        return () => {
            node.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [ref]);

    useEffect(() => {
        const node = ref.current;
        if (node) {
            setTimeout(() => {
                node.scrollTo({ top: -300, behavior: "smooth" });
            }, 30);
        }
    }, [ref]);

    return (
        <div className="relative flex-1 min-h-0 w-full h-full">
            {!atTop && (
                <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-10">
                    <div className="h-10 w-full flex items-center justify-center">
                        <ChevronUp size={48} className="text-gray-300" style={{ opacity: 0.8 }} />
                    </div>
                </div>
            )}
            {!atBottom && (
                <div className="absolute bottom-0 left-0 w-full flex justify-center pointer-events-none z-10">
                    <div className="h-10 w-full flex items-center justify-center">
                        <ChevronDown size={48} className="text-gray-300" style={{ opacity: 0.8 }} />
                    </div>
                </div>
            )}
            <div
                ref={ref}
                className={`overflow-y-auto flex-1 min-h-0 w-full h-full ${className}`}
                style={{ maxHeight: "100%" }}
            >
                {children}
            </div>
        </div>
    );
});
ScrollIndicatorWrapper.displayName = "ScrollIndicatorWrapper";

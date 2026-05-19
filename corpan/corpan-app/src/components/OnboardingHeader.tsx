import { memo, useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "./ui/button";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { useSettingsStore } from "@/store/settings";

export const STEPS = [
    { key: "learning", label: "Learning languages" },
    { key: "packs", label: "Phrase packs" },
    { key: "tts", label: "TTS setup" },
    { key: "socials", label: "Follow & connect" },
] as const;

export const OnboardingHeader = memo(function OnboaringHeader({
    title,
    steps,
    currentIndex,
    onBack,
    onNext,
    canNext,
    children,
}: {
    title: string;
    steps: string[];
    currentIndex: number;
    onBack: () => void;
    onNext: () => void;
    canNext: boolean;
    children?: ReactNode;
}) {
    const dir = useSettingsStore((s) => s.dir);
    const headerRef = useRef<HTMLElement | null>(null);
    // const dir = useSettingsStore((s) => s.dir);

    useLayoutEffect(() => {
        const el = headerRef.current;
        const scrollEl =
            (document.getElementById("onboarding-scroll") as HTMLElement | null) ||
            document.documentElement;
        if (!el || !scrollEl) return;

        const apply = () =>
            scrollEl.style.setProperty("--onb-header-h", `${el.offsetHeight}px`);
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <header
            ref={headerRef}
            // Header bg matches the section bg (bg-background → md:bg-muted) so
            // the page color flows seamlessly up under the nav. Translucent
            // with backdrop-blur so content scrolling underneath stays
            // readable but feels recessed.
            className="sticky top-0 z-500 isolate bg-background/80 md:bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 supports-[backdrop-filter]:md:bg-muted/60"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
            {/* Top row — grows on md+ to give iPad/desktop more breathing space.
                Vertical padding also scales up so the buttons + title get more
                room from the safe-area inset above. */}
            <div className="relative mx-auto w-full max-w-xl md:max-w-3xl px-4 md:px-6 py-4 md:py-6">
                <div className="flex items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-3 md:h-12 md:px-4"
                        onClick={onBack}
                        aria-label="Back"
                    >
                        {dir() === "rtl" ? <ArrowRightCircle className="size-5 md:size-6" /> :
                            <ArrowLeftCircle className="size-5 md:size-6" />}
                    </Button>

                    <Button
                        type="button"
                        onClick={onNext}
                        disabled={!canNext}
                        className="h-10 px-3 md:h-12 md:px-4 border border-purple-400 bg-black text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted"
                        aria-label="Next"
                        aria-disabled={!canNext}
                    >
                        {dir() === "rtl" ? <ArrowLeftCircle className="size-5 md:size-6" /> :
                            <ArrowRightCircle className="size-5 md:size-6" />}
                    </Button>
                </div>

                {/* Centered title + stepper. Title container grows on md+ so
                    longer titles get more horizontal room before the larger
                    side buttons. */}
                <div className="pointer-events-none absolute left-4 right-4 md:left-6 md:right-6 top-1/2 -translate-y-1/2">
                    <div className="mx-auto max-w-md md:max-w-xl px-15 md:px-20">
                        <div className="truncate text-center text-sm md:text-base font-semibold text-foreground">
                            {title}
                        </div>
                        <Stepper steps={steps} currentIndex={currentIndex} />
                    </div>
                </div>
            </div>

            {/* Actions slot: transparent so the parent's blur shows through */}
            {children && (
                <div className="border-white/40 bg-transparent">
                    <div className="mx-auto w-full max-w-5xl px-3 py-2">{children}</div>
                </div>
            )}
        </header>
    );
});

const Stepper = memo(function Stepper({
    steps,
    currentIndex,
}: {
    steps: string[];
    currentIndex: number;
}) {
    return (
        <div className="mt-2 md:mt-3 w-full">
            <ol
                role="list"
                aria-label="Onboarding steps"
                className="grid w-full gap-1 md:gap-1.5"
                style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
                {steps.map((label, i) => {
                    const done = i < currentIndex;
                    const active = i === currentIndex;
                    return (
                        <li key={i} className="relative">
                            <span
                                aria-current={active ? "step" : undefined}
                                aria-label={label}
                                className={[
                                    "block h-1.5 md:h-2 rounded-full",
                                    done ? "bg-purple-500" : active ? "bg-purple-400" : "bg-muted",
                                ].join(" ")}
                            />
                        </li>
                    );
                })}
            </ol>
        </div>
    );
});

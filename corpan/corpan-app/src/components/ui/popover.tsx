// src/components/ui/popover.tsx
"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

type PopoverContentProps = React.ComponentPropsWithoutRef<
    typeof PopoverPrimitive.Content
> & {
    containerId?: string; // id of the dialog content to collide against
};

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    PopoverContentProps
>(
    (
        {
            className,
            side = "bottom",
            align = "center",
            sideOffset = 8,
            containerId,
            ...props
        },
        ref
    ) => {
        const container =
            typeof document !== "undefined" && containerId
                ? (document.getElementById(containerId) as HTMLElement | null) ??
                undefined
                : undefined;

        return (
            <PopoverPrimitive.Portal container={container}>
                <PopoverPrimitive.Content
                    ref={ref}
                    side={side}
                    align={align}
                    sideOffset={sideOffset}
                    // keep it within the modal content horizontally
                    avoidCollisions
                    collisionPadding={8}
                    collisionBoundary={container}
                    sticky="partial"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    className={cn(
                        "z-[1002] rounded-md border bg-white p-3 text-gray-900 shadow-md outline-none",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
                        "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
                        // clamp width so it never needs to overflow to fit
                        "max-w-[92vw]",
                        className
                    )}
                    {...props}
                />
            </PopoverPrimitive.Portal>
        );
    }
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };

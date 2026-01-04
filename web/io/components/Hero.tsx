// app/components/Hero.tsx
"use client";

import { FC } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FaApple, FaGooglePlay, FaBookOpen } from "react-icons/fa";

export const Hero: FC = () => (
    <motion.section
        className="min-h-screen bg-white flex items-center justify-center px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
    >
        <div className="w-full max-w-3xl flex flex-col items-center text-center">
            {/* Headline */}
            <motion.h1
                className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
            >
                Pure Learning
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
                className="mt-5 text-2xl text-gray-600"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
            >
                Focused books and apps.
            </motion.p>

            {/* CTAs */}
            <div className="mt-6 w-full flex flex-col sm:flex-row sm:justify-center gap-4">
                <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2 w-full sm:w-48 justify-center"
                >
                    <Link
                        href="https://apps.apple.com/us/developer/corpora-inc/id1808739895"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaApple size={18} />
                        iOS Apps
                    </Link>
                </Button>

                <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2 w-full sm:w-48 justify-center"
                >
                    <Link
                        href="https://play.google.com/store/apps/developer?id=Corpora+Inc"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaGooglePlay size={18} />
                        Android Apps
                    </Link>
                </Button>

                <Button
                    asChild
                    size="lg"
                    className="flex items-center gap-2 w-full sm:w-48 justify-center"
                >
                    <Link href="https://shop.encorpora.io">
                        <FaBookOpen size={18} />
                        Browse Books
                    </Link>
                </Button>
            </div>
            {/* Trust line */}
            <motion.p
                className="mt-4 text-sm text-gray-500"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
            >
                No ads. No trackers. No wasted time.
            </motion.p>
        </div>
    </motion.section>
);

"use client";

import { FC } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FaYoutube } from "react-icons/fa";

const YouTubeSection: FC = () => (
  <section className="py-20 px-4 bg-gray-50 relative overflow-hidden">
    <div className="max-w-4xl mx-auto relative z-10">
      <div className="text-center mb-10">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
          Original Media
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          AI-generated music videos, experimental cinematography, and a taste of
          the multimedia tools we&apos;re building.
        </p>
      </div>

      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-black">
          <iframe
            src="https://www.youtube.com/embed/Bjj2T6jiO5o"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="w-full h-full"
          />
        </div>
      </motion.div>

      <div className="text-center mt-10">
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link
            href="https://www.youtube.com/@corp%C3%A1n1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaYoutube size={20} />
            Subscribe on YouTube
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

export default YouTubeSection;

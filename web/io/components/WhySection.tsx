// app/components/WhySection.tsx
"use client";
import { FC } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaBolt, FaTachometerAlt, FaHeart } from "react-icons/fa";

const OFFERS = [
  {
    icon: <FaTachometerAlt className="text-3xl text-black" />,
    title: "Speed",
    description: "Finish lessons, chapters, or drills in record time - without sacrificing depth or clarity.",
    href: "https://github.com/orgs/corpora-inc/repositories",
    cta: "Explore",
  },
  {
    icon: <FaBolt className="text-3xl text-black" />,
    title: "Focus",
    description: "No clutter, no distractions, no cognitive overhead. Every detail engineered for pure, productive learning.",
    href: "/#apps",
    cta: "Explore",
  },
  {
    icon: <FaHeart className="text-3xl text-black" />,
    title: "Respect",
    description: "No ads. No tracking. No surveillance. We value your trust - and your time - above all.",
    href: "/privacy",
    cta: "Learn More",
  },
];

const WhySection: FC = () => (
  <section className="mt-24 bg-white relative overflow-hidden">
    {/* Background gradient circles */}
    {/* <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#f9f9f9] rounded-full -mb-48 -mr-48" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#f9f9f9] rounded-full -mb-48 -ml-48" />
    </div> */}

    <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 relative z-10">
      <div className="text-center mb-14">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
          Why Corpora?
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Built for speed. Designed for focus. Grounded in respect.<br />
          That&apos;s why learners choose Corpora.
        </p>
      </div>

      <motion.div
        className="
          grid grid-cols-1
          md:grid-cols-3
          gap-4 md:gap-x-8 md:gap-y-6
        "
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {OFFERS.map(({ icon, title, description, href, cta }) => (
          <Link
            key={title}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className={`
              group flex flex-col justify-between
              bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 rounded-2xl
              px-6 py-8 text-center cursor-pointer shadow-sm
              focus:outline-none focus-visible:ring-2 focus-visible:ring-black
              w-full max-w-md mx-auto
            `}
            style={{ textDecoration: "none" }}
          >
            <div>
              <span className="mb-6 flex items-center justify-center w-14 h-14 bg-white border border-gray-200 rounded-full transition group-hover:shadow-md mx-auto">
                {icon}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600 leading-relaxed">{description}</p>
            </div>
            <div className="mt-8 flex justify-center items-end">
              <span
                className="block text-sm font-semibold text-gray-500 group-hover:text-black transition"
              >
                {cta} <span className="ml-2 align-middle">&#8594;</span>
              </span>
            </div>
          </Link>
        ))}
      </motion.div>
    </div>

    {/* Gradient bar and "Corpora" label at the bottom */}
    <div className="relative mt-24">

      <motion.div
        className="h-px w-24 bg-gradient-to-r from-transparent via-black to-
transparent mx-auto"
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 0.2 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-black mx-auto -mt-1 opacity-20"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 0.2 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.8 }}
      />
      <motion.div
        className="text-xs text-gray-400 text-center mt-6 tracking-widest uppercase"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        Corpora
      </motion.div>
    </div>
  </section>
);

export default WhySection;

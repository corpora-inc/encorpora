// app/components/Features.tsx
"use client";
import { FC } from "react";
import { FaBookOpen, FaGithub, FaLock, FaPlug, FaCloud, FaCheckCircle } from "react-icons/fa";
import Link from "next/link";
import { motion } from "framer-motion";

const FEATURES = [
  {
    icon: <FaCheckCircle className="text-black text-2xl mb-3" />,
    title: "True Ownership",
    description: (
      <>
        Buy a book or app once - it&apos;s yours for life, with free updates. No subscriptions, no lock-in, no DRM.
      </>
    ),
  },
  {
    icon: <FaLock className="text-black text-2xl mb-3" />,
    title: "Real Privacy, No Ads",
    description: (
      <>
        No ads. No tracking. No surveillance. Most apps require zero permissions and work entirely offline. Read our{" "}
        <Link href="/privacy" className="underline text-gray-500 hover:text-black">
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    icon: <FaCloud className="text-black text-2xl mb-3" />,
    title: "Offline-First",
    description: "Use all our apps and books anywhere - even with no connection. We only require network access when absolutely necessary.",
  },
  {
    icon: <FaPlug className="text-black text-2xl mb-3" />,
    title: "Minimal Permissions",
    description: "We request the bare minimum - most apps need no special access at all. Your data always stays on your device.",
  },
  {
    icon: <FaGithub className="text-black text-2xl mb-3" />,
    title: "Open Source Everything",
    description: (
      <>
        All our code and pipelines are public and open. Build, fork, or contribute on{" "}
        <Link href="https://github.com/orgs/corpora-inc/repositories" target="_blank" className="underline text-gray-500 hover:text-black">
          GitHub
        </Link>
        .
      </>
    ),
  },
  {
    icon: <FaBookOpen className="text-black text-2xl mb-3" />,
    title: "Community & Transparency",
    description: (
      <>
        Every change is public. Improvements are driven by real user feedback.<br />
        <span className="text-gray-500">Contact: </span>
        <Link href="mailto:hello@encorpora.io" className="underline text-gray-500 hover:text-black">
          hello@encorpora.io
        </Link>
      </>
    ),
  },
];

const Features: FC = () => (
  <section id="features" className="py-20 px-4 bg-white relative overflow-hidden">
    <div className="max-w-5xl xl:max-w-6xl mx-auto relative z-10">
      <div className="text-center mb-14">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
          Open, Honest, and Built to Last
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Buy it once, own it for life - no subscriptions, no ads, and no tricks. Offline-first. Open source. Built for real trust and real results.
        </p>
      </div>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {FEATURES.map(({ icon, title, description }) => (
          <div
            key={title}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-7 py-8 text-center shadow-sm flex flex-col items-center"
          >
            {icon}
            <h3 className="text-lg font-bold mb-2 text-gray-900">{title}</h3>
            <div className="text-gray-600 text-base">{description}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default Features;

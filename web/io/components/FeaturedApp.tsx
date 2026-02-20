"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { APPS_INFO } from "@/lib/appsInfo";
import { withBasePath } from "@/lib/basePath";

const PACKS = [
  {
    id: "hover-runner",
    name: "Hover Runner",
    description: "3D fun in Hover Runner: lock in correct translations with the All-Hearing Ear and avoid wrong ones.",
    avatar: "/logos/hover-runner-avatar.png",
    landingUrl: "/corpan/packs/hover-runner/",
    status: "live",
  },
  {
    id: "hanzipan",
    name: "Hanzipan",
    description: "A premium Mandarin character studio with stroke guidance, feedback, and infinite contextual examples.",
    avatar: "/logos/hanzipan-avatar.png",
    landingUrl: "/corpan/packs/hanzipan/",
    status: "live",
  },
  {
    id: "juice-squeeze",
    name: "Juice Squeeze",
    description: "Fast-paced phrase building with splashy juice rewards and native audio feedback.",
    avatar: "/logos/juice-squeeze-avatar.svg",
    landingUrl: "/corpan/packs/juice-squeeze/",
    status: "prototype",
  },
];

const FeaturedApps = () => {
  return (
    <section
      id="apps"
      className="mt-2 sm:mt-6 px-2 sm:px-6 lg:px-8 bg-white relative overflow-hidden"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="block h-px w-16 bg-gradient-to-r from-transparent via-black to-transparent mx-auto mt-6 mb-24 opacity-30" />
          <motion.h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Our Apps
          </motion.h2>
          <motion.p
            className="text-gray-600 max-w-2xl mx-auto text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Offline-first tools designed to eliminate distractions and respect
            your time.
          </motion.p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {APPS_INFO.filter((app) => app.featured).map((app, index) => {
            const iconSrc = app.icon ? withBasePath(app.icon) : "";

            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative z-10"
              >
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-black opacity-5"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-black opacity-5"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-black opacity-5"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-black opacity-5"></div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {iconSrc ? (
                        <img
                          src={iconSrc}
                          alt={`${app.title} icon`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <span className="text-xl font-bold text-gray-800">
                            {app.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{app.title}</h3>
                      {app.landingUrl && (
                        <Link
                          href={withBasePath(app.landingUrl)}
                          className="text-sm text-gray-500 hover:text-black transition-colors"
                        >
                          Learn more &rarr;
                        </Link>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    {app.description}
                  </p>

                  {app.platforms.length === 0 ? (
                    <Button
                      disabled
                      className="w-full bg-gray-200 text-gray-500 font-medium rounded-lg cursor-not-allowed"
                    >
                      iOS Coming Soon
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full bg-black hover:bg-gray-800 text-white font-medium rounded-lg">
                          <Download className="h-4 w-4 mr-2" />
                          <span>Install</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="!w-full min-w-[200px] bg-white border border-gray-100 shadow-lg rounded-lg">
                        {app.platforms.map((platform, idx) => {
                          const platformHref = withBasePath(platform.link);
                          const isInternal = platformHref.startsWith("/");

                          return (
                            <DropdownMenuItem
                              key={idx}
                              asChild
                              className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                            >
                              <a
                                href={platformHref}
                                target={isInternal ? "_self" : "_blank"}
                                rel={
                                  isInternal
                                    ? undefined
                                    : "noopener noreferrer"
                                }
                                className="flex items-center gap-3 w-full"
                              >
                                <div className="w-5 h-5 flex items-center justify-center">
                                  {platform.icon}
                                </div>
                                <span className="font-medium">
                                  {platform.name}
                                </span>
                              </a>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Corpan Packs */}
        <div className="mt-20 text-center">
          <motion.h3
            className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Corpan Packs
          </motion.h3>
          <motion.p
            className="text-gray-600 max-w-xl mx-auto text-base mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Interactive experiences that run inside Corpan.
          </motion.p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {PACKS.map((pack, index) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                    <img
                      src={withBasePath(pack.avatar)}
                      alt={`${pack.name} avatar`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{pack.name}</h4>
                    {pack.status === "prototype" && (
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                        Prototype
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                  {pack.description}
                </p>
                <Link href={withBasePath(pack.landingUrl)}>
                  <Button
                    variant="outline"
                    className="w-full font-medium rounded-lg"
                  >
                    Try it &rarr;
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="h-px w-24 bg-gradient-to-r from-transparent via-black to-transparent mx-auto mt-16 opacity-20"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 0.2 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      </div>
    </section>
  );
};

export default FeaturedApps;

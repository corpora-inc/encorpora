"use client";
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

const FeaturedApps = () => {
  return (
    <section
      id="apps"
      className="mt-2 sm:mt-6 px-2 sm:px-6 lg:px-8 bg-white relative overflow-hidden"
    >

      {/* <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#f9f9f9] rounded-full -mt-32 -mr-32" />
        <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#f9f9f9] rounded-full -mb-48 -ml-48" />
      </div> */}
      {/* One subtle background accent for depth */}
      {/* <div className="absolute right-1/3 w-[60vw] h-[60vw] max-w-3xl max-h-3xl bg-[#f9f9f9] rounded-full opacity-40 pointer-events-none z-0"></div> */}

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
            Educational Apps
          </motion.h2>
          <motion.p
            className="text-gray-600 max-w-2xl mx-auto text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Offline-first learning applications designed to eliminate distractions and help you focus on what matters most.
          </motion.p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {APPS_INFO.map((app, index) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative z-10"
            >
              {/* Card corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-black opacity-5"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-black opacity-5"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-black opacity-5"></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-black opacity-5"></div>

              <div className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                    {app.icon ? (
                      <img
                        src={app.icon}
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
                  <h3 className="text-xl font-bold">{app.title}</h3>
                </div>

                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  {app.description}
                </p>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full bg-black hover:bg-gray-800 text-white font-medium rounded-lg">
                      <Download className="h-4 w-4 mr-2" />
                      <span>Download</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="!w-full min-w-[200px] bg-white border border-gray-100 shadow-lg rounded-lg">
                    {app.platforms.map((platform, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        asChild
                        className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <a
                          href={platform.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 w-full"
                        >
                          <div className="w-5 h-5 flex items-center justify-center">
                            {platform.icon}
                          </div>
                          <span className="font-medium">{platform.name}</span>
                        </a>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Simple bar accent for section finish */}
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

import { FC } from "react";
import Link from "next/link";
import {
  FaEnvelope,
  FaGithub,
  FaPhone,
  FaYoutube,
} from "react-icons/fa";
import { SiGitconnected } from "react-icons/si";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { withBasePath } from "@/lib/basePath";

interface FooterLink {
  label: string;
  href: string;
  internal?: boolean;
}

const Footer: FC = () => {
  const logoSrc = withBasePath("/logo-og.webp");
  const quickLinks: FooterLink[] = [
    { label: "Books", href: "/books", internal: true },
    { label: "Corpán", href: "/corpan/", internal: true },
    { label: "GitHub", href: "https://github.com/corpora-inc" },
    { label: "YouTube", href: "https://www.youtube.com/@corp%C3%A1n1" },
    { label: "Blog", href: "https://free2z.cash/corpora" },
  ];

  const socialLinks = [
    {
      icon: <FaGithub />,
      href: "https://github.com/corpora-inc",
      label: "GitHub",
    },
    {
      icon: <FaYoutube />,
      href: "https://www.youtube.com/@corp%C3%A1n1",
      label: "YouTube",
    },
    {
      icon: <SiGitconnected />,
      href: "https://free2z.cash/corpora",
      label: "Free2z",
    },
  ];

  return (
    <footer className="pt-16 pb-8 px-6 md:px-12 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full border border-gray-100"></div>
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full border border-gray-100"></div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">
          {/* Brand column */}
          <div className="md:col-span-4">
            <div className="flex items-center space-x-2 mb-4">
              <Avatar className="rounded-lg">
                <AvatarImage src={logoSrc} alt="Corpora logo" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <span className="text-xl font-bold tracking-wider">
                Corpora Inc
              </span>
            </div>

            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              Transforming education through innovative learning resources and
              personalized experiences.
            </p>

            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-black hover:text-white hover:border-black transition-colors duration-300"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="md:col-span-3 md:col-start-7">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  {link.internal ? (
                    <Link
                      href={link.href}
                      className="text-gray-600 hover:text-black transition-colors duration-300 text-sm inline-block relative group"
                    >
                      <span className="inline-block transition-transform duration-300">
                        {link.label}
                      </span>
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-black group-hover:w-full transition-all duration-300"></span>
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-black transition-colors duration-300 text-sm inline-block relative group"
                    >
                      <span className="inline-block transition-transform duration-300">
                        {link.label}
                      </span>
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-black group-hover:w-full transition-all duration-300"></span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3 md:col-start-10">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">
              Contact
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FaEnvelope className="text-black" />
                <a
                  href="mailto:team@encorpora.io"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  team@encorpora.io
                </a>
              </div>
              <div className="flex items-center gap-3">
                <FaPhone className="text-black" />
                <a
                  href="tel:+17703765331"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  770-376-5331
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-500 text-xs mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Corpora Inc • All Rights Reserved
          </div>

          <div className="flex items-center">
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>

            <Link
              href="/privacy"
              className="text-xs text-gray-500 hover:text-black transition-colors duration-300 mx-3"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

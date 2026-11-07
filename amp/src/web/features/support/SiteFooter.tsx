import type { ReactNode } from "react";
import { ContactAddress } from "./ContactAddress";
import styles from "./Contact.module.css";

const icon = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    {paths}
  </svg>
);
/** Where AMP is, besides here. One color each, so the row reads as one line. */
const socials = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/adaptivemathpathways/",
    icon: icon(
      <>
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r="4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" />
      </>,
    ),
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@corporainc",
    icon: icon(
      <path
        fill="currentColor"
        d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.2 3.1L10 15.1Z"
      />,
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@adaptivemathpathways",
    icon: icon(
      <path
        fill="currentColor"
        d="M16.6 2.5c.4 2.3 1.9 3.8 4.2 4v3.3a7.6 7.6 0 0 1-4.1-1.3v6.6a6 6 0 1 1-6-6c.3 0 .6 0 .9.1v3.4a2.6 2.6 0 1 0 1.8 2.5V2.5h3.2Z"
      />,
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/1380767481789516",
    icon: icon(
      <path
        fill="currentColor"
        d="M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.3-1.5 1.6-1.5h1.6V4a22 22 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.3H7.6v3.2h2.7v8h3.2Z"
      />,
    ),
  },
  {
    name: "X",
    href: "https://x.com/corporainc",
    icon: icon(
      <path
        fill="currentColor"
        d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"
      />,
    ),
  },
] as const;

/** The public pages' footer: the address to copy, AMP's other places, and the
 * page's own links. Each frame places it on its own content width. */
export function SiteFooter({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <footer className={`${styles.footer} ${className}`}>
      <div className={styles.footerTop}>
        <ContactAddress />
        <ul className={styles.socials} aria-label="AMP elsewhere">
          {socials.map((social) => (
            <li key={social.name}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`AMP on ${social.name}`}
                title={social.name}
              >
                {social.icon}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <nav className={styles.footerLinks} aria-label="More">
        {children}
      </nav>
    </footer>
  );
}

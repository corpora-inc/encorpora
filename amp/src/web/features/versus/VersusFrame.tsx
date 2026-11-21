import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { brand } from "../../../brand";
import { RootLink } from "../../nav/root";
import { BrandMark } from "../../ui/BrandMark";
import { buttonClass } from "../../ui/Button";
import { SiteFooter } from "../support/SiteFooter";
// The homepage's frame: its width, header, brand and footer, so `/`,
// `/research` and the comparisons sit on the same lines.
import frame from "../pitch/Pitch.module.css";
// The research page's topics: a rule, the heading in the copy column, the
// body beside it.
import topics from "../research/Research.module.css";
import styles from "./Versus.module.css";

/** The comparisons' frame: the homepage's header and footer around a page
 * of topics. `beside` is the header's one other place. */
export function VersusFrame({
  beside,
  children,
}: {
  beside: { to: "/versus" | "/schools"; label: string };
  children: ReactNode;
}) {
  return (
    <div className={frame.page} data-versus="">
      <header className={frame.header}>
        <RootLink
          className={frame.brand}
          aria-label={`${brand.name} ${brand.expansion}, home`}
        >
          <BrandMark beside="long" />
        </RootLink>
        <Link to={beside.to} className={buttonClass("quiet", frame.signIn)}>
          {beside.label}
        </Link>
      </header>
      <main className={`${frame.main} ${topics.main} ${styles.main}`}>
        {children}
      </main>
      <SiteFooter className={frame.footer}>
        <Link to="/schools">For schools</Link>
        <Link to="/research">Research</Link>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </SiteFooter>
    </div>
  );
}

/** A topic: its heading and its body, on the research page's layout. */
export function Topic({
  id,
  heading,
  children,
}: {
  id: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={topics.topic} aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      <div className={topics.topicBody}>{children}</div>
    </section>
  );
}

/** The page's structured data, in the head while the page shows. The
 * static document carries the same data (scripts/build-public-documents.ts);
 * this takes its place, so a page reached inside the app never keeps the
 * last page's. */
export function useStructuredData(data: readonly object[]) {
  useEffect(() => {
    document.head
      .querySelectorAll("script[data-versus-data]")
      .forEach((script) => script.remove());
    const added = data.map((entry) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-versus-data", "");
      script.textContent = JSON.stringify(entry);
      document.head.append(script);
      return script;
    });
    return () => added.forEach((script) => script.remove());
  }, [data]);
}

import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { brand } from "../../../brand";
import { applyRouteHead, type RouteHead } from "../../app/route-head";
import { trackGooglePage } from "../../lib/analytics";
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
import { versusHubLink } from "./links";
import styles from "./Versus.module.css";

/** The comparisons' frame: the homepage's header and footer around a page
 * of topics. `beside` is the header's one other place: the hub from a
 * comparison, the school pages from the hub (as on `/research`). */
export function VersusFrame({
  beside,
  children,
}: {
  beside: "hub" | "schools";
  children: ReactNode;
}) {
  const quiet = buttonClass("quiet", frame.signIn);
  return (
    <div className={frame.page} data-versus="">
      <header className={frame.header}>
        <RootLink
          className={frame.brand}
          aria-label={`${brand.name} ${brand.expansion}, home`}
        >
          <BrandMark beside="long" />
        </RootLink>
        {beside === "hub" ? (
          <Link {...versusHubLink} className={quiet}>
            Compare
          </Link>
        ) : (
          <Link to="/schools" className={quiet}>
            Schools
          </Link>
        )}
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

/** A comparison page's head, written when the page shows: its title,
 * description and address (the app's route head leaves the comparisons
 * alone), and its structured data. The static document carries the same
 * (scripts/build-public-documents.ts); this takes its place, so a page
 * reached inside the app never keeps the last page's. GA measures the page
 * here, with the title just written (analytics/page-titles.ts
 * `selfTitledPath`). */
export function usePageHead(head: RouteHead, data: readonly object[]) {
  useEffect(() => {
    applyRouteHead(document, head);
    trackGooglePage(head.title);
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
  }, [head, data]);
}

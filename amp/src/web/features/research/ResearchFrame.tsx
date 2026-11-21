import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { brand } from "../../../brand";
import { buttonClass } from "../../ui/Button";
import { BrandMark } from "../../ui/BrandMark";
import { RootLink } from "../../nav/root";
import { SiteFooter } from "../support/SiteFooter";
// The homepage's frame: its width, header, brand and footer, so `/` and the
// research pages sit on the same lines.
import frame from "../pitch/Pitch.module.css";
import styles from "./Research.module.css";

/** The research pages' frame: the homepage's header, width and footer around
 * the page's own sections. */
export function ResearchFrame({ children }: { children: ReactNode }) {
  return (
    <div className={frame.page} data-research="">
      <header className={frame.header}>
        <RootLink
          className={frame.brand}
          aria-label={`${brand.name} ${brand.expansion}, home`}
        >
          <BrandMark beside="long" />
        </RootLink>
        <Link to="/schools" className={buttonClass("quiet", frame.signIn)}>
          Schools
        </Link>
      </header>
      <main className={`${frame.main} ${styles.main}`}>{children}</main>
      <SiteFooter className={frame.footer}>
        <Link to="/schools">For schools</Link>
        <Link to="/schools/trust">Student data</Link>
        <Link to="/versus/{-$slug}" params={{ slug: undefined }}>
          Compare
        </Link>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </SiteFooter>
    </div>
  );
}

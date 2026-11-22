import { Link } from "@tanstack/react-router";
import { researchPage } from "../../../research/report";
import { versusHub } from "../../../versus/amp";
import { versusGroups } from "../../../versus/catalog";
import { versusHubHead, versusHubJsonLd } from "../../../versus/head";
import { versusCatalog } from "../../../versus/pages";
import { Topic, usePageHead, VersusFrame } from "./VersusFrame";
import { VERSUS } from "./links";
import styles from "./Versus.module.css";

const groups = versusGroups(versusCatalog);
const data = versusHubJsonLd();

/** `/versus`: every comparison, by the kind of program, each with one line
 * on why AMP. The words are `src/versus/amp.ts` and `catalog.json`, which
 * the static document repeats. */
export function VersusHubScreen() {
  usePageHead(versusHubHead, data);
  return (
    <VersusFrame beside="schools">
      <section className={styles.intro} aria-labelledby="versus-title">
        <h1 id="versus-title" className={styles.title}>
          {versusHub.title}
        </h1>
        <p className={styles.lede}>{versusHub.lede}</p>
      </section>

      <section className={styles.why} aria-labelledby="versus-why">
        <h2 id="versus-why">{versusHub.why.heading}</h2>
        <ul>
          {versusHub.why.reasons.map((reason) => (
            <li key={reason.title}>
              {reason.href ? (
                <a href={reason.href}>{reason.title}</a>
              ) : (
                <Link to="/research" hash={reason.research}>
                  {reason.title}
                </Link>
              )}
              <p>{reason.text}</p>
            </li>
          ))}
        </ul>
        <p>
          <Link to="/research">{researchPage.title}</Link>
        </p>
      </section>

      {groups.map(({ category, entries }) => (
        <Topic
          key={category.id}
          id={`versus-${category.id}`}
          heading={category.title}
        >
          <p>{category.blurb}</p>
          <ul className={styles.index} data-versus-category={category.id}>
            {entries.map((entry) => (
              <li key={entry.slug}>
                <Link to={VERSUS} params={{ slug: entry.slug }}>
                  AMP vs {entry.name}
                </Link>
                <span>{entry.line}</span>
              </li>
            ))}
          </ul>
        </Topic>
      ))}
    </VersusFrame>
  );
}

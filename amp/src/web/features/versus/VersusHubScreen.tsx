import { Link } from "@tanstack/react-router";
import { researchComponent, researchPage } from "../../../research/report";
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
          {versusHub.why.components.map((id) => {
            const component = researchComponent(id);
            return (
              <li key={id}>
                <Link to="/research" hash={id}>
                  {component.title}
                </Link>
                <p>{component.what}</p>
              </li>
            );
          })}
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

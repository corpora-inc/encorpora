import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { researchPage } from "../../../research/report";
import { versusContact, versusRows } from "../../../versus/amp";
import { relatedComparisons } from "../../../versus/catalog";
import { sourceAnchor } from "../../../versus/citations";
import {
  checkedLabel,
  researchLink,
  versusPageHead,
  versusPageJsonLd,
} from "../../../versus/head";
import { versusCatalog } from "../../../versus/pages";
import type { VersusPage } from "../../../versus/types";
import { FreeNote, TryFreeButton } from "../pitch/TryFree";
import { Cited } from "./Cited";
import { Topic, usePageHead, VersusFrame } from "./VersusFrame";
import { VERSUS, versusHubLink } from "./links";
import styles from "./Versus.module.css";

/** `/versus/<slug>`: AMP beside one other program. Why AMP first, then the
 * two side by side, then the other program fairly, the evidence, who each
 * suits, and every source. The words are the page's file
 * (`src/versus/pages/<slug>.json`), which arrives with the screen, and AMP's
 * side (`src/versus/amp.ts`); the static document repeats them. */
export function VersusPageScreen({ page }: { page: VersusPage }) {
  usePageHead(
    useMemo(() => versusPageHead(page), [page]),
    useMemo(() => versusPageJsonLd(page), [page]),
  );
  const rows = versusRows.filter((row) => page.rows[row.id] !== undefined);
  const related = relatedComparisons(page.slug, versusCatalog);
  const navigate = useNavigate();
  const { name } = page;
  return (
    <VersusFrame beside="hub">
      <section className={styles.intro} aria-labelledby="versus-title">
        <h1 id="versus-title" className={styles.title}>
          AMP vs {name}
        </h1>
        <p className={styles.lede}>
          <Cited text={page.verdict} />
        </p>
        {/* The homepage's one action, to the same place. */}
        <div className={styles.start} data-versus-action="">
          <TryFreeButton
            variant="primary"
            className={styles.try}
            go={(place) => void navigate(place as never)}
          />
          <FreeNote className={styles.note} />
        </div>
      </section>

      <Topic id="versus-why" heading="Why AMP">
        <ul className={`${styles.plain} ${styles.reasons}`}>
          {page.reasons.map((reason) => (
            <li key={reason.title}>
              <h3 className={styles.sub}>
                <Cited text={reason.title} />
              </h3>
              <p>
                <Cited text={reason.body} />
              </p>
              {reason.research && reason.research.length > 0 && (
                <p className={styles.research}>
                  {reason.research.map((id) => (
                    <Link key={id} to="/research" hash={id}>
                      {researchLink(id).label}
                    </Link>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Topic>

      <section className={styles.compare} aria-labelledby="versus-table">
        <h2 id="versus-table">Side by side</h2>
        <table className={styles.table} role="table" data-versus-table="">
          <thead role="rowgroup">
            <tr role="row">
              <td role="presentation" />
              <th role="columnheader" scope="col" className={styles.ours}>
                AMP
              </th>
              <th role="columnheader" scope="col">
                {name}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row) => (
              <tr key={row.id} role="row" data-versus-row={row.id}>
                <th role="rowheader" scope="row">
                  {row.label}
                </th>
                <td role="cell" className={styles.ours}>
                  <span className={styles.who} aria-hidden="true">
                    AMP
                  </span>
                  {row.amp}
                </td>
                <td role="cell" className={styles.theirs}>
                  <span className={styles.who} aria-hidden="true">
                    {name}
                  </span>
                  <Cited text={page.rows[row.id]!} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Topic id="versus-theirs" heading={`What ${name} is`}>
        {page.maker && <p className={styles.small}>From {page.maker}</p>}
        {page.theirs.map((text) => (
          <p key={text}>
            <Cited text={text} />
          </p>
        ))}
      </Topic>

      <Topic id="versus-credit" heading={`What ${name} does well`}>
        <ul className={styles.points}>
          {page.credit.map((text) => (
            <li key={text}>
              <Cited text={text} />
            </li>
          ))}
        </ul>
      </Topic>

      <Topic id="versus-evidence" heading="The evidence">
        <div className={styles.side}>
          <h3 className={styles.sub}>{name}</h3>
          {page.evidence.theirs.map((text) => (
            <p key={text}>
              <Cited text={text} />
            </p>
          ))}
        </div>
        <div className={styles.side}>
          <h3 className={styles.sub}>AMP</h3>
          {page.evidence.ours.map((text) => (
            <p key={text}>
              <Cited text={text} />
            </p>
          ))}
          <p>
            <Link to="/research">{researchPage.title}</Link>
          </p>
        </div>
      </Topic>

      <section className={styles.fit} aria-label="Which to choose">
        <div>
          <h2>Choose {name} if</h2>
          <ul className={styles.points}>
            {page.fit.them.map((text) => (
              <li key={text}>
                <Cited text={text} />
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.mine}>
          <h2>Choose AMP if</h2>
          <ul className={styles.points}>
            {page.fit.amp.map((text) => (
              <li key={text}>
                <Cited text={text} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Topic id="versus-questions" heading="Questions">
        <ul className={`${styles.plain} ${styles.questions}`}>
          {page.questions.map(({ question, answer }) => (
            <li key={question}>
              <h3 className={styles.sub}>{question}</h3>
              <p>
                <Cited text={answer} />
              </p>
            </li>
          ))}
        </ul>
      </Topic>

      <Topic id="versus-sources" heading="Sources">
        <ol className={styles.sources}>
          {page.sources.map((source, index) => (
            <li key={source.url} id={sourceAnchor(index + 1)}>
              <a href={source.url}>{source.title}</a>
            </li>
          ))}
        </ol>
        <p className={styles.small}>Checked {checkedLabel(page.checked)}.</p>
        <p className={styles.small}>
          {name} is a trademark of its owner. AMP is not affiliated with it.
          Found an error? Write to{" "}
          <a href={`mailto:${versusContact}`}>{versusContact}</a>.
        </p>
      </Topic>

      <Topic id="versus-more" heading="More comparisons">
        {related.length > 0 && (
          <ul className={styles.index}>
            {related.map((entry) => (
              <li key={entry.slug}>
                <Link to={VERSUS} params={{ slug: entry.slug }}>
                  AMP vs {entry.name}
                </Link>
                <span>{entry.line}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link {...versusHubLink} className={styles.all}>
            All comparisons
          </Link>
        </p>
      </Topic>
    </VersusFrame>
  );
}

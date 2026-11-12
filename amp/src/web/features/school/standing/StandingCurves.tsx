import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { currentSession } from "../api";
import { orgPath } from "../paths";
import { Button } from "../../../ui/Button";
import { CurveLegend, CurvePlot, GradeAxis, peakOf } from "./CurvePlot";
import { plain, signed } from "./format";
import {
  AxisEnds,
  CurveFacts,
  curveSentence,
  SettlingNote,
  ShareRows,
  TableDisclosure,
} from "./parts";
import { orgStandingOptions } from "./standing-api";
import styles from "./Standing.module.css";

/**
 * The overview's "Where students stand against grade level": every rostered
 * student as a curve, rolled up into one for the school or district, with its
 * numbers beside it and a way into each class. Its own data and its own
 * endpoint; the overview places the two parts in its grid.
 */
export function StandingCurves({
  orgId,
  sectionClass,
  factsClass,
  titleClass,
}: {
  orgId: string;
  /** Where the overview's grid puts the chart, and the numbers. */
  sectionClass?: string;
  factsClass?: string;
  titleClass?: string;
}) {
  const standing = useQuery(orgStandingOptions(currentSession(), orgId));
  const data = standing.data;
  const district = data ? data.org.kind !== "school" : false;
  return (
    <>
      <section aria-labelledby="overview-standing" className={sectionClass}>
        <div className={styles.head}>
          <h2 id="overview-standing" className={titleClass}>
            Where students stand against grade level
          </h2>
          {data && data.groups.length > 0 && (
            <Link
              to="/$"
              params={{ _splat: orgPath(orgId, "standing") }}
              className={styles.drill}
            >
              {district ? "By school" : "By class"}
              <span aria-hidden="true"> ›</span>
            </Link>
          )}
        </div>
        {data ? (
          <figure className={styles.figure}>
            <CurvePlot
              grid={data.grid}
              curve={data.all}
              top={peakOf([data.all])}
              bandLabel="Their grade"
              label={curveSentence(data.all)}
              name={data.org.name}
              hover
            />
            <GradeAxis grid={data.grid} />
            <AxisEnds />
            <CurveLegend />
            <TableDisclosure caption="Students against their own grade">
              <thead>
                <tr>
                  <th scope="col">Where</th>
                  <th scope="col">Students</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                <ShareRows curve={data.all} />
                {data.groups.map((group) => (
                  <tr key={group.id}>
                    <th scope="row">{group.name}</th>
                    <td>{group.curve.n}</td>
                    <td>
                      median{" "}
                      {group.curve.median === null
                        ? "—"
                        : signed(group.curve.median)}
                      , sd{" "}
                      {group.curve.sd === null ? "—" : plain(group.curve.sd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableDisclosure>
          </figure>
        ) : (
          <div className={styles.figure}>
            <div className={styles.plot} data-size="large" data-state="empty">
              {standing.isError && (
                <p className={styles.failed}>
                  This chart didn’t load.{" "}
                  <Button
                    variant="quiet"
                    onClick={() => void standing.refetch()}
                  >
                    Try again
                  </Button>
                </p>
              )}
            </div>
          </div>
        )}
      </section>
      <div className={factsClass}>
        {data && (
          <>
            <CurveFacts curve={data.all} label="Where students stand" />
            <SettlingNote curve={data.all} settleAt={data.settleAt} />
          </>
        )}
      </div>
    </>
  );
}

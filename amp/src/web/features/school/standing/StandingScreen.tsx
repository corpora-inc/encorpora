import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { currentSession } from "../api";
import { OrgFrame } from "../OrgFrame";
import { orgPath } from "../paths";
import { compareClassNames } from "../sort";
import { CurveLegend, CurvePlot, GradeAxis, peakOf } from "./CurvePlot";
import {
  gradesWords,
  intervalWords,
  plain,
  signed,
  students,
} from "./format";
import {
  AxisEnds,
  CurveFacts,
  curveSentence,
  SettlingNote,
  TableDisclosure,
  UpLink,
} from "./parts";
import { orgStandingOptions } from "./standing-api";
import styles from "./Standing.module.css";

/**
 * The drill from the overview: the school's curve, then each class's on one
 * shared axis and one shared scale, so a narrow, settled class stands tall and
 * a new one lies flat and wide. A district's rows are its schools. Each row
 * opens the next level down.
 */
export function StandingScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const standing = useQuery(orgStandingOptions(currentSession(), orgId));
  const data = standing.data;
  const groups = useMemo(
    () =>
      [...(data?.groups ?? [])].sort((a, b) =>
        compareClassNames(a.name, b.name),
      ),
    [data],
  );
  const top = useMemo(
    () => (data ? peakOf(data.groups.map((group) => group.curve)) : 1),
    [data],
  );
  const district = data ? data.org.kind !== "school" : false;
  return (
    <OrgFrame orgId={orgId} nav="overview" title="Where students stand">
      {standing.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title="These curves didn’t load"
          action={
            <Button variant="primary" onClick={() => void standing.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : (
        <div className={styles.screen}>
          <UpLink to={orgPath(orgId)}>Overview</UpLink>
          <header className={styles.title}>
            <h1>Where students stand against grade level</h1>
            <p>
              {[data.org.name, gradesWords(data.grades), students(data.all.n)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
          <div className={styles.lead}>
            <figure className={styles.figure}>
              <CurvePlot
                grid={data.grid}
                curve={data.all}
                top={peakOf([data.all])}
                bandLabel="Their grade"
                label={curveSentence(data.all)}
                hover
              />
              <GradeAxis grid={data.grid} />
              <AxisEnds />
              <CurveLegend />
            </figure>
            <div className={styles.leadFacts}>
              <CurveFacts curve={data.all} label={data.org.name} />
              <SettlingNote curve={data.all} settleAt={data.settleAt} />
            </div>
          </div>
          {groups.length > 0 && (
            <section aria-labelledby="standing-groups">
              <h2 id="standing-groups" className={styles.sectionTitle}>
                {district ? "By school" : "By class"}
              </h2>
              <ul className={styles.ridge}>
                {groups.map((group) => (
                  <li key={group.id}>
                    <Link
                      to="/$"
                      params={{
                        _splat:
                          group.kind === "school"
                            ? orgPath(group.id, "standing")
                            : orgPath(orgId, `standing/${group.id}`),
                      }}
                      className={styles.ridgeRow}
                    >
                      <span className={styles.ridgeName}>
                        <strong>{group.name}</strong>
                        <span>
                          {[gradesWords(group.grades), students(group.curve.n)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {group.curve.middle && (
                          <span className={styles.ridgeFigure}>
                            Median {signed(group.curve.middle.median)}{" "}
                            <span>({intervalWords(group.curve.middle)})</span>
                          </span>
                        )}
                      </span>
                      <CurvePlot
                        grid={data.grid}
                        curve={group.curve}
                        top={top}
                        size="compact"
                        label={`${group.name}. ${curveSentence(group.curve)}`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={styles.ridgeAxis}>
                <span />
                <div>
                  <GradeAxis grid={data.grid} />
                  <AxisEnds />
                </div>
              </div>
            </section>
          )}
          <TableDisclosure
            caption={`Where students stand, ${district ? "by school" : "by class"}`}
          >
            <thead>
              <tr>
                <th scope="col">{district ? "School" : "Class"}</th>
                <th scope="col">Students</th>
                <th scope="col">Median (95%)</th>
                <th scope="col">Mean</th>
                <th scope="col">sd</th>
                <th scope="col">Within half a grade</th>
                <th scope="col">Fewer than {data.settleAt} answers</th>
              </tr>
            </thead>
            <tbody>
              {[{ id: "all", name: "Everyone", curve: data.all }, ...groups].map(
                (group) => (
                  <tr key={group.id}>
                    <th scope="row">{group.name}</th>
                    <td>{group.curve.n}</td>
                    <td>
                      {group.curve.middle
                        ? `${signed(group.curve.middle.median)} (${intervalWords(group.curve.middle)})`
                        : "—"}
                    </td>
                    <td>
                      {group.curve.mean === null
                        ? "—"
                        : signed(group.curve.mean)}
                    </td>
                    <td>
                      {group.curve.sd === null ? "—" : plain(group.curve.sd)}
                    </td>
                    <td>
                      {group.curve.n
                        ? `${Math.round((group.curve.within / group.curve.n) * 100)}%`
                        : "—"}
                    </td>
                    <td>{group.curve.settling}</td>
                  </tr>
                ),
              )}
            </tbody>
          </TableDisclosure>
        </div>
      )}
    </OrgFrame>
  );
}

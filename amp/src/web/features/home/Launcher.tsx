import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import { WaveMark } from "../../ui/WaveMark";
import { choosePlace, usePlaces } from "../navigation/PlaceSwitcher";
import { rememberedPlace } from "../onboarding/place-memory";
import { launches, type Launch } from "./destination";
import styles from "./Launcher.module.css";

/**
 * `/` signed in: never a redirect, and only reached by typing the bare
 * address or an old bookmark (every way in opens its destination itself).
 * An account that hasn't started is welcomed, with one way on: its first
 * question at /start. Anyone else sees their places, the one last used
 * first, each with what it is and Open.
 */
export function Launcher() {
  const session = useQuery(sessionOptions).data ?? null;
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const account = me?.signedIn ? me : null;
  const { groups, loading } = usePlaces(account);
  if (!account || loading) return <LoadingScreen overlay />;
  const all = launches(account, groups, rememberedPlace(account.account.id));
  const open = (launch: Launch) => {
    if (launch.place) choosePlace(account, launch.place);
  };
  if (all.length === 1 && all[0]!.id === "start")
    return (
      <Page width="narrow" data-launcher="" className={styles.welcome}>
        <WaveMark className={styles.mark} />
        <PageHeader title="Welcome to AMP" />
        <p className={styles.line}>
          Math at your own level, from counting to calculus.
        </p>
        <Link
          to="/start"
          className={`${buttonClass("primary")} ${styles.primary}`}
          data-launch="start"
        >
          Get started
        </Link>
      </Page>
    );
  return (
    <Page width="narrow" data-launcher="">
      <PageHeader title="Welcome back" />
      <ul className={styles.places} aria-label="Your places">
        {all.map((launch, index) => (
          <li key={launch.id} className={styles.place}>
            <div className={styles.text}>
              <h2 className={styles.name}>{launch.name}</h2>
              {launch.detail && (
                <p className={styles.detail}>{launch.detail}</p>
              )}
            </div>
            <Link
              to="/$"
              params={{ _splat: launch.path }}
              className={buttonClass(index === 0 ? "primary" : "secondary")}
              aria-label={launch.label}
              onClick={() => open(launch)}
              data-launch={launch.id}
            >
              {launch.action}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

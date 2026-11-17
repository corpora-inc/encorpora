import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import { RowLink, RowList } from "../../ui/RowList";
import { choosePlace, usePlaces } from "../navigation/PlaceSwitcher";
import { rememberedPlace } from "../onboarding/place-memory";
import { launches, type Launch } from "./destination";
import styles from "./Launcher.module.css";

/** `/` signed in: one large way to this person's place, and their other
 * places under it. A real screen, so Back to it is never a redirect. */
export function Launcher() {
  const session = useQuery(sessionOptions).data ?? null;
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const account = me?.signedIn ? me : null;
  const { groups, loading } = usePlaces(account);
  if (!account || loading) return <LoadingScreen overlay />;
  const [primary, ...others] = launches(
    account,
    groups,
    rememberedPlace(account.account.id),
  );
  const open = (id: string | undefined) => {
    const launch = [primary, ...others].find((entry) => entry?.id === id);
    if (launch?.place) choosePlace(account, launch.place);
  };
  return (
    <Page width="narrow" data-launcher="">
      <PageHeader title="Home" />
      <Link
        to="/$"
        params={{ _splat: primary!.path }}
        className={`${buttonClass("primary")} ${styles.primary}`}
        onClick={() => open(primary!.id)}
        data-launch={primary!.id}
      >
        {primary!.label}
      </Link>
      {others.length > 0 && (
        <div
          onClickCapture={(event) =>
            open(
              (event.target as Element)
                .closest("[data-launch]")
                ?.getAttribute("data-launch") ?? undefined,
            )
          }
        >
          <RowList label="Your other places">
            {others.map((launch) => (
              <RowLink
                key={launch.id}
                title={launch.label}
                meta={launch.detail}
                to={launch.path}
                data-launch={launch.id}
              />
            ))}
          </RowList>
        </div>
      )}
    </Page>
  );
}

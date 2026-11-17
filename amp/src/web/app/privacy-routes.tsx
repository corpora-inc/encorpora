import { createRoute, redirect, type AnyRoute } from "@tanstack/react-router";
import { privacyPanel, setPanel } from "../features/account/panels";
import { loadSettingsHub } from "../features/spaces/settings-hub";
import { staffScreen } from "./school-routes";

/*
 * Privacy's older addresses (IA v2 §2.3): each is one hop, straight to the
 * Privacy overlay over the account's settings hub (`<hub>/privacy`,
 * app/account-overlays.tsx), with the panel its last part named open
 * (features/account/panels.ts). Never a chain: `/family/privacy/consent`
 * used to pass through `/account/privacy/consent`.
 *
 *   /account/privacy/<panel>, /family/privacy(/<panel>)  → <hub>/privacy
 *
 * `/account/privacy` itself is the overlay over `/account`
 * (app/account-overlays.tsx), for anyone signed in.
 *
 * `/consent` stays: it is where a consent email's link records consent
 * (ParentConsentCenter, the email-plus link of 16 CFR 312.5(b)(2)(vi)).
 */

type HopContext = {
  location: { pathname: string; searchStr: string };
  params: unknown;
};

/** One hop to the Privacy overlay over the account's hub, its panel stored
 * on the way. */
async function toPrivacy(context: HopContext) {
  const { session } = await staffScreen(context);
  const panel = privacyPanel((context.params as { panel?: string }).panel);
  if (panel) setPanel(session.accountId, "privacy", panel);
  const href = await loadSettingsHub(session, "privacy");
  throw redirect({ href, replace: true });
}

export function privacyRoutes<Root extends AnyRoute>(root: Root) {
  const hop = (path: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "account" },
      beforeLoad: (context) => toPrivacy(context as unknown as HopContext),
    });
  return [
    hop("/account/privacy/$panel"),
    hop("/family/privacy"),
    hop("/family/privacy/$panel"),
  ] as const;
}

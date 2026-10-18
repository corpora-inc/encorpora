import {
  createRootRoute,
  createRoute,
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  lazyRouteComponent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import { nativeRuntime } from "../native-runtime";
import { queryClient, sessionOptions, meOptions } from "../lib/query";
import { LoadingScreen, RouteError } from "./LoadingScreen";
const searchSchema = z
  .object({
    return: z.enum(["security"]).optional(),
    token: z.string().max(2048).optional(),
    error: z.string().max(200).optional(),
    topic: z.string().max(100).optional(),
    strand: z.string().max(100).optional(),
    filter: z.string().max(100).optional(),
    skill: z.string().max(100).optional(),
    page: z.coerce.number().int().nonnegative().optional(),
    state: z.string().max(200).optional(),
    purchase: z.string().max(200).optional(),
    "sign-in": z.string().optional(),
    "reset-password": z.string().optional(),
  })
  .passthrough();
function RouterError({ error }: { error: unknown }) {
  const router = useRouter();
  return <RouteError error={error} reset={() => void router.invalidate()} />;
}
const root = createRootRoute({
  component: Outlet,
  validateSearch: (search) => searchSchema.parse(search),
  errorComponent: RouterError,
});
const legacy = lazyRouteComponent(() => import("./LegacyApp"), "LegacyApp");
const auth = lazyRouteComponent(
  () => import("../features/auth/SignInScreen"),
  "SignInScreen",
);
const start = lazyRouteComponent(
  () => import("../features/onboarding/StartScreen"),
  "StartScreen",
);
async function beforeStart({ location }: { location: { pathname: string } }) {
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
  if (!nativeRuntime) {
    const me = await queryClient.fetchQuery(meOptions(session));
    if (!me.signedIn) throw redirect({ to: "/sign-in" });
    if (
      me.next === "verify-email" &&
      location.pathname !== "/start/verify-email"
    )
      throw redirect({ to: "/start/verify-email", replace: true });
    if (
      me.next !== "verify-email" &&
      me.consent.status !== "active" &&
      location.pathname !== "/start/consent"
    )
      throw redirect({ to: "/start/consent", replace: true });
    if (
      me.next !== "verify-email" &&
      me.consent.status === "active" &&
      ["/start/consent", "/start/verify-email"].includes(location.pathname)
    )
      throw redirect({ to: "/start/name", replace: true });
  }
}
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: legacy,
  beforeLoad: ({ search: rawSearch }) => {
    const search = searchSchema.parse(rawSearch);
    if ("sign-in" in search)
      throw redirect({
        to: search["sign-in"] === "create" ? "/sign-up" : "/sign-in",
        search: { return: search.return },
      });
    if ("reset-password" in search)
      throw redirect({
        to: "/reset-password",
        search: { token: search.token },
      });
  },
});
const signIn = createRoute({
  getParentRoute: () => root,
  path: "/sign-in",
  component: auth,
});
const signUp = createRoute({
  getParentRoute: () => root,
  path: "/sign-up",
  component: auth,
});
const signInStep = createRoute({
  getParentRoute: () => root,
  path: "/sign-in/$step",
  component: auth,
  params: {
    parse: (p) => ({
      step: z.enum(["forgot", "check-email", "two-factor"]).parse(p.step),
    }),
  },
});
const reset = createRoute({
  getParentRoute: () => root,
  path: "/reset-password",
  component: auth,
});
const startIndex = createRoute({
  getParentRoute: () => root,
  path: "/start",
  beforeLoad: () => {
    throw redirect({ to: "/start/name" });
  },
});
const startName = createRoute({
  getParentRoute: () => root,
  path: "/start/name",
  beforeLoad: beforeStart,
  component: start,
});
const startYear = createRoute({
  getParentRoute: () => root,
  path: "/start/birth-year",
  beforeLoad: beforeStart,
  component: start,
});
const startConsent = createRoute({
  getParentRoute: () => root,
  path: "/start/consent",
  beforeLoad: beforeStart,
  component: start,
});
const startVerify = createRoute({
  getParentRoute: () => root,
  path: "/start/verify-email",
  beforeLoad: beforeStart,
  component: start,
});
const fallback = createRoute({
  getParentRoute: () => root,
  path: "/$",
  component: legacy,
});
export const router = createRouter({
  routeTree: root.addChildren([
    home,
    signIn,
    signUp,
    signInStep,
    reset,
    startIndex,
    startName,
    startYear,
    startConsent,
    startVerify,
    fallback,
  ]),
  history: nativeRuntime
    ? createMemoryHistory({ initialEntries: ["/"] })
    : createBrowserHistory(),
  defaultPendingComponent: LoadingScreen,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

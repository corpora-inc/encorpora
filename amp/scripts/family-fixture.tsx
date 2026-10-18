import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { queryClient, meOptions, refreshMe } from "../src/web/lib/query";
import { useAppRoute } from "../src/web/app-routes";
import { FamilyCenter } from "../src/web/FamilyCenter";
import "../src/web/ui/tokens.css";
const Content = createContext<React.ReactNode>(null);
export function FixtureRouter({
  children,
  path = "/family/learners",
}: {
  children: React.ReactNode;
  path?: string;
}) {
  const [router] = useState(() => {
    const root = createRootRoute({ component: () => useContext(Content) });
    const route = createRoute({ getParentRoute: () => root, path: "/$" });
    return createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({ initialEntries: [path] }),
    });
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Content.Provider value={children}>
        <RouterProvider router={router} />
      </Content.Provider>
    </QueryClientProvider>
  );
}
export function FamilyFixture({
  token,
  identity,
  events = [],
}: {
  token: string;
  identity: string;
  events?: string[];
}) {
  const { location, navigate } = useAppRoute();
  useEffect(() => {
    void refreshMe({ token, accountId: identity }).catch(() => {});
  }, [identity, token, location.pathname]);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    return () => {
      generation.current++;
    };
  }, [identity]);
  const section = location.pathname.split("/")[2];
  return (
    <FamilyCenter
      token={token}
      identity={identity}
      initialSection={
        section === "access" || section === "privacy" ? section : "learners"
      }
      onSectionChange={(s) => navigate("/family/" + s)}
      onChanged={async () => {
        const epoch = generation.current;
        const me = await refreshMe({ token, accountId: identity });
        if (epoch === generation.current && me.signedIn)
          events.push(
            "changed:" + me.family.learners.map((l) => l.name).join(","),
          );
      }}
      onClose={() => {}}
      onLearningInvalidated={() => events.push("invalidated")}
    />
  );
}

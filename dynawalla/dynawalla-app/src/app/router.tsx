import { createHashRouter } from "react-router"

import { Shell } from "./Shell.tsx"
import { ROUTE_PATHS } from "./routes.ts"
import { Home } from "../screens/Home.tsx"
import { Destination } from "../screens/Destination.tsx"
import { PracticeScreen } from "../screens/Practice.tsx"
import { SettingsScreen } from "../screens/Settings.tsx"
import { WorldRoute } from "../screens/World.tsx"

// Hash routing, per ADR-0005: `tauri://` and `http://tauri.localhost` are
// custom protocols, history routing behaves inconsistently under them, and the
// hash gives Android's hardware back button something real to pop.
//
// `handle` carries the destination key so the lintel can name where you are
// without a second table mapping paths to labels.
export const router = createHashRouter([
  {
    path: ROUTE_PATHS.home,
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: ROUTE_PATHS.practice, element: <PracticeScreen />, handle: "practice" },
      { path: ROUTE_PATHS.world, element: <WorldRoute />, handle: "world" },
      { path: ROUTE_PATHS.progress, element: <Destination />, handle: "progress" },
      { path: ROUTE_PATHS.profiles, element: <Destination />, handle: "profiles" },
      { path: ROUTE_PATHS.settings, element: <SettingsScreen />, handle: "settings" },
    ],
  },
])

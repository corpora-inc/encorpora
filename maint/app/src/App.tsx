import { lazy, Suspense, useEffect } from "react";
import { createBrowserRouter, Outlet, RouterProvider, useLocation } from "react-router";
import { NotFound } from "./screens/NotFound.tsx";

/** The design gallery ships only in development and design builds. */
const DESIGN = import.meta.env.DEV || import.meta.env.VITE_DESIGN === "1";
const GalleryIndex = lazy(() => import("./design/Gallery.tsx").then((m) => ({ default: m.GalleryIndex })));
const GalleryState = lazy(() => import("./design/Gallery.tsx").then((m) => ({ default: m.GalleryState })));

/** New screen, top of page. */
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Root() {
  return (
    <>
      <ScrollTop />
      {/* A lazy screen loads behind a blank page of the same colour: one neutral frame, then the screen. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      ...(DESIGN
        ? [
            { path: "/design", element: <GalleryIndex /> },
            { path: "/design/:screen/:state", element: <GalleryState /> },
          ]
        : []),
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

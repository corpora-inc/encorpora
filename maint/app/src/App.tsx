import { lazy, Suspense, useEffect } from "react";
import { createBrowserRouter, Outlet, RouterProvider, useLocation } from "react-router";
import { PRODUCT } from "./config.ts";
import { Frame } from "./pages/Frame.tsx";
import { HomePage, IdentifyPage, UnitRoute } from "./pages/FleetPages.tsx";
import { CloseOutPage, DescribePage, JobPage } from "./pages/JobPages.tsx";
import { LearnPage, TreeStudyPage } from "./pages/LearnPages.tsx";
import { ManualHomePage, ManualSearchPage, SectionPage } from "./pages/ManualPages.tsx";
import { RecordsPage } from "./pages/RecordsPage.tsx";
import { ReviewPage } from "./pages/ReviewPage.tsx";
import { PrintJobPage, PrintProcedurePage, TaskListPage, TaskRoute } from "./pages/TaskPages.tsx";
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
      // Hard copy: a plain document, no app chrome.
      { path: "/print/procedure/:taskId", element: <PrintProcedurePage /> },
      { path: "/print/job/:jobId", element: <PrintJobPage /> },
      {
        element: <Frame />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/units/new/:mode", element: <IdentifyPage /> },
          { path: "/units/:unitId", element: <UnitRoute /> },
          { path: "/units/:unitId/troubleshoot", element: <DescribePage /> },
          { path: "/jobs/:jobId", element: <JobPage /> },
          { path: "/jobs/:jobId/ask", element: <JobPage /> },
          { path: "/jobs/:jobId/page/:assetId", element: <JobPage /> },
          { path: "/jobs/:jobId/close", element: <CloseOutPage /> },
          { path: "/records", element: <RecordsPage /> },
          { path: "/procedures", element: <TaskListPage /> },
          { path: "/procedures/:taskId", element: <TaskRoute /> },
          { path: "/manual", element: <ManualHomePage /> },
          { path: "/manual/search/:q", element: <ManualSearchPage /> },
          { path: "/manual/:sectionId", element: <SectionPage /> },
          { path: "/manual/:sectionId/page/:assetId", element: <SectionPage /> },
          { path: "/review", element: <ReviewPage /> },
          { path: "/review/:lessonId", element: <ReviewPage /> },
          { path: "/learn", element: <LearnPage /> },
          { path: "/learn/tree/:treeId", element: <TreeStudyPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

/** The engine could not be reached at start: say what happened and what to do. */
export function BootFailed({ error }: { error: unknown }) {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16">
      <h1 className="mb-3 text-h2">{PRODUCT.name} could not open its manual pack</h1>
      <p className="text-body text-ink-2">The engine on this device did not answer. Restart the app. If this repeats, reinstall the pack.</p>
      <p className="mt-4 text-meta text-ink-3">{error instanceof Error ? error.message : String(error)}</p>
    </main>
  );
}

import { useEffect } from "react";
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router";
import { Shell } from "./ui/Shell.tsx";
import { AskAnswer, AskHome, AskQuery } from "./screens/Ask.tsx";
import { DoHome, ProcedureScreen, RunReport, RunStep, RunsList } from "./screens/Do.tsx";
import { Glossary, LearnHome, LessonScreen, RulesIndex, TermScreen, TopicScreen } from "./screens/Learn.tsx";
import { ExamIntro, ExamItem, ExamResults, ExamReview, PracticeHome, PracticeSession, SkillsScreen } from "./screens/Practice.tsx";
import { Reader } from "./screens/Reader.tsx";
import { AboutScreen, SettingsScreen } from "./screens/Settings.tsx";
import { ClearanceTool, LoadChartPractice, LoadChartTool, SignalScreen, SignalsTool, ToolsHome } from "./screens/Tools.tsx";
import { NotFound } from "./screens/NotFound.tsx";

/** New screen, top of page; the reader scrolls to its own target. */
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith("/read/")) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Root() {
  return (
    <>
      <ScrollTop />
      <Shell />
    </>
  );
}

export const routes = [
  {
    element: <Root />,
    children: [
      { path: "/", element: <Navigate to="/ask" replace /> },
      { path: "/ask", element: <AskHome /> },
      { path: "/ask/q/:q", element: <AskQuery /> },
      { path: "/ask/a/:id", element: <AskAnswer /> },
      { path: "/read/:id", element: <Reader /> },
      { path: "/do", element: <DoHome /> },
      { path: "/do/runs", element: <RunsList /> },
      { path: "/do/runs/:runId", element: <RunReport /> },
      { path: "/do/run/:runId/:n", element: <RunStep /> },
      { path: "/do/:id", element: <ProcedureScreen /> },
      { path: "/learn", element: <LearnHome /> },
      { path: "/learn/topic/:id", element: <TopicScreen /> },
      { path: "/learn/lesson/:id", element: <LessonScreen /> },
      { path: "/learn/glossary", element: <Glossary /> },
      { path: "/learn/glossary/:id", element: <TermScreen /> },
      { path: "/learn/rules", element: <RulesIndex /> },
      { path: "/practice", element: <PracticeHome /> },
      { path: "/practice/session", element: <PracticeSession /> },
      { path: "/practice/topic/:topicId", element: <PracticeSession /> },
      { path: "/practice/skills", element: <SkillsScreen /> },
      { path: "/practice/exam/:id", element: <ExamIntro /> },
      { path: "/practice/exam/:id/review", element: <ExamReview /> },
      { path: "/practice/exam/:id/results", element: <ExamResults /> },
      { path: "/practice/exam/:id/:n", element: <ExamItem /> },
      { path: "/tools", element: <ToolsHome /> },
      { path: "/tools/clearance", element: <ClearanceTool /> },
      { path: "/tools/load-chart", element: <LoadChartTool /> },
      { path: "/tools/load-chart/practice/:seed", element: <LoadChartPractice /> },
      { path: "/tools/signals", element: <SignalsTool /> },
      { path: "/tools/signals/:id", element: <SignalScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "/settings/about", element: <AboutScreen /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
